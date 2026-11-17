import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { BackupProvider } from '@/context/BackupContext';

const Home = lazy(() => import('@/pages/Home').then(m => ({ default: m.Home })));
const Items = lazy(() => import('@/pages/Items').then(m => ({ default: m.Items })));
const ItemForm = lazy(() => import('@/pages/ItemForm').then(m => ({ default: m.ItemForm })));
const TallyImport = lazy(() => import('@/pages/TallyImport').then(m => ({ default: m.TallyImport })));
const CountSessions = lazy(() => import('@/pages/CountSessions').then(m => ({ default: m.CountSessions })));
const CountActive = lazy(() => import('@/pages/CountActive').then(m => ({ default: m.CountActive })));
const CountReview = lazy(() => import('@/pages/CountReview').then(m => ({ default: m.CountReview })));
const History = lazy(() => import('@/pages/History').then(m => ({ default: m.History })));
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
              <Route path="/" element={<Home />} />
              <Route path="/items" element={<Items />} />
              <Route path="/items/new" element={<ItemForm />} />
              <Route path="/items/:id/edit" element={<ItemForm />} />
              <Route path="/import" element={<TallyImport />} />
              <Route path="/count" element={<CountSessions />} />
              <Route path="/count/:id" element={<CountActive />} />
              <Route path="/count/:id/review" element={<CountReview />} />
              <Route path="/history" element={<History />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      </BrowserRouter>
    </BackupProvider>
  );
}
