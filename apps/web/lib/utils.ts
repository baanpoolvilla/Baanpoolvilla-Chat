import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}

export function getPlatformColor(platform: string): string {
  const colors: Record<string, string> = {
    LINE: '#06C755',
    FACEBOOK: '#1877F2',
    INSTAGRAM: '#E4405F',
    TIKTOK: '#000000',
    MANUAL: '#6B7280',
  };
  return colors[platform] || '#6B7280';
}

export function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = {
    LINE: '💚',
    FACEBOOK: '🔵',
    INSTAGRAM: '📸',
    TIKTOK: '🎵',
    MANUAL: '💬',
  };
  return icons[platform] || '💬';
}

export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    LOW: 'text-gray-400',
    NORMAL: 'text-blue-500',
    HIGH: 'text-orange-500',
    URGENT: 'text-red-500',
  };
  return colors[priority] || 'text-gray-400';
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    OPEN: 'bg-green-100 text-green-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    RESOLVED: 'bg-gray-100 text-gray-800',
    SNOOZED: 'bg-blue-100 text-blue-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}
