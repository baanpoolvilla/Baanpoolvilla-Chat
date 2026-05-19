'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { canAccessDashboardPath, getDefaultDashboardRoute } from '@/lib/permissions';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const admin = useAuth((s) => s.admin);
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  const isLoading = useAuth((s) => s.isLoading);
  const loadSession = useAuth((s) => s.loadSession);
  const hasSyncedSession = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isConversationDetailRoute = pathname.startsWith('/conversations/');
  const hasPathAccess = canAccessDashboardPath(admin?.role, pathname);

  useEffect(() => {
    if (!hasSyncedSession.current) {
      loadSession();
      hasSyncedSession.current = true;
    }
  }, [loadSession]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && admin && !hasPathAccess) {
      router.replace(getDefaultDashboardRoute(admin.role));
    }
  }, [admin, hasPathAccess, isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated || !admin || !hasPathAccess) {
    return (
      <div className="min-h-screen bg-slate-100/70 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {isConversationDetailRoute ? (
          <div className="hidden md:block">
            <Header onMenuClick={() => setSidebarOpen(true)} />
          </div>
        ) : (
          <Header onMenuClick={() => setSidebarOpen(true)} />
        )}
        <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
