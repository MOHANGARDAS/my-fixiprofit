import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-dark-900">
      {/* Desktop: Full width dark background with centered content */}
      <div className="w-full max-w-[1200px] mx-auto flex flex-col min-h-screen min-h-[100dvh] bg-dark-900 lg:border-x lg:border-dark-700">
        <Header />
        <div className="flex flex-1">
          {/* Desktop Sidebar */}
          <Sidebar />
          <main className="flex-1 pb-20 lg:pb-6 px-4 lg:px-6 pt-2 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
      {/* Mobile Bottom Nav - hidden on desktop */}
      <BottomNav />
    </div>
  );
}
