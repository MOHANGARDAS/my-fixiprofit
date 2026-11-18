// ============================================================
// StockVerify - Inventory & Physical Stock Verification
// Data model:
//   Tally Import  ->  Stock Items (book stock)
//   Count Session ->  Count Entries  ->  Stock Adjustments
// ============================================================

/** Stock item master. Book stock comes from Tally, adjusted by physical counts. */
export interface Item {
  id?: number;
  name: string;
  /** Normalized name (lowercase, trimmed) used for matching on re-import */
  nameKey: string;
  /** Tally stock group / category */
  group?: string;
  /** Base unit e.g. Pc, Kg, Box */
  unit?: string;
  /** HSN code (optional) */
  hsn?: string;
  /** Book stock = Tally closing qty +/- in-app adjustments */
  systemQty: number;
  /** Purchase rate (optional) - used for stock value + difference value */
  rate?: number;
  /** Last physical count result (survives Tally re-imports) */
  lastCountedQty?: number;
  lastCountedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** One Tally import job (history log) */
export interface TallyImportRecord {
  id?: number;
  fileName: string;
  importedAt: string;
  mode: 'replace' | 'merge';
  itemCount: number;
  totalQty: number;
  newItems: number;
  updatedItems: number;
}

/** Physical stock verification session */
export interface CountSession {
  id?: number;
  name: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  /** Future: restrict session to one stock group */
  scopeGroup?: string;
  startedAt: string;
  completedAt?: string;
  /** Snapshot of item count when session was created */
  totalItems: number;
  countedItems: number;
  matchedItems: number;
  shortageItems: number;
  excessItems: number;
  /** Net difference (sum of diffQty) at completion */
  totalDiffQty: number;
}

/** One counted line inside a session */
export interface CountEntry {
  id?: number;
  sessionId: number;
  itemId: number;
  itemName: string;
  unit?: string;
  /** Book stock snapshot at the moment of counting */
  systemQty: number;
  countedQty: number;
  /** countedQty - systemQty (negative = shortage) */
  diffQty: number;
  rate?: number;
  countedAt: string;
  notes?: string;
}

/** Audit log of every stock quantity change */
export interface StockAdjustment {
  id?: number;
  /** null = manual adjustment from item edit screen */
  sessionId?: number | null;
  itemId: number;
  itemName: string;
  oldQty: number;
  newQty: number;
  diffQty: number;
  reason?: string;
  appliedAt: string;
}

export interface AppMeta {
  key: string;
  value: string;
  updatedAt: string;
}

/**
 * Tally batch/godown breakdown: which batch of an item sits at which
 * location (godown/bin) and how much. This is the Tally book-stock mirror -
 * rebuilt on every import. Physical counting adjustments live on Item.systemQty.
 */
export interface StockBatch {
  id?: number;
  itemId: number;
  itemName: string;
  /** Batch code ("" when item has no batch tracking - location-only row) */
  batch: string;
  /** Godown / bin location code e.g. "W1-D9-13", "WH-01 Bhiwandi" */
  location: string;
  qty: number;
  rate?: number;
  value?: number;
}
