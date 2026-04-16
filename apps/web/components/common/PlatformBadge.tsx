'use client';

import { FaFacebook, FaInstagram, FaLine, FaTiktok } from 'react-icons/fa6';
import { MessageCircle } from 'lucide-react';
import { cn, getPlatformColor, withAlpha } from '@/lib/utils';
import type { Platform } from '@/types';

interface PlatformBadgeProps {
  platform: Platform;
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
}

const labelByPlatform: Record<Platform, string> = {
  LINE: 'LINE',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  MANUAL: 'Manual',
};

function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  switch (platform) {
    case 'LINE':
      return <FaLine className={className} />;
    case 'FACEBOOK':
      return <FaFacebook className={className} />;
    case 'INSTAGRAM':
      return <FaInstagram className={className} />;
    case 'TIKTOK':
      return <FaTiktok className={className} />;
    default:
      return <MessageCircle className={className} />;
  }
}

export default function PlatformBadge({
  platform,
  compact = false,
  showLabel = true,
  className,
}: PlatformBadgeProps) {
  const accent = getPlatformColor(platform);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        compact ? 'gap-1 px-2 py-0.5 text-[10px]' : 'gap-1.5 px-2.5 py-1 text-xs',
        className
      )}
      style={{
        borderColor: withAlpha(accent, 0.3),
        backgroundColor: withAlpha(accent, 0.12),
        color: accent,
      }}
      title={labelByPlatform[platform]}
    >
      <PlatformIcon platform={platform} className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {showLabel && <span>{labelByPlatform[platform]}</span>}
    </span>
  );
}
