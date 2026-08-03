import Dexie, { type Table } from 'dexie';
import type { Repair } from '@/types';

interface AppMeta {
  key: string;
  value: string;
  updatedAt: string;
}

export class FixiProfitDB extends Dexie {
  repairs!: Table<Repair>;
  appMeta!: Table<AppMeta>;

  constructor() {
    super('FixiProfitDB');
    this.version(1).stores({
      repairs: '++id, deviceModel, date, createdAt',
      appMeta: 'key, updatedAt',
    });
  }
}

export const db = new FixiProfitDB();

export const repairService = {
  async add(repair: Omit<Repair, 'id'>): Promise<number> {
    return db.repairs.add(repair as Repair);
  },

  async update(id: number, repair: Partial<Repair>): Promise<number> {
    return db.repairs.update(id, { ...repair, updatedAt: new Date().toISOString() });
  },

  async delete(id: number): Promise<void> {
    return db.repairs.delete(id);
  },

  async exportAll(): Promise<Repair[]> {
    return db.repairs.toArray();
  },

  async importAll(repairs: Repair[]): Promise<{ added: number; skipped: number }> {
    const existing = await db.repairs.toArray();
    const existingKeys = new Set(
      existing.map(r => `${r.date}|${r.deviceModel}|${r.chargedPrice}|${r.repairCost}`)
    );

    let added = 0;
    let skipped = 0;
    const toAdd: Omit<Repair, 'id'>[] = [];

    for (const r of repairs) {
      const key = `${r.date}|${r.deviceModel}|${r.chargedPrice}|${r.repairCost}`;
      if (existingKeys.has(key)) {
        skipped++;
      } else {
        toAdd.push({
          customerName: r.customerName || '',
          phone: r.phone || '',
          deviceType: r.deviceType || 'Mobile',
          deviceModel: r.deviceModel,
          problem: r.problem || '',
          repairCost: r.repairCost || 0,
          chargedPrice: r.chargedPrice,
          status: r.status || 'completed',
          date: r.date,
          notes: r.notes || '',
          createdAt: r.createdAt || new Date().toISOString(),
          updatedAt: r.updatedAt || new Date().toISOString(),
        });
        existingKeys.add(key);
        added++;
      }
    }

    if (toAdd.length > 0) {
      await db.repairs.bulkAdd(toAdd as Repair[]);
    }
    return { added, skipped };
  },
};

export async function generateExcelOnDemand(): Promise<{ blob: Blob; name: string; generatedAt: string } | null> {
  try {
    const { generateExcel, generateJSON } = await import('@/utils/excelExport');
    const repairs = await db.repairs.orderBy('date').reverse().toArray();
    const blob = await generateExcel(repairs);

    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    await db.appMeta.put({
      key: 'latest_excel',
      value: JSON.stringify({
        data: base64,
        name: 'FixiProfit.xlsx',
        size: blob.size,
        generatedAt: new Date().toISOString(),
      }),
      updatedAt: new Date().toISOString(),
    });

    await db.appMeta.put({
      key: 'latest_json',
      value: generateJSON(repairs),
      updatedAt: new Date().toISOString(),
    });

    return { blob, name: 'FixiProfit.xlsx', generatedAt: new Date().toISOString() };
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
