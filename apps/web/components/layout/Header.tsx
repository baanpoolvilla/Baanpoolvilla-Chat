'use client';

import { useSyncExternalStore } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { AdminRole } from '@/types';
import { LogOut, Bell, User, Menu } from 'lucide-react';

/**
 * เปิดอยู่ในกรอบของ SmartBoss (app.smartboss.in.th → ขาย & การตลาด) — SmartBoss มีแถบบน
 * (แจ้งเตือน/โปรไฟล์/ออกจากระบบ) อยู่แล้ว แถบของเราจะซ้ำ เลยซ่อน
 * ฝั่งเซิร์ฟเวอร์ = false (ไม่อยู่ในกรอบ) แล้วเบราว์เซอร์ค่อยอัปเดต — ไม่เพี้ยนตอน hydrate
 */
function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // เข้าถึง window.top ไม่ได้ = อยู่ในกรอบของเว็บอื่นแน่นอน
  }
}
function useEmbedded(): boolean {
  return useSyncExternalStore(
    () => () => {},
    isEmbedded,
    () => false
  );
}

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { admin, logout } = useAuth();
  const roleLabels: Record<AdminRole, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Admin',
    AGENT: 'Agent',
    CHAT_VIEWER: 'Chat Viewer',
  };
  const roleLabel = admin?.role ? roleLabels[admin.role] ?? admin.role : '';
  const embedded = useEmbedded();

  // ในกรอบของ SmartBoss: คอมไม่ต้องมีแถบนี้เลย · มือถือเหลือแค่ปุ่มเมนู (☰) ไว้เปิดแถบข้าง
  if (embedded) {
    return (
      <header className="sticky top-0 z-30 flex h-12 items-center border-b border-orange-100 bg-white/85 px-2 backdrop-blur md:hidden">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-600 hover:bg-orange-50"
          aria-label="เปิดเมนู"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-orange-100 bg-white/85 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        {/* Hamburger — visible on mobile only */}
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-600 hover:bg-orange-50 md:hidden"
          aria-label="เปิดเมนู"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative rounded-lg p-2 text-slate-500 hover:bg-orange-50 hover:text-slate-700">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-200 to-orange-100 text-orange-700">
            {admin?.avatar ? (
              <img src={admin.avatar} alt="" className="h-8 w-8 rounded-full" />
            ) : (
              <User className="h-4 w-4" />
            )}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900 leading-tight">{admin?.name}</p>
            <p className="text-xs text-gray-500 leading-tight">{roleLabel}</p>
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="rounded-lg p-2 text-slate-500 hover:bg-orange-50 hover:text-slate-700"
          title="ออกจากระบบ"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
