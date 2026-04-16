'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  Users,
  Send,
  Tag,
  BarChart3,
  Bot,
  Shield,
  Link2,
  X,
} from 'lucide-react';

const navItems = [
  { href: '/conversations', label: 'สนทนา', icon: MessageSquare },
  { href: '/contacts', label: 'ผู้ติดต่อ', icon: Users },
  { href: '/broadcast', label: 'ประกาศ', icon: Send },
  { href: '/tags', label: 'แท็ก', icon: Tag },
  { href: '/analytics', label: 'สถิติ', icon: BarChart3 },
];

const settingsItems = [
  { href: '/settings/integrations', label: 'เชื่อมต่อระบบ', icon: Link2 },
  { href: '/settings/ai-bot', label: 'AI Bot', icon: Bot },
  { href: '/settings/admins', label: 'ผู้ดูแล', icon: Shield },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();

  const inner = (
    <aside className="flex h-full w-64 flex-shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-brand-600" />
          <span className="text-lg font-bold text-gray-900">Unified Chat</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 md:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">หลัก</p>
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
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <p className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">ตั้งค่า</p>
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
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
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
