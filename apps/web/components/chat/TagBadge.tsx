'use client';

import { cn } from '@/lib/utils';
import { getTagTextColor, withAlpha } from '@/lib/utils';

interface TagBadgeProps {
  name: string;
  color: string;
  description?: string | null;
  size?: 'sm' | 'md';
  onRemove?: () => void;
}

export default function TagBadge({ name, color, description, size = 'sm', onRemove }: TagBadgeProps) {
  const textColor = getTagTextColor(color);

  return (
    <span className="relative group/tag inline-flex">
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
          className="h-1.5 w-1.5 rounded-full flex-shrink-0"
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

      {/* Tooltip */}
      {description && (
        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50
          hidden group-hover/tag:block
          w-max max-w-[200px] rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg
          whitespace-pre-wrap break-words text-center leading-relaxed">
          {description}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}
