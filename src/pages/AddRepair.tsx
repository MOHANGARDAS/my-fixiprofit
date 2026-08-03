import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Save } from 'lucide-react';
import { db } from '@/database/db';
import { getTodayStr } from '@/utils/dateUtils';

export function AddRepair() {
  const navigate = useNavigate();
  const now = new Date();
  const timeStr = now.toTimeString().slice(0, 5);
  
  const [form, setForm] = useState({
    deviceModel: '',
    repairCost: '',
    chargedPrice: '',
    date: getTodayStr(),
    time: timeStr,
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.deviceModel.trim()) newErrors.deviceModel = 'Device model daalo';
    if (!form.chargedPrice || Number(form.chargedPrice) <= 0) newErrors.chargedPrice = 'Price daalo';
    if (!form.date) newErrors.date = 'Date zaroori hai';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Fire-and-forget: save in background, navigate immediately
    const dateTimeStr = `${form.date}T${form.time || '00:00'}`;
    const nowISO = new Date().toISOString();
    
    db.repairs.add({
      customerName: '',
      phone: '',
      deviceType: 'Mobile',
      deviceModel: form.deviceModel.trim(),
      problem: '',
      repairCost: Number(form.repairCost) || 0,
      chargedPrice: Number(form.chargedPrice),
      status: 'completed',
      date: dateTimeStr,
      notes: form.notes.trim(),
      createdAt: nowISO,
      updatedAt: nowISO,
    }).catch(err => console.error('Save failed:', err));

    // Navigate immediately - no waiting!
    navigate('/');
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const n = { ...prev };
        delete n[field];
        return n;
      });
    }
  };

  const profit = (Number(form.chargedPrice) || 0) - (Number(form.repairCost) || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="py-4 max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Device Model */}
        <div className="card">
          <h3 className="text-sm font-semibold text-dark-300 mb-3">Device</h3>
          <div>
            <label className="text-xs text-dark-400 mb-1 block">Device Model *</label>
            <input
              type="text"
              value={form.deviceModel}
              onChange={(e) => updateField('deviceModel', e.target.value)}
              className="input-field text-sm"
              placeholder="e.g., iPhone 14, Samsung S23, Redmi Note 12"
              autoFocus
            />
            {errors.deviceModel && <p className="text-xs text-red-400 mt-1">{errors.deviceModel}</p>}
          </div>
        </div>

        {/* Pricing - side by side on desktop */}
        <div className="card">
          <h3 className="text-sm font-semibold text-dark-300 mb-3">Pricing</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-dark-400 mb-1 block">Repair Cost (₹)</label>
              <input
                type="number"
                value={form.repairCost}
                onChange={(e) => updateField('repairCost', e.target.value)}
                className="input-field text-sm"
                placeholder="0"
                min="0"
              />
            </div>
            <div>
              <label className="text-xs text-dark-400 mb-1 block">Charged Price (₹) *</label>
              <input
                type="number"
                value={form.chargedPrice}
                onChange={(e) => updateField('chargedPrice', e.target.value)}
                className="input-field text-sm"
                placeholder="0"
                min="0"
              />
              {errors.chargedPrice && <p className="text-xs text-red-400 mt-1">{errors.chargedPrice}</p>}
            </div>
          </div>

          {form.chargedPrice && (
            <div className="flex justify-between items-center pt-3 mt-3 border-t border-dark-700">
              <span className="text-sm text-dark-400">Profit</span>
              <span className={`text-xl font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {profit >= 0 ? '+' : ''}₹{profit}
              </span>
            </div>
          )}
        </div>

        {/* Date, Time & Notes */}
        <div className="card">
          <h3 className="text-sm font-semibold text-dark-300 mb-3">Date & Notes</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-dark-400 mb-1 block">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => updateField('date', e.target.value)}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-dark-400 mb-1 block">Time</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => updateField('time', e.target.value)}
                className="input-field text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-dark-400 mb-1 block">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              className="input-field text-sm min-h-[80px] resize-none"
              placeholder="Koi additional note..."
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSaving}
          className="btn-primary w-full sm:w-auto sm:min-w-[200px] flex items-center justify-center gap-2"
        >
          <Save size={18} />
          {isSaving ? 'Saving...' : 'Save Repair'}
        </button>
      </form>
    </motion.div>
  );
}
