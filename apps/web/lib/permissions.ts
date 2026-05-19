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

export function canAccessDashboardPath(role: AdminRole | string | null | undefined, pathname: string): boolean {
  if (!isChatViewerRole(role)) {
    return true;
  }

  return pathname === '/conversations' || pathname.startsWith('/conversations/');
}