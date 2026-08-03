# FixiProfit - Repair Shop Management PWA

A Progressive Web App for managing repair shop operations, built with React 19, TypeScript, and Vite.

## Features

- 📱 **PWA** - Installable, works offline, standalone mode
- 📊 **Dashboard** - Quick stats, revenue, profit overview
- 🔧 **Add Repair** - Record new repairs with all details
- 📋 **History** - Search, filter, and manage all repairs
- 📈 **Reports** - Profit analysis with charts and custom date ranges
- 💾 **Offline Storage** - IndexedDB (Dexie) for local data
- ☁️ **Google Drive Backup** - Auto sync data to cloud (optional)
- 📅 **Custom Date Range** - Filter reports and history by any date range
- 🎨 **Dark Theme** - Modern dark UI matching the original app
- 📱 **Responsive** - Mobile-first with desktop sidebar support

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Dexie** - IndexedDB wrapper for offline storage
- **React Router** - Navigation
- **Framer Motion** - Animations
- **Recharts** - Charts for reports
- **Lucide React** - Icons
- **vite-plugin-pwa** - PWA support with Workbox

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

## Google Drive Backup Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the Google Drive API
4. Create OAuth 2.0 credentials (Web application)
5. Add your app's URL to authorized origins
6. Copy the Client ID
7. Create a `.env` file:

```
VITE_GOOGLE_CLIENT_ID=your-client-id-here
```

## Project Structure

```
src/
├── components/          # Reusable components
│   ├── layout/         # Layout components (Header, BottomNav, Sidebar)
│   ├── RepairCard.tsx
│   ├── ProfitChart.tsx
│   └── DeviceChart.tsx
├── context/            # React Context providers
│   └── BackupContext.tsx
├── database/           # Database layer
│   └── db.ts          # Dexie database & repair service
├── hooks/              # Custom React hooks
│   ├── useRepairs.ts
│   └── useInstallPrompt.ts
├── pages/              # Page components (lazy-loaded)
│   ├── Dashboard.tsx
│   ├── History.tsx
│   ├── AddRepair.tsx
│   ├── EditRepair.tsx
│   ├── Reports.tsx
│   └── Settings.tsx
├── types/              # TypeScript types
├── utils/              # Utility functions
│   ├── dateUtils.ts
│   └── googleDrive.ts
├── App.tsx
├── main.tsx
└── index.css
```

## PWA Features

- ✅ Install prompt
- ✅ Offline support
- ✅ Service Worker with Workbox
- ✅ Static asset caching
- ✅ App shell caching
- ✅ Manifest with icons
- ✅ Standalone display mode

## License

Private - FixiProfit
