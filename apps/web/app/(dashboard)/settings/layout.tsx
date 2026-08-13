'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { canAccessSettingsPath } from '@/lib/permissions';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const admin = useAuth((s) => s.admin);
  const isLoading = useAuth((s) => s.isLoading);
  const allowed = canAccessSettingsPath(admin?.role, pathname);

  useEffect(() => {
    if (!isLoading && !allowed) {
      router.replace('/dashboard');
    }
  }, [isLoading, allowed, router]);

  if (isLoading || !allowed) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-brand-600" />
      </div>
    );
  }

  return <>{children}</>;
}
