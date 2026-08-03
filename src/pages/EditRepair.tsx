import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Save, Trash2, AlertTriangle } from 'lucide-react';
import { useRepair } from '@/hooks/useRepairs';
import { db } from '@/database/db';

export function EditRepair() {
  const { id } = useParams();
  const navigate = useNavigate();
  const repair = useRepair(id ? Number(id) : undefined);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Parse date and time from repair.date
  const parseDateTime = (dateStr: string) => {
    if (!dateStr) return { date: '', time: '' };
    if (dateStr.includes('T')) {
      const [d, t] = dateStr.split('T');
      return { date: d, time: t.slice(0, 5) };
    }
    return { date: dateStr, time: '' };
  };

  const [form, setForm] = useState({
    deviceModel: '',
    repairCost: 0,
    chargedPrice: 0,
    date: '',
    time: '',
    notes: '',
  });

  // Load data when repair is available
  useEffect(() => {
    if (repair) {
      const parsed = parseDateTime(repair.date);
      setForm({
        deviceModel: repair.deviceModel || '',
        repairCost: repair.repairCost || 0,
        chargedPrice: repair.chargedPrice || 0,
        date: parsed.date,
        time: parsed.time,
        notes: repair.notes || '',
      });
    }
  }, [repair]);

  if (!repair) {
    return (
      <div className="py-10 text-center">
        <p className="text-dark-400">Repair not found</p>
        <button onClick={() => navigate('/')} className="mt-3 text-primary-400 text-sm">
          Go back
        </button>
      </div>
    );
  }

  const updateField = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!repair.id) return;
    const dateTimeStr = form.time ? `${form.date}T${form.time}` : form.date;
    db.repairs.update(repair.id, {
      deviceModel: form.deviceModel,
      repairCost: Number(form.repairCost) || 0,
      chargedPrice: Number(form.chargedPrice) || 0,
      date: dateTimeStr,
      notes: form.notes,
      updatedAt: new Date().toISOString(),
    }).then(() => navigate(-1)).catch(err => console.error('Update failed:', err));
  };

  const handleDelete = async () => {
    if (!repair.id) return;
    await db.repairs.delete(repair.id);
    navigate('/history');
  };

  const profit = (Number(form.chargedPrice) || 0) - (Number(form.repairCost) || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="py-4 space-y-4"
    >
      {/* Device Model */}
      <div className="card">
        <h3 className="text-sm font-semibold text-dark-300 mb-3">Device</h3>
        <div>
          <label className="text-xs text-dark-400 mb-1 block">Device Model</label>
          <input
            type="text"
            value={form.deviceModel}
            onChange={(e) => updateField('deviceModel', e.target.value)}
            className="input-field text-sm"
            placeholder="e.g., iPhone 14, Samsung S23"
          />
        </div>
      </div>

      {/* Pricing */}
      <div className="card">
        <h3 className="text-sm font-semibold text-dark-300 mb-3">Pricing</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-dark-400 mb-1 block">Repair Cost (₹)</label>
            <input
              type="number"
              value={form.repairCost}
              onChange={(e) => updateField('repairCost', e.target.value)}
              className="input-field text-sm"
              min="0"
            />
          </div>
          <div>
            <label className="text-xs text-dark-400 mb-1 block">Charged Price (₹)</label>
            <input
              type="number"
              value={form.chargedPrice}
              onChange={(e) => updateField('chargedPrice', e.target.value)}
              className="input-field text-sm"
              min="0"
            />
          </div>
        </div>
        <div className="flex justify-between items-center pt-3 mt-3 border-t border-dark-700">
          <span className="text-sm text-dark-400">Profit</span>
          <span className={`text-lg font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {profit >= 0 ? '+' : ''}₹{profit}
          </span>
        </div>
      </div>

      {/* Date, Time & Notes */}
      <div className="card">
        <h3 className="text-sm font-semibold text-dark-300 mb-3">Date & Notes</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-dark-400 mb-1 block">Date</label>
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
          <label className="text-xs text-dark-400 mb-1 block">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            className="input-field text-sm min-h-[80px] resize-none"
            placeholder="Any additional notes..."
          />
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={handleSave}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Save size={18} />
          Save Changes
        </button>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="btn-secondary w-full flex items-center justify-center gap-2 text-red-400 border-red-500/20"
          >
            <Trash2 size={18} />
            Delete Repair
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card border-red-500/30 bg-red-500/5"
          >
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-400" />
              <p className="text-sm text-red-400 font-medium">Delete this repair?</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary flex-1 text-xs py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="btn-danger flex-1 text-xs py-2"
              >
                Delete
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
