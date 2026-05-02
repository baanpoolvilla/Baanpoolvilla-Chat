'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  MessageSquare,
  Send,
  Tag,
  Shield,
  Link2,
  KeyRound,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { href: '/dashboard', label: 'แดชบอร์ด', icon: LayoutDashboard },
  { href: '/conversations', label: 'สนทนา', icon: MessageSquare },
  { href: '/broadcast', label: 'ประกาศ', icon: Send },
  { href: '/tags', label: 'แท็ก', icon: Tag },
];

const settingsItems = [
  { href: '/settings/integrations', label: 'เชื่อมต่อระบบ', icon: Link2 },
  { href: '/settings/password', label: 'เปลี่ยนรหัสผ่าน', icon: KeyRound },
  { href: '/settings/admins', label: 'ผู้ดูแล', icon: Shield },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const admin = useAuth((s) => s.admin);
  const isSuperAdmin = admin?.role === 'SUPER_ADMIN';

  const inner = (
    <aside className="flex h-full w-64 flex-shrink-0 flex-col border-r border-slate-900/60 bg-slate-950 text-slate-100">
      <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-slate-900 ring-1 ring-slate-700/80">
            <img src="/logo.png" alt="Baanpool-Chat" className="h-9 w-9 object-cover" />
          </div>
          <div>
            <span className="block text-sm font-semibold leading-tight text-orange-50">Baanpool-Chat</span>
            <span className="block text-[11px] text-slate-400">Management Console</span>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 md:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">หลัก</p>
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gradient-to-r from-orange-500/25 to-orange-400/10 text-orange-100 ring-1 ring-orange-400/30'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}

        {isSuperAdmin && (
          <>
            <p className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">ตั้งค่า</p>
            {settingsItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-gradient-to-r from-orange-500/25 to-orange-400/10 text-orange-100 ring-1 ring-orange-400/30'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>
    </aside>
  );

  return (
    <>
      {/* Desktop: sticky sidebar in flex flow */}
      <div className="hidden md:block sticky top-0 h-screen w-64 flex-shrink-0">
        {inner}
      </div>

      {/* Mobile: overlay drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={onClose} />
          <div className="relative z-50 h-full w-64 shadow-xl">
            {inner}
          </div>
        </div>
      )}
    </>
  );
}
