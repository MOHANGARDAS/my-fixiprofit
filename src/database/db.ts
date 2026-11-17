import Dexie, { type Table } from 'dexie';
import type {
  Item, CountSession, CountEntry, StockAdjustment, TallyImportRecord, AppMeta,
} from '@/types';
import type { ParsedTallyItem } from '@/utils/tallyParser';

/** Normalize an item name for matching between Tally imports / counts */
export function nameKeyOf(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

export class StockVerifyDB extends Dexie {
  items!: Table<Item, number>;
  sessions!: Table<CountSession, number>;
  countEntries!: Table<CountEntry, number>;
  adjustments!: Table<StockAdjustment, number>;
  tallyImports!: Table<TallyImportRecord, number>;
  appMeta!: Table<AppMeta, string>;

  constructor() {
    super('StockVerifyDB');
    this.version(1).stores({
      items: '++id, &nameKey, group, updatedAt',
      sessions: '++id, status, startedAt',
      countEntries: '++id, sessionId, itemId, &[sessionId+itemId]',
      adjustments: '++id, sessionId, itemId, appliedAt',
      tallyImports: '++id, importedAt',
      appMeta: 'key',
    });
  }
}

export const db = new StockVerifyDB();

// ============================================================
// Item service
// ============================================================
export const itemService = {
  async add(data: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'nameKey'> & { nameKey?: string }): Promise<number> {
    const now = new Date().toISOString();
    return db.items.add({
      ...data,
      nameKey: data.nameKey || nameKeyOf(data.name),
      createdAt: now,
      updatedAt: now,
    } as Item);
  },

  async update(id: number, patch: Partial<Item>): Promise<number> {
    const next: Partial<Item> = { ...patch, updatedAt: new Date().toISOString() };
    if (patch.name) next.nameKey = nameKeyOf(patch.name);
    return db.items.update(id, next);
  },

  async delete(id: number): Promise<void> {
    await db.items.delete(id);
    // Remove counts referencing this item to avoid orphans
    const entries = await db.countEntries.where('itemId').equals(id).toArray();
    await db.countEntries.bulkDelete(entries.map(e => e.id!).filter(Boolean));
  },

  /** Manual quantity adjustment (outside a session) - logged to adjustments */
  async adjustQty(itemId: number, newQty: number, reason?: string): Promise<void> {
    const item = await db.items.get(itemId);
    if (!item) throw new Error('Item not found');
    const now = new Date().toISOString();
    await db.transaction('rw', db.items, db.adjustments, async () => {
      if (newQty !== item.systemQty) {
        await db.adjustments.add({
          sessionId: null,
          itemId,
          itemName: item.name,
          oldQty: item.systemQty,
          newQty,
          diffQty: newQty - item.systemQty,
          reason: reason || 'Manual adjustment',
          appliedAt: now,
        });
      }
      await db.items.update(itemId, { systemQty: newQty, updatedAt: now });
    });
  },
};

// ============================================================
// Count session service (physical verification)
// ============================================================
export const sessionService = {
  /** Create a new session snapshotting the current item list */
  async create(name?: string, scopeGroup?: string): Promise<number> {
    const all = scopeGroup
      ? await db.items.where('group').equals(scopeGroup).toArray()
      : await db.items.toArray();
    const session: CountSession = {
      name: name || `Stock Count - ${new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
      status: 'in_progress',
      scopeGroup,
      startedAt: new Date().toISOString(),
      totalItems: all.length,
      countedItems: 0,
      matchedItems: 0,
      shortageItems: 0,
      excessItems: 0,
      totalDiffQty: 0,
    };
    return db.sessions.add(session);
  },

  /** Upsert a counted quantity for one item inside a session */
  async saveCount(sessionId: number, itemId: number, countedQty: number, notes?: string): Promise<void> {
    const item = await db.items.get(itemId);
    if (!item) throw new Error('Item not found');
    const now = new Date().toISOString();
    const existing = await db.countEntries.where({ sessionId, itemId }).first();
    const entry: CountEntry = {
      sessionId,
      itemId,
      itemName: item.name,
      unit: item.unit,
      systemQty: existing?.systemQty ?? item.systemQty,
      countedQty,
      diffQty: countedQty - (existing?.systemQty ?? item.systemQty),
      rate: item.rate,
      countedAt: now,
      notes,
    };
    if (existing) {
      await db.countEntries.update(existing.id!, entry);
    } else {
      await db.countEntries.add(entry);
    }
  },

  async removeCount(sessionId: number, itemId: number): Promise<void> {
    const existing = await db.countEntries.where({ sessionId, itemId }).first();
    if (existing) await db.countEntries.delete(existing.id!);
  },

  /** Recompute live progress for an in-progress session */
  async refreshProgress(sessionId: number): Promise<CountSession | undefined> {
    const session = await db.sessions.get(sessionId);
    if (!session || session.status !== 'in_progress') return session;
    const entries = await db.countEntries.where('sessionId').equals(sessionId).toArray();
    const countedItems = entries.length;
    let matched = 0, shortage = 0, excess = 0, totalDiff = 0;
    for (const e of entries) {
      totalDiff += e.diffQty;
      if (e.diffQty === 0) matched++;
      else if (e.diffQty < 0) shortage++;
      else excess++;
    }
    const patch: Partial<CountSession> = { countedItems, matchedItems: matched, shortageItems: shortage, excessItems: excess, totalDiffQty: totalDiff };
    await db.sessions.update(sessionId, patch);
    return db.sessions.get(sessionId);
  },

  /**
   * Complete a session: physical count becomes the truth.
   * Every counted item's systemQty is set to its countedQty and each change
   * is logged to the adjustments audit trail - all in one transaction.
   */
  async complete(sessionId: number): Promise<{ adjusted: number }> {
    const session = await db.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.status !== 'in_progress') throw new Error('Session already closed');
    const now = new Date().toISOString();
    let adjusted = 0;

    await db.transaction('rw', db.items, db.sessions, db.countEntries, db.adjustments, async () => {
      const entries = await db.countEntries.where('sessionId').equals(sessionId).toArray();
      let matched = 0, shortage = 0, excess = 0, totalDiff = 0;

      for (const e of entries) {
        const item = await db.items.get(e.itemId);
        const currentSystem = item ? item.systemQty : e.systemQty;
        const diff = e.countedQty - currentSystem;
        totalDiff += diff;
        if (diff === 0) matched++; else if (diff < 0) shortage++; else excess++;

        if (item) {
          if (diff !== 0) {
            await db.adjustments.add({
              sessionId,
              itemId: e.itemId,
              itemName: item.name,
              oldQty: item.systemQty,
              newQty: e.countedQty,
              diffQty: diff,
              reason: `Physical verification: ${session.name}`,
              appliedAt: now,
            });
            adjusted++;
          }
          await db.items.update(e.itemId, {
            systemQty: e.countedQty,
            lastCountedQty: e.countedQty,
            lastCountedAt: e.countedAt,
            updatedAt: now,
          });
        }
      }

      await db.sessions.update(sessionId, {
        status: 'completed',
        completedAt: now,
        countedItems: entries.length,
        matchedItems: matched,
        shortageItems: shortage,
        excessItems: excess,
        totalDiffQty: totalDiff,
      });
    });

    return { adjusted };
  },

  async cancel(sessionId: number): Promise<void> {
    const session = await db.sessions.get(sessionId);
    if (!session || session.status !== 'in_progress') return;
    await db.transaction('rw', db.sessions, db.countEntries, async () => {
      const entries = await db.countEntries.where('sessionId').equals(sessionId).toArray();
      await db.countEntries.bulkDelete(entries.map(e => e.id!).filter(Boolean));
      await db.sessions.update(sessionId, { status: 'cancelled', completedAt: new Date().toISOString() });
    });
  },

  async delete(sessionId: number): Promise<void> {
    await db.transaction('rw', db.sessions, db.countEntries, async () => {
      const entries = await db.countEntries.where('sessionId').equals(sessionId).toArray();
      await db.countEntries.bulkDelete(entries.map(e => e.id!).filter(Boolean));
      await db.sessions.delete(sessionId);
    });
  },
};

// ============================================================
// Tally import service
// ============================================================
export const importService = {
  /**
   * Replace mode: wipe item master, import fresh from Tally.
   */
  async replaceAll(parsed: ParsedTallyItem[], fileName: string): Promise<{ itemCount: number; totalQty: number }> {
    const now = new Date().toISOString();
    const items: Item[] = parsed.map(p => ({
      name: p.name,
      nameKey: nameKeyOf(p.name),
      group: p.group,
      unit: p.unit,
      hsn: p.hsn,
      systemQty: p.qty,
      rate: p.rate,
      createdAt: now,
      updatedAt: now,
    }));

    await db.transaction('rw', db.items, db.tallyImports, async () => {
      await db.items.clear();
      await db.items.bulkAdd(items);
      await db.tallyImports.add({
        fileName,
        importedAt: now,
        mode: 'replace',
        itemCount: items.length,
        totalQty: items.reduce((s, i) => s + i.systemQty, 0),
        newItems: items.length,
        updatedItems: 0,
      });
    });
    return { itemCount: items.length, totalQty: items.reduce((s, i) => s + i.systemQty, 0) };
  },

  /**
   * Merge mode: match by normalized name.
   * - matched   -> systemQty refreshed from Tally (Tally is the book-stock truth)
   * - new       -> added
   * In-app only items (not in Tally) are kept untouched.
   */
  async merge(parsed: ParsedTallyItem[], fileName: string): Promise<{ itemCount: number; newItems: number; updatedItems: number }> {
    const now = new Date().toISOString();
    let newItems = 0, updatedItems = 0;

    await db.transaction('rw', db.items, db.tallyImports, async () => {
      for (const p of parsed) {
        const key = nameKeyOf(p.name);
        const existing = await db.items.where('nameKey').equals(key).first();
        if (existing) {
          await db.items.update(existing.id!, {
            systemQty: p.qty,
            unit: p.unit ?? existing.unit,
            group: p.group ?? existing.group,
            rate: p.rate ?? existing.rate,
            updatedAt: now,
          });
          updatedItems++;
        } else {
          await db.items.add({
            name: p.name,
            nameKey: key,
            group: p.group,
            unit: p.unit,
            hsn: p.hsn,
            systemQty: p.qty,
            rate: p.rate,
            createdAt: now,
            updatedAt: now,
          });
          newItems++;
        }
      }

      await db.tallyImports.add({
        fileName,
        importedAt: now,
        mode: 'merge',
        itemCount: parsed.length,
        totalQty: parsed.reduce((s, p) => s + p.qty, 0),
        newItems,
        updatedItems,
      });
    });

    return { itemCount: parsed.length, newItems, updatedItems };
  },
};

// ============================================================
// Full backup export / import (Drive + JSON)
// ============================================================
export interface FullBackup {
  items: Item[];
  tallyImports: TallyImportRecord[];
  sessions: CountSession[];
  countEntries: CountEntry[];
  adjustments: StockAdjustment[];
}

export async function exportAllData(): Promise<FullBackup> {
  const [items, tallyImports, sessions, countEntries, adjustments] = await Promise.all([
    db.items.toArray(),
    db.tallyImports.toArray(),
    db.sessions.toArray(),
    db.countEntries.toArray(),
    db.adjustments.toArray(),
  ]);
  return { items, tallyImports, sessions, countEntries, adjustments };
}

/** Restore a full backup - replaces everything (used by Drive restore / JSON import) */
export async function importAllData(data: FullBackup): Promise<{ items: number }> {
  const now = new Date().toISOString();
  const clean = <T extends { id?: number }>(arr: T[] | undefined): T[] =>
    (Array.isArray(arr) ? arr : []).map(({ id, ...rest }) => rest as T);

  await db.transaction('rw', db.items, db.tallyImports, db.sessions, db.countEntries, db.adjustments, async () => {
    await db.items.bulkAdd(clean(data.items).map(i => ({
      ...i,
      nameKey: i.nameKey || nameKeyOf(i.name),
      createdAt: i.createdAt || now,
      updatedAt: i.updatedAt || now,
    })) as Item[]);
    await db.tallyImports.bulkAdd(clean(data.tallyImports));
    await db.sessions.bulkAdd(clean(data.sessions));
    await db.countEntries.bulkAdd(clean(data.countEntries));
    await db.adjustments.bulkAdd(clean(data.adjustments));
  });
  return { items: data.items?.length ?? 0 };
}

// ============================================================
// Excel on-demand generation (used by Settings download + Drive backup)
// ============================================================
export async function generateExcelOnDemand(): Promise<{ blob: Blob; name: string; generatedAt: string } | null> {
  try {
    const { generateExcel } = await import('@/utils/inventoryExport');
    const data = await exportAllData();
    const blob = await generateExcel(data);

    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    await db.appMeta.put({
      key: 'latest_excel',
      value: JSON.stringify({
        data: base64,
        name: 'StockVerify.xlsx',
        size: blob.size,
        generatedAt: new Date().toISOString(),
      }),
      updatedAt: new Date().toISOString(),
    });

    return { blob, name: 'StockVerify.xlsx', generatedAt: new Date().toISOString() };
  } catch (err) {
    console.error('Excel generation failed:', err);
    return null;
  }
}

export async function getStoredExcelInfo(): Promise<{ name: string; generatedAt: string } | null> {
  const meta = await db.appMeta.get('latest_excel');
  if (!meta) return null;
  try {
    const parsed = JSON.parse(meta.value);
    return { name: parsed.name, generatedAt: parsed.generatedAt };
  } catch {
    return null;
  }
}
