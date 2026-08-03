import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, IndianRupee } from 'lucide-react';
import type { Repair } from '@/types';
import { formatCurrency } from '@/utils/dateUtils';

interface RepairCardProps {
  repair: Repair;
  index?: number;
}

export const RepairCard = memo(function RepairCard({ repair, index = 0 }: RepairCardProps) {
  const navigate = useNavigate();
  const profit = repair.chargedPrice - repair.repairCost;

  const displayDate = repair.date.includes('T')
    ? new Date(repair.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date(repair.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div
      onClick={() => navigate(`/edit/${repair.id}`)}
      className="card cursor-pointer hover:border-dark-600 active:scale-[0.98] transition-transform"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-dark-700 rounded-xl flex items-center justify-center">
            <Smartphone size={18} className="text-dark-300" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">{repair.deviceModel || 'Device'}</h4>
            {repair.notes && <p className="text-xs text-dark-400 line-clamp-1">{repair.notes}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <IndianRupee size={12} className="text-dark-400" />
          <span className="text-sm font-bold text-white">{repair.chargedPrice}</span>
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-dark-700">
        <span className="text-[11px] text-dark-500">{displayDate}</span>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-dark-500">Cost: ₹{repair.repairCost}</span>
          <span className={`text-xs font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            Profit: {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
          </span>
        </div>
      </div>
    </div>
  );
});
