# StockVerify - Inventory & Physical Stock Verification PWA

A Progressive Web App for **inventory management with physical stock verification**, built with React 19, TypeScript, and Vite.

## Workflow

```
Tally Export (Excel/CSV)  →  Import  →  Stock Items (book stock)
                                              ↓
                              Start Count Session (physical visit)
                                              ↓
                              Count items one by one (count sheet)
                                              ↓
                              Review differences (shortage/excess)
                                              ↓
                              Apply → System qty = physical qty (logged)
```

## Features

- 📥 **Tally Import** - Stock Summary export (Excel/CSV) import with smart column auto-detection, preview, and Replace/Merge modes
- 📦 **Stock Items** - Item master with group, unit, rate, HSN; search + group filters
- ✅ **Physical Count Sessions** - Snapshot-based counting with pending/counted tabs, count sheet, and live difference display
- 🔍 **Review & Adjust** - Shortage/excess summary (qty + value), apply adjustments in one tap (counted qty becomes the new system qty)
- 🧾 **Audit Trail** - Every quantity change is logged (old → new, reason, session reference)
- 📊 **Dashboard** - Items, total qty, stock value, never-counted items, active session progress
- 💾 **Offline Storage** - IndexedDB (Dexie) - works fully offline
- ☁️ **Google Drive Backup** - JSON (restore) + Excel + CSV uploaded daily at 2 AM (optional)
- 📱 **PWA** - Installable, offline-ready, standalone mode
- 🌓 **Dark Theme** - Mobile-first UI

## Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS** - styling
- **Dexie** (IndexedDB) + dexie-react-hooks - live offline data
- **ExcelJS** - Tally file parsing + Excel report generation
- **React Router** - navigation
- **Framer Motion** - animations
- **vite-plugin-pwa** - PWA support

## Project Structure

```
src/
├── components/layout/     # Header, Sidebar, BottomNav
├── context/
│   └── BackupContext.tsx  # Google Drive backup + file export/import
├── database/
│   └── db.ts              # Dexie schema + item/session/import services
├── hooks/
│   └── useStock.ts        # Live queries (items, sessions, stats)
├── pages/
│   ├── Home.tsx           # Dashboard: stats + quick actions
│   ├── Items.tsx          # Stock item list (search/filter)
│   ├── ItemForm.tsx       # Add/edit item + manual adjustment
│   ├── TallyImport.tsx    # File upload → parse preview → import mode
│   ├── CountSessions.tsx  # Session list + new session
│   ├── CountActive.tsx    # Live counting screen (count sheet)
│   ├── CountReview.tsx    # Differences + apply adjustments
│   ├── History.tsx        # Sessions / adjustments / import logs
│   └── Settings.tsx       # Drive backup, downloads, reset
├── types/index.ts         # Item, CountSession, CountEntry, StockAdjustment...
└── utils/
    ├── tallyParser.ts     # Tolerant Tally CSV/XLSX parser
    ├── inventoryExport.ts # Excel/CSV/JSON generation
    ├── dateUtils.ts       # formatters
    └── googleDrive.ts     # Drive backup service
```

## Getting Started

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Tally Export Guide

1. Tally me **Stock Summary** open karein (Display → Inventory Books → Stock Summary)
2. Period set karein (jahan tak closing balance chahiye)
3. **Alt+E** → Export, format **Excel** ya **CSV** choose karein
4. App me **Tally Import** → file choose → preview check → **Replace** ya **Merge**

Parser auto-detects: item name, quantity (incl. "150 Pc" style), unit, rate, HSN, group. Total/opening rows aur group-header rows automatically skip hote hain.

## Google Drive Backup Setup

1. [Google Cloud Console](https://console.cloud.google.com/) me project banayein
2. **Google Drive API** enable karein
3. OAuth 2.0 credentials (Web application) banayein - app URL authorized origins me add karein
4. Client ID ko `.env` me daalein:

```
VITE_GOOGLE_CLIENT_ID=your-client-id-here
```

Backup me 3 files upload hoti hain: `StockVerify_Latest.json` (real backup/restore), `.xlsx`, `.csv`.

## License

Private - StockVerify
