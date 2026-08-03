import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database/db';

export function useRepairs() {
  return useLiveQuery(() => db.repairs.orderBy('date').reverse().toArray(), []) || [];
}

export function useRepair(id: number | undefined) {
  return useLiveQuery(() => (id ? db.repairs.get(id) : undefined), [id]);
}

const emptyStats = { totalRepairs: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0, repairs: [] as any[] };

export function useRepairStats(start?: string, end?: string) {
  const repairs = useLiveQuery(async () => {
    let all = await db.repairs.toArray();
    if (start && end) all = all.filter((r) => r.date >= start && r.date <= end);
    return all;
  }, [start, end]);

  if (!repairs) return emptyStats;

  let totalRevenue = 0, totalCost = 0;
  for (let i = 0; i < repairs.length; i++) {
    totalRevenue += repairs[i].chargedPrice;
    totalCost += repairs[i].repairCost;
  }

  return { totalRepairs: repairs.length, totalRevenue, totalCost, totalProfit: totalRevenue - totalCost, repairs };
}
