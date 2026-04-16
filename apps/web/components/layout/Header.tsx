'use client';

import { useAuth } from '@/hooks/useAuth';
import { LogOut, Bell, User, Menu } from 'lucide-react';

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { admin, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Hamburger — visible on mobile only */}
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 md:hidden"
          aria-label="เปิดเมนู"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            {admin?.avatar ? (
              <img src={admin.avatar} alt="" className="h-8 w-8 rounded-full" />
            ) : (
              <User className="h-4 w-4" />
            )}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900 leading-tight">{admin?.name}</p>
            <p className="text-xs text-gray-500 leading-tight">{admin?.role}</p>
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          title="ออกจากระบบ"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
