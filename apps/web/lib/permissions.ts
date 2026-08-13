import type { AdminRole } from '@/types';

export const CHAT_VIEWER_ROLE: AdminRole = 'CHAT_VIEWER';

export function isChatViewerRole(role?: AdminRole | string | null): boolean {
  return role === CHAT_VIEWER_ROLE;
}

export function canWriteChat(role?: AdminRole | string | null): boolean {
  return !isChatViewerRole(role);
}

export function getDefaultDashboardRoute(role?: AdminRole | string | null): string {
  return isChatViewerRole(role) ? '/conversations' : '/dashboard';
}

// หน้าตั้งค่าที่ ADMIN เข้าได้ด้วย (นอกนั้นสงวนไว้ให้ SUPER_ADMIN)
const ADMIN_ACCESSIBLE_SETTINGS = ['/settings/chat'];

export function canAccessSettingsPath(role: AdminRole | string | null | undefined, pathname: string): boolean {
  if (role === 'SUPER_ADMIN') return true;
  if (role === 'ADMIN') return ADMIN_ACCESSIBLE_SETTINGS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return false;
}

export function canAccessDashboardPath(role: AdminRole | string | null | undefined, pathname: string): boolean {
  if (!isChatViewerRole(role)) {
    return true;
  }

  return (
    pathname === '/conversations' ||
    pathname.startsWith('/conversations/') ||
    pathname === '/broadcast' ||
    pathname.startsWith('/broadcast/')
  );
}