import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { BackupProvider } from '@/context/BackupContext';

const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const History = lazy(() => import('@/pages/History').then(m => ({ default: m.History })));
const AddRepair = lazy(() => import('@/pages/AddRepair').then(m => ({ default: m.AddRepair })));
const Reports = lazy(() => import('@/pages/Reports').then(m => ({ default: m.Reports })));
const EditRepair = lazy(() => import('@/pages/EditRepair').then(m => ({ default: m.EditRepair })));
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <BackupProvider>
      <BrowserRouter>
        <Layout>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/history" element={<History />} />
              <Route path="/add" element={<AddRepair />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/edit/:id" element={<EditRepair />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      </BrowserRouter>
    </BackupProvider>
  );
}
