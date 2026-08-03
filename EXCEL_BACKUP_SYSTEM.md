# FixiProfit Excel Backup System

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     FixiProfit PWA                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         User Actions (Add/Edit/Delete Repair)        │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                   │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              IndexedDB (Dexie.js)                     │  │
│  │   • repairService.add()                               │  │
│  │   • repairService.update()                            │  │
│  │   • repairService.delete()                            │  │
│  │         ↓ Auto-triggers Excel generation              │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                   │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Auto Excel Generation (Lazy Loaded)          │  │
│  │   • ExcelJS library loaded on-demand                  │  │
│  │   • Generates 3-sheet Excel file:                     │  │
│  │     - All Repairs (main data)                         │  │
│  │     - Profit Summary (aggregated stats)               │  │
│  │     - Monthly Breakdown (trends)                      │  │
│  │   • Stored as base64 in IndexedDB                     │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                   │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Google Drive Sync (Optional)             │  │
│  │   • Creates "FixiProfit_Backup" folder                │  │
│  │   • Uploads 3 files:                                  │  │
│  │     - FixiProfit_YYYY-MM-DD.xlsx                      │  │
│  │     - FixiProfit_YYYY-MM-DD.json                      │  │
│  │     - FixiProfit_YYYY-MM-DD.csv                       │  │
│  │   • Also maintains "Latest" versions:                 │  │
│  │     - FixiProfit_Latest.xlsx                          │  │
│  │     - FixiProfit_Latest.json                          │  │
│  │     - FixiProfit_Latest.csv                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Excel File Structure

### Sheet 1: All Repairs
| Column | Description | Format |
|--------|-------------|--------|
| # | Serial Number | Integer |
| Date | Repair Date | DD/MM/YYYY |
| Customer Name | Customer Name | Text |
| Phone | Contact Number | Text |
| Device Type | Smartphone/Tablet/Laptop/etc | Text |
| Device Model | Device Model | Text |
| Problem | Issue Description | Text |
| Repair Cost (₹) | Your Cost | Currency (₹#,##0) |
| Charged Price (₹) | Customer Charged | Currency (₹#,##0) |
| Profit (₹) | Revenue - Cost | Currency (Green if +, Red if -) |
| Status | Repair Status | Text |
| Notes | Additional Notes | Text |

**Summary Row:**
- Total Cost
- Total Revenue
- Net Profit (with color coding)

### Sheet 2: Profit Summary
- Total Repairs
- Total Revenue
- Total Cost
- Net Profit
- Profit Margin (%)
- Average Repair Value
- Pending Repairs Count
- Completed Repairs Count

### Sheet 3: Monthly Breakdown
| Column | Description |
|--------|-------------|
| Month | YYYY-MM |
| Repairs | Count |
| Revenue (₹) | Total for month |
| Cost (₹) | Total for month |
| Profit (₹) | Net for month |

## 🔄 Auto-Sync Behavior

### When Excel is Generated:
1. **On every repair add/edit/delete** (debounced 3 seconds)
2. **On manual backup** (Settings → Backup Now)
3. **On data import** (after importing JSON backup)

### What Happens:
1. Excel file generated using ExcelJS
2. Converted to base64 blob
3. Stored in IndexedDB `appMeta` table
4. If Google Drive connected:
   - Uploads dated version (FixiProfit_YYYY-MM-DD.xlsx)
   - Uploads latest version (FixiProfit_Latest.xlsx)
   - Also uploads JSON and CSV backups
5. Updates UI with last sync timestamp

## 📥 Download Options

### From Settings Page:

1. **Excel File (.xlsx)**
   - Professional formatting with colors
   - 3 sheets with complete data
   - Currency formatting
   - Summary calculations

2. **CSV File (.csv)**
   - Simple comma-separated values
   - Compatible with all spreadsheet apps
   - Lightweight

3. **JSON Backup (.json)**
   - Complete raw data
   - Used for restore/import
   - Machine-readable

## 📤 Import/Restore

### From JSON File:
1. Go to Settings → Import / Restore Data
2. Click "Import from JSON"
3. Select FixiProfit_*.json file
4. All data will be replaced
5. Excel will be regenerated automatically

### From Google Drive:
1. Go to Settings → Google Drive Backup
2. Click "Restore"
3. Downloads FixiProfit_Latest.json
4. Imports all data
5. Regenerates Excel

## 🔒 Data Safety

### Local Storage:
- **Primary**: IndexedDB (repair data)
- **Backup**: IndexedDB (Excel blob as base64)
- **Offline**: 100% functional without internet

### Cloud Storage (Optional):
- **Google Drive**: Excel + JSON + CSV
- **Folder**: FixiProfit_Backup (auto-created)
- **Versions**: Dated + Latest

### Recovery Scenarios:
1. ✅ App reinstalled → Restore from Google Drive
2. ✅ Device changed → Download Excel from Drive, import JSON
3. ✅ Hosting changed → Data stays in Google Drive
4. ✅ GitHub deleted → Data safe in Drive
5. ✅ Internet down → Works offline, syncs when online

## 🎨 Excel Styling

- **Title Row**: Dark background, white text, merged cells
- **Header Row**: Green background (#166534), white bold text
- **Data Rows**: Alternating dark colors (zebra stripe)
- **Currency Columns**: Right-aligned, ₹ symbol, thousand separators
- **Profit Column**: Green for positive, Red for negative
- **Summary Row**: Highlighted with green border
- **Column Widths**: Auto-optimized for readability

## ⚡ Performance

- **ExcelJS Lazy Loading**: Only loaded when export/backup triggered
- **Debounced Generation**: 3-second delay to batch rapid changes
- **Chunked Bundle**: vendor-excel.js (942KB) separate from main bundle
- **IndexedDB Storage**: Fast access to last generated Excel
- **Incremental Sync**: Only uploads changed files

## 📱 User Experience

### Settings Page Shows:
- Google Drive connection status (ON/OFF indicator)
- Auto-sync toggle
- Last sync timestamp
- Excel file info (name, generation time)
- Download buttons (Excel/CSV/JSON)
- Import button (JSON)
- Manual backup/restore buttons

### Visual Feedback:
- Toast notifications for all operations
- Loading spinners during sync
- Success/error messages
- Real-time status updates

## 🛠️ Configuration

### Environment Variables:
```env
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

### Google OAuth Setup:
1. Google Cloud Console
2. Enable Drive API
3. Create OAuth 2.0 credentials
4. Add authorized origins
5. Copy client ID to .env

## 📊 Bundle Size Impact

- **Main Bundle**: ~207KB gzipped (loads immediately)
- **ExcelJS Chunk**: ~272KB gzipped (lazy loaded)
- **Charts Chunk**: ~113KB gzipped (lazy loaded on Reports page)
- **Total Initial Load**: ~207KB (fast startup)
- **Total with Features**: ~592KB (all features loaded)

## 🔮 Future Enhancements

- [ ] Excel import (currently JSON only)
- [ ] PDF export
- [ ] Scheduled auto-backup
- [ ] Multiple Google accounts
- [ ] Excel template customization
- [ ] Cloud sync status dashboard
- [ ] Conflict resolution
- [ ] Version history in Drive

---

**Data is yours. Always. No matter what happens to the app.** 🚀
