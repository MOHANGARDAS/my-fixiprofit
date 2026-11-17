import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Save, Trash2, ArrowLeft } from 'lucide-react';
import { useItem } from '@/hooks/useStock';
import { itemService } from '@/database/db';
import { formatQty, formatDateTime } from '@/utils/dateUtils';

export function ItemForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const existing = useItem(id ? Number(id) : undefined);

  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [unit, setUnit] = useState('');
  const [hsn, setHsn] = useState('');
  const [systemQty, setSystemQty] = useState('');
  const [rate, setRate] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setGroup(existing.group || '');
      setUnit(existing.unit || '');
      setHsn(existing.hsn || '');
      setSystemQty(String(existing.systemQty));
      setRate(existing.rate != null ? String(existing.rate) : '');
    }
  }, [existing]);

  const handleSave = async () => {
    if (!name.trim()) { setError('Item name required hai'); return; }
    setSaving(true);
    setError('');
    try {
      const qtyNum = parseFloat(systemQty) || 0;
      const rateNum = parseFloat(rate) || undefined;

      if (existing?.id != null) {
        const qtyChanged = qtyNum !== existing.systemQty;
        await itemService.update(existing.id, {
          name: name.trim(),
          group: group.trim() || undefined,
          unit: unit.trim() || undefined,
          hsn: hsn.trim() || undefined,
          rate: rateNum,
        });
        if (qtyChanged) {
          await itemService.adjustQty(existing.id, qtyNum, adjustReason.trim() || 'Manual adjustment');
        }
      } else {
        await itemService.add({
          name: name.trim(),
          group: group.trim() || undefined,
          unit: unit.trim() || undefined,
          hsn: hsn.trim() || undefined,
          systemQty: qtyNum,
          rate: rateNum,
        });
      }
      navigate('/items');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (existing?.id == null) return;
    await itemService.delete(existing.id);
    navigate('/items');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4 py-4 pb-6 max-w-2xl"
    >
      <button onClick={() => navigate('/items')} className="flex items-center gap-1 text-xs text-dark-400 hover:text-white">
        <ArrowLeft size={14} /> Stock Items
      </button>

      <div className="card space-y-3">
        <div>
          <label className="text-xs text-dark-400 mb-1 block">Item Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Samsung A15 Back Cover" className="input-field text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-dark-400 mb-1 block">Group / Category</label>
            <input value={group} onChange={e => setGroup(e.target.value)} placeholder="e.g. Covers" className="input-field text-sm" />
          </div>
          <div>
            <label className="text-xs text-dark-400 mb-1 block">Unit</label>
            <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="e.g. Pc" className="input-field text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-dark-400 mb-1 block">System Qty (book stock)</label>
            <input
              value={systemQty}
              onChange={e => setSystemQty(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-dark-400 mb-1 block">Rate (₹, optional)</label>
            <input value={rate} onChange={e => setRate(e.target.value)} inputMode="decimal" placeholder="0" className="input-field text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs text-dark-400 mb-1 block">HSN / Code (optional)</label>
          <input value={hsn} onChange={e => setHsn(e.target.value)} placeholder="HSN ya part code" className="input-field text-sm" />
        </div>

        {existing?.id != null && (
          <div className="bg-dark-900/60 border border-dark-700 rounded-xl p-3 space-y-2">
            <p className="text-[10px] text-dark-500">
              Last counted: {existing.lastCountedQty != null ? `${formatQty(existing.lastCountedQty)} (${formatDateTime(existing.lastCountedAt)})` : 'never'}
            </p>
            {parseFloat(systemQty) !== existing.systemQty && (
              <div>
                <label className="text-xs text-orange-400 mb-1 block">
                  Qty change: {formatQty(existing.systemQty)} → {formatQty(parseFloat(systemQty) || 0)} — reason log ho jayega
                </label>
                <input
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  placeholder="Reason (e.g. damage, return, found)"
                  className="input-field text-sm"
                />
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button onClick={handleSave} disabled={saving} className="btn-primary w-full text-sm">
          <Save size={16} className="inline mr-1.5 -mt-0.5" />
          {existing ? 'Save Changes' : 'Add Item'}
        </button>
      </div>

      {existing?.id != null && (
        <div className="card border-red-500/20 space-y-3">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full btn-secondary text-red-400 border-red-500/20 text-sm"
            >
              <Trash2 size={16} className="inline mr-1.5 -mt-0.5" /> Delete Item
            </button>
          ) : (
            <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl space-y-2">
              <p className="text-xs text-red-400">"{existing.name}" delete karna hai? Iske count entries bhi delete honge.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1 text-xs py-2">Cancel</button>
                <button onClick={handleDelete} className="btn-danger flex-1 text-xs py-2">Delete</button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
