import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database/db';
import { nameKeyOf } from '@/database/db';
import type { Item, CountSession, CountEntry, StockAdjustment, TallyImportRecord } from '@/types';

// ============================================================
// Live data hooks (Dexie observables) for the inventory app
// ============================================================

export function useItems(search?: string, group?: string) {
  return useLiveQuery(async () => {
    let items: Item[] = await db.items.toArray();
    if (group) items = items.filter(i => i.group === group);
    if (search && search.trim()) {
      const q = nameKeyOf(search);
      // prefix match first, then substring
      items = items
        .filter(i => i.nameKey.includes(q))
        .sort((a, b) => {
          const ap = a.nameKey.startsWith(q) ? 0 : 1;
          const bp = b.nameKey.startsWith(q) ? 0 : 1;
          if (ap !== bp) return ap - bp;
          return a.name.localeCompare(b.name);
        });
    } else {
      items = items.sort((a, b) => a.name.localeCompare(b.name));
    }
    return items;
  }, [search, group], []);
}

export function useGroups(): string[] {
  const groups = useLiveQuery(async () => {
    const items = await db.items.toArray();
    return Array.from(new Set(items.map(i => i.group).filter(Boolean) as string[])).sort();
  }, []);
  return groups ?? [];
}

export function useItem(id: number | undefined): Item | undefined {
  return useLiveQuery(() => (id != null ? db.items.get(id) : undefined), [id]);
}

export function useStats() {
  return useLiveQuery(async () => {
    const items = await db.items.toArray();
    const sessions = await db.sessions.toArray();
    const lastImport = await db.tallyImports.orderBy('importedAt').reverse().first();
    const activeSession = sessions
      .filter(s => s.status === 'in_progress')
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    const completedSessions = sessions.filter(s => s.status === 'completed').length;

    let totalQty = 0, totalValue = 0, neverCounted = 0;
    for (const i of items) {
      totalQty += i.systemQty || 0;
      totalValue += (i.systemQty || 0) * (i.rate || 0);
      if (i.lastCountedAt == null) neverCounted++;
    }
    return {
      totalItems: items.length,
      totalQty,
      totalValue,
      neverCounted,
      completedSessions,
      activeSession: activeSession ?? null,
      lastImport: lastImport ?? null,
      hasData: items.length > 0,
    };
  }, [], { totalItems: 0, totalQty: 0, totalValue: 0, neverCounted: 0, completedSessions: 0, activeSession: null, lastImport: null, hasData: false });
}

export function useSessions(): CountSession[] {
  return useLiveQuery(
    () => db.sessions.orderBy('startedAt').reverse().toArray(),
    [], 
  ) ?? [];
}

export function useSession(id: number | undefined): CountSession | undefined {
  return useLiveQuery(() => (id != null ? db.sessions.get(id) : undefined), [id]);
}

/** Session entries + pending items (items not yet counted) */
export function useSessionData(sessionId: number | undefined) {
  return useLiveQuery(async () => {
    if (sessionId == null) return { entries: [] as CountEntry[], pending: [] as Item[] };
    const session = await db.sessions.get(sessionId);
    if (!session) return { entries: [] as CountEntry[], pending: [] as Item[] };

    const entries = await db.countEntries.where('sessionId').equals(sessionId).toArray();
    entries.sort((a, b) => a.itemName.localeCompare(b.itemName));
    const countedIds = new Set(entries.map(e => e.itemId));

    let items: Item[] = session.scopeGroup
      ? await db.items.where('group').equals(session.scopeGroup).toArray()
      : await db.items.toArray();

    const pending = items
      .filter(i => !countedIds.has(i.id!))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { entries, pending, session };
  }, [sessionId], { entries: [] as CountEntry[], pending: [] as Item[], session: undefined as CountSession | undefined });
}

export function useAdjustments(): StockAdjustment[] {
  return useLiveQuery(() => db.adjustments.orderBy('appliedAt').reverse().toArray(), []) ?? [];
}

export function useImportHistory(): TallyImportRecord[] {
  return useLiveQuery(() => db.tallyImports.orderBy('importedAt').reverse().toArray(), []) ?? [];
}
