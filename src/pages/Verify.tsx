import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, ScanSearch, X, MapPin, Barcode, Package, ClipboardCheck,
  Upload, Info, ChevronRight,
} from 'lucide-react';
import { useAllBatches, useItems, useStats } from '@/hooks/useStock';
import { nameKeyOf } from '@/database/db';
import { formatQty, formatCurrency, formatDateTime } from '@/utils/dateUtils';
import type { Item } from '@/types';

const MAX_ROWS = 60;

interface BatchRow {
  batch: string;
  location: string;
  qty: number;
  rate?: number;
  value?: number;
  itemName: string;
  itemId: number;
  matched: boolean; // row itself matched the query (highlight)
}

interface ItemGroup {
  itemId: number;
  itemName: string;
  bookQty: number;
  rows: BatchRow[];
  totalQty: number;
}

interface LocationGroup {
  location: string;
  rows: BatchRow[];
  totalQty: number;
  codeCount: number;
}

export function Verify() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showAllRows, setShowAllRows] = useState(false);
  const batches = useAllBatches();
  const items = useItems();
  const stats = useStats();

  const q = nameKeyOf(query);
  const hasQuery = q.length > 0;
  const hasBatchData = batches.length > 0;

  const itemMap = useMemo(() => {
    const m = new Map<number, Item>();
    for (const i of items) if (i.id != null) m.set(i.id, i);
    return m;
  }, [items]);

  // ---------- search ----------
  const itemGroups: ItemGroup[] = useMemo(() => {
    if (!hasQuery) return [];
    const byItem = new Map<number, BatchRow[]>();
    for (const b of batches) {
      const batchMatch = b.batch.toLowerCase().includes(q);
      const itemMatch = b.itemName.toLowerCase().includes(q);
      if (!batchMatch && !itemMatch) continue;
      const rows = byItem.get(b.itemId) ?? [];
      rows.push({
        batch: b.batch, location: b.location, qty: b.qty, rate: b.rate, value: b.value,
        itemName: b.itemName, itemId: b.itemId,
        matched: batchMatch,
      });
      byItem.set(b.itemId, rows);
    }
    const groups: ItemGroup[] = [];
    for (const [itemId, rows] of byItem) {
      const item = itemMap.get(itemId);
      const sorted = rows.sort((a, b) => a.batch.localeCompare(b.batch) || a.location.localeCompare(b.location));
      groups.push({
        itemId,
        itemName: item?.name ?? rows[0].itemName,
        bookQty: item?.systemQty ?? sorted.reduce((s, r) => s + r.qty, 0),
        rows: sorted,
        totalQty: sorted.reduce((s, r) => s + r.qty, 0),
      });
    }
    // items whose a matching batch row matched first rank higher
    return groups.sort((a, b) => {
      const am = a.rows.some(r => r.matched) ? 0 : 1;
      const bm = b.rows.some(r => r.matched) ? 0 : 1;
      if (am !== bm) return am - bm;
      return a.itemName.localeCompare(b.itemName);
    });
  }, [batches, q, hasQuery, itemMap]);

  // Items with NO batch rows (plain CSV import) - name matches still useful
  const itemOnlyMatches: Item[] = useMemo(() => {
    if (!hasQuery || hasBatchData) return [];
    return items.filter(i => i.nameKey.includes(q)).slice(0, MAX_ROWS);
  }, [items, q, hasQuery, hasBatchData]);

  const locationGroups: LocationGroup[] = useMemo(() => {
    if (!hasQuery) return [];
    const byLoc = new Map<string, BatchRow[]>();
    for (const b of batches) {
      if (!b.location.toLowerCase().includes(q)) continue;
      const rows = byLoc.get(b.location) ?? [];
      rows.push({
        batch: b.batch, location: b.location, qty: b.qty, rate: b.rate, value: b.value,
        itemName: b.itemName, itemId: b.itemId,
        matched: b.batch.toLowerCase().includes(q),
      });
      byLoc.set(b.location, rows);
    }
    const groups: LocationGroup[] = [];
    for (const [loc, rows] of byLoc) {
      groups.push({
        location: loc,
        rows: rows.sort((a, b) => b.qty - a.qty),
        totalQty: rows.reduce((s, r) => s + r.qty, 0),
        codeCount: new Set(rows.filter(r => r.batch).map(r => r.batch)).size,
      });
    }
    return groups.sort((a, b) => b.totalQty - a.totalQty).slice(0, 20);
  }, [batches, q, hasQuery]);

  // empty-query: top locations as quick chips
  const topLocations = useMemo(() => {
    if (hasQuery || !hasBatchData) return [];
    const byLoc = new Map<string, { qty: number; codes: Set<string> }>();
    for (const b of batches) {
      const e = byLoc.get(b.location) ?? { qty: 0, codes: new Set<string>() };
      e.qty += b.qty;
      if (b.batch) e.codes.add(b.batch);
      byLoc.set(b.location, e);
    }
    return [...byLoc.entries()]
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 12)
      .map(([loc, e]) => ({ location: loc, totalQty: e.qty, codeCount: e.codes.size }));
  }, [batches, hasQuery, hasBatchData]);

  const toggleItem = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const noResults = hasQuery && itemGroups.length === 0 && locationGroups.length === 0 && itemOnlyMatches.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-3 py-4 pb-6 max-w-3xl"
    >
      {/* Search bar */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setExpanded(new Set()); }}
          placeholder="Batch / code / location search karein..."
          autoFocus
          className="input-field pl-10 pr-10 text-base"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-white">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Data source info */}
      {hasBatchData && (
        <div className="flex items-center gap-2 px-1">
          <Info size={12} className="text-dark-500 flex-shrink-0" />
          <p className="text-[10px] text-dark-500">
            Tally book stock (batch-wise){stats.lastImport ? ` · import: ${formatDateTime(stats.lastImport.importedAt)}` : ''}
          </p>
        </div>
      )}

      {/* Empty query state */}
      {!hasQuery && (
        <>
          {!hasBatchData ? (
            <div className="card text-center py-10 space-y-3">
              <div className="w-14 h-14 mx-auto bg-dark-700 rounded-2xl flex items-center justify-center">
                <Upload size={26} className="text-dark-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Pehle Tally stock import karein</p>
                <p className="text-xs text-dark-400 mt-1 max-w-xs mx-auto">
                  Batch-wise aur location-wise search Tally import ke baad hi kaam karta hai (Excel/CSV jo batch + godown breakdown ke saath ho).
                </p>
              </div>
              <button onClick={() => navigate('/import')} className="btn-primary text-sm">Tally Import</button>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-dark-400 uppercase tracking-wide px-1">Top Locations (tap karein)</h3>
              {topLocations.map(l => (
                <button
                  key={l.location}
                  onClick={() => setQuery(l.location)}
                  className="card w-full text-left flex items-center gap-3 hover:bg-dark-700/50 transition-colors !py-3"
                >
                  <div className="w-9 h-9 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin size={16} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{l.location}</p>
                    <p className="text-[10px] text-dark-500">{l.codeCount} codes · total {formatQty(l.totalQty)} qty</p>
                  </div>
                  <ChevronRight size={16} className="text-dark-600 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Count entry point */}
          {stats.hasData && (
            <button
              onClick={() => navigate('/count')}
              className="card w-full flex items-center gap-3 border-primary-500/30 bg-primary-500/5 hover:bg-primary-500/10 transition-colors"
            >
              <div className="w-10 h-10 bg-primary-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
                <ClipboardCheck size={20} className="text-primary-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-white">Count Session</p>
                <p className="text-[10px] text-dark-400">
                  {stats.activeSession ? `Chal raha hai: ${stats.activeSession.name}` : 'Physical counting shuru karein'}
                </p>
              </div>
              <ChevronRight size={16} className="text-primary-400 flex-shrink-0" />
            </button>
          )}
        </>
      )}

      {/* No results */}
      {noResults && (
        <div className="card text-center py-8">
          <ScanSearch size={24} className="mx-auto text-dark-500" />
          <p className="text-sm text-dark-300 mt-2">"{query}" ke liye kuch nahi mila</p>
          <p className="text-[10px] text-dark-500 mt-1">Batch code (e.g. MR-061), item name, ya location (e.g. W1-D9) try karein</p>
        </div>
      )}

      {/* ===== Location results ===== */}
      {locationGroups.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wide px-1 flex items-center gap-1.5">
            <MapPin size={12} /> Locations ({locationGroups.length})
          </h3>
          {locationGroups.map(g => (
            <div key={g.location} className="card !p-0 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-blue-500/5 border-b border-dark-700">
                <MapPin size={14} className="text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{g.location}</p>
                  <p className="text-[10px] text-dark-500">{g.codeCount} codes · {g.rows.length} entries</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-white">{formatQty(g.totalQty)}</p>
                  <p className="text-[9px] text-dark-500">total qty</p>
                </div>
              </div>
              <div className="divide-y divide-dark-800">
                {(showAllRows ? g.rows : g.rows.slice(0, MAX_ROWS)).map((r, i) => (
                  <div key={i} className={`flex items-center gap-2 px-4 py-2 ${r.matched ? 'bg-primary-500/5' : ''}`}>
                    <div className="w-6 h-6 rounded-lg bg-dark-700 flex items-center justify-center flex-shrink-0">
                      {r.batch ? <Barcode size={12} className="text-dark-400" /> : <Package size={12} className="text-dark-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs truncate ${r.batch ? 'text-dark-100 font-medium' : 'text-dark-400 italic'}`}>
                        {r.batch || '(no batch)'}
                      </p>
                      <p className="text-[9px] text-dark-500 truncate">{r.itemName}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-white">{formatQty(r.qty)}</p>
                      {r.rate != null && <p className="text-[9px] text-dark-500">@ ₹{formatQty(r.rate)}</p>}
                    </div>
                  </div>
                ))}
                {!showAllRows && g.rows.length > MAX_ROWS && (
                  <button onClick={() => setShowAllRows(true)} className="w-full text-[11px] text-primary-400 py-2 hover:bg-dark-800">
                    +{g.rows.length - MAX_ROWS} more — show all
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== Item / Batch results ===== */}
      {(itemGroups.length > 0 || itemOnlyMatches.length > 0) && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-primary-400 uppercase tracking-wide px-1 flex items-center gap-1.5">
            <Package size={12} /> Items & Batches ({itemGroups.length + itemOnlyMatches.length})
          </h3>

          {itemGroups.map(g => {
            const isOpen = expanded.has(g.itemId) || g.rows.length <= 3;
            const visibleRows = isOpen ? (showAllRows ? g.rows : g.rows.slice(0, MAX_ROWS)) : g.rows.slice(0, 3);
            return (
              <div key={g.itemId} className="card !p-0 overflow-hidden">
                <button onClick={() => toggleItem(g.itemId)} className="w-full flex items-center gap-2 px-4 py-3 bg-dark-800/60 text-left">
                  <Package size={14} className="text-primary-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{g.itemName}</p>
                    <p className="text-[10px] text-dark-500">book qty {formatQty(g.bookQty)} · {g.rows.length} batch/location entries</p>
                  </div>
                  <ChevronRight size={14} className={`text-dark-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
                </button>
                <div className="divide-y divide-dark-800">
                  {visibleRows.map((r, i) => (
                    <div key={i} className={`flex items-center gap-2 px-4 py-2 ${r.matched ? 'bg-primary-500/5 border-l-2 border-primary-500' : ''}`}>
                      <div className="w-6 h-6 rounded-lg bg-dark-700 flex items-center justify-center flex-shrink-0">
                        <Barcode size={12} className={r.batch ? 'text-dark-400' : 'text-dark-600'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs truncate ${r.batch ? 'text-dark-100 font-medium' : 'text-dark-400 italic'}`}>
                          {r.batch || '(no batch)'}
                        </p>
                        <p className="text-[9px] text-dark-500 flex items-center gap-1 truncate">
                          <MapPin size={8} className="flex-shrink-0" /> {r.location}
                          {r.value != null && <span> · ₹{formatQty(r.value)}</span>}
                        </p>
                      </div>
                      <p className={`text-sm font-bold flex-shrink-0 ${r.qty < 0 ? 'text-red-400' : 'text-white'}`}>{formatQty(r.qty)}</p>
                    </div>
                  ))}
                  {!showAllRows && g.rows.length > MAX_ROWS && (
                    <button onClick={() => setShowAllRows(true)} className="w-full text-[11px] text-primary-400 py-2 hover:bg-dark-800">
                      +{g.rows.length - MAX_ROWS} more — show all
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Plain items (no batch data) */}
          {itemOnlyMatches.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(`/items/${item.id}/edit`)}
              className="card w-full text-left flex items-center gap-3 hover:bg-dark-700/50 transition-colors !py-3"
            >
              <div className="w-9 h-9 rounded-xl bg-dark-700 flex items-center justify-center flex-shrink-0">
                <Package size={15} className="text-dark-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{item.name}</p>
                <p className="text-[10px] text-dark-500">{[item.group, item.unit].filter(Boolean).join(' · ')}</p>
              </div>
              <p className="text-base font-bold text-white flex-shrink-0">{formatQty(item.systemQty)}</p>
            </button>
          ))}
        </div>
      )}

      {/* Summary footer when batch data exists */}
      {hasBatchData && (
        <p className="text-center text-[10px] text-dark-600 pt-2">
          {batches.length} batch/location entries · {items.length} items
          {stats.lastImport ? ` · last import: ${stats.lastImport.fileName}` : ''}
          {stats.totalValue > 0 && ` · stock value ${formatCurrency(stats.totalValue)}`}
        </p>
      )}
    </motion.div>
  );
}
