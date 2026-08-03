import { useLocation } from 'react-router-dom';
import { Wrench } from 'lucide-react';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/history': 'History',
  '/add': 'Add Repair',
  '/reports': 'Reports',
  '/settings': 'Settings',
};

export function Header() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'FixiProfit';
  const isEdit = location.pathname.startsWith('/edit');

  return (
    <header className="sticky top-0 z-40 bg-dark-900/95 backdrop-blur-lg border-b border-dark-700">
      <div className="flex items-center justify-between px-4 lg:px-6 py-3">
        <div className="flex items-center gap-3">
          {/* Logo - only show on mobile (sidebar has it on desktop) */}
          {location.pathname === '/' && (
            <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20 lg:hidden">
              <Wrench size={18} className="text-white" />
            </div>
          )}
          <h1 className="text-lg font-bold text-white">
            {isEdit ? 'Edit Repair' : title}
          </h1>
        </div>
        {/* Only show branding on mobile */}
        <div className="text-xs text-dark-400 font-medium lg:hidden">
          FixiProfit
        </div>
      </div>
    </header>
  );
}
