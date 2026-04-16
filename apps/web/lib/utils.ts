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

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(normalized)) {
    return null;
  }

  const full = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;

  const int = parseInt(full, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(107, 114, 128, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function getTagTextColor(backgroundHex: string): '#111827' | '#ffffff' {
  const rgb = hexToRgb(backgroundHex);
  if (!rgb) return '#111827';

  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.58 ? '#111827' : '#ffffff';
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
