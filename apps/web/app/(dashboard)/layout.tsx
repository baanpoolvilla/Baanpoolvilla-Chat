'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const admin = useAuth((s) => s.admin);
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  const isLoading = useAuth((s) => s.isLoading);
  const loadSession = useAuth((s) => s.loadSession);
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    loadSession();
    setReady(true);
  }, [loadSession]);

  useEffect(() => {
    if (ready && !isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [ready, isLoading, isAuthenticated, router]);

  if (!ready || isLoading || !isAuthenticated || !admin) {
    return (
      <div className="min-h-screen bg-slate-100/70 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
