'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const admin = useAuth((s) => s.admin);
  const isLoading = useAuth((s) => s.isLoading);

  useEffect(() => {
    if (!isLoading && admin?.role !== 'SUPER_ADMIN') {
      router.replace('/dashboard');
    }
  }, [isLoading, admin, router]);

  if (isLoading || admin?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-brand-600" />
      </div>
    );
  }

  return <>{children}</>;
}