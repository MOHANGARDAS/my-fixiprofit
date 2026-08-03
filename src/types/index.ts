export interface Repair {
  id?: number;
  customerName: string;
  phone: string;
  deviceType: string;
  deviceModel: string;
  problem: string;
  repairCost: number;
  chargedPrice: number;
  status: 'pending' | 'in-progress' | 'completed' | 'delivered';
  date: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type FilterPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';
