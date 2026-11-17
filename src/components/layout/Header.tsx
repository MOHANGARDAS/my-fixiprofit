import { useLocation } from 'react-router-dom';
import { PackageCheck } from 'lucide-react';

export function pageTitle(pathname: string): string {
  if (pathname === '/') return 'StockVerify';
  if (pathname === '/items') return 'Stock Items';
  if (pathname === '/items/new') return 'Add Item';
  if (pathname.startsWith('/items/')) return 'Edit Item';
  if (pathname === '/import') return 'Tally Import';
  if (pathname === '/count') return 'Count Sessions';
  if (pathname.match(/^\/count\/\d+\/review$/)) return 'Review & Adjust';
  if (pathname.startsWith('/count/')) return 'Physical Count';
  if (pathname === '/history') return 'History';
  if (pathname === '/settings') return 'Settings';
  return 'StockVerify';
}

export function Header() {
  const location = useLocation();
  const title = pageTitle(location.pathname);

  return (
    <header className="sticky top-0 z-40 bg-dark-900/95 backdrop-blur-lg border-b border-dark-700">
      <div className="flex items-center justify-between px-4 lg:px-6 py-3">
        <div className="flex items-center gap-3">
          {location.pathname === '/' && (
            <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20 lg:hidden">
              <PackageCheck size={18} className="text-white" />
            </div>
          )}
          <h1 className="text-lg font-bold text-white">{title}</h1>
        </div>
        <div className="text-xs text-dark-400 font-medium lg:hidden">
          StockVerify
        </div>
      </div>
    </header>
  );
}
