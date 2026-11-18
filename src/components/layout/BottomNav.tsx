import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, ScanSearch, History, Settings } from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Home' },
  { path: '/items', icon: Package, label: 'Items' },
  { path: '/verify', icon: ScanSearch, label: 'Verify' },
  { path: '/history', icon: History, label: 'History' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-dark-900/95 backdrop-blur-lg border-t border-dark-700 z-50 lg:hidden">
      <div className="max-w-[1200px] mx-auto flex items-center justify-around py-2 px-2">
        {navItems.map((item) => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path) || (item.path === '/verify' && location.pathname.startsWith('/count'));
          const isVerify = item.path === '/verify';
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="relative flex flex-col items-center gap-1 px-3 py-2 min-w-[56px] cursor-pointer"
              aria-label={item.label}
            >
              {isActive && !isVerify && <div className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-500 rounded-full" />}
              <div className="relative">
                {isVerify ? (
                  <div className={`w-12 h-12 -mt-6 rounded-full flex items-center justify-center shadow-lg transition-colors ${isActive ? 'bg-primary-500 shadow-primary-500/30' : 'bg-dark-700 border border-dark-600'}`}>
                    <item.icon size={24} className={isActive ? 'text-white' : 'text-dark-400'} />
                  </div>
                ) : (
                  <item.icon size={22} className={isActive ? 'text-primary-400' : 'text-dark-400'} />
                )}
              </div>
              {!isVerify && <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-primary-400' : 'text-dark-500'}`}>{item.label}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
