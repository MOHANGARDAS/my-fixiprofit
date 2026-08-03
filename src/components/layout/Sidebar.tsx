import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Clock, PlusCircle, BarChart3, Settings, Wrench } from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'Dashboard' },
  { path: '/history', icon: Clock, label: 'History' },
  { path: '/add', icon: PlusCircle, label: 'Add Repair' },
  { path: '/reports', icon: BarChart3, label: 'Reports' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside className="hidden lg:flex flex-col w-60 bg-dark-800/50 border-r border-dark-700 py-5 sticky top-[52px] h-[calc(100dvh-52px)]">
      {/* Logo */}
      <div className="px-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20">
            <Wrench size={18} className="text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-white">FixiProfit</span>
            <p className="text-[10px] text-dark-500">Repair Manager</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                  : 'text-dark-400 hover:text-white hover:bg-dark-700/50'
              }`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 pt-4 border-t border-dark-700/50">
        <p className="text-[10px] text-dark-600">FixiProfit v1.0.0</p>
        <p className="text-[10px] text-dark-600">Repair Shop PWA</p>
      </div>
    </aside>
  );
}
