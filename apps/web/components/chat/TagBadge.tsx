'use client';

import { cn } from '@/lib/utils';
import { getTagTextColor, withAlpha } from '@/lib/utils';

interface TagBadgeProps {
  name: string;
  color: string;
  size?: 'sm' | 'md';
  onRemove?: () => void;
}

export default function TagBadge({ name, color, size = 'sm', onRemove }: TagBadgeProps) {
  const textColor = getTagTextColor(color);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      )}
      style={{
        backgroundColor: color,
        color: textColor,
        border: `1px solid ${withAlpha(color, 0.9)}`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: withAlpha(textColor, 0.85) }}
      />
      {name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:opacity-70"
        >
          ×
        </button>
      )}
    </span>
  );
}
