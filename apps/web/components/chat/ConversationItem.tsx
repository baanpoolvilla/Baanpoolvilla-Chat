'use client';

import type { Conversation } from '@/types';
import { cn, formatTimeAgo, truncate, getPlatformIcon } from '@/lib/utils';
import TagBadge from './TagBadge';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

export default function ConversationItem({ conversation, isActive, onClick }: ConversationItemProps) {
  const { contact, platform, lastMessage, lastMsgAt, unreadCount, tags, assignments, priority, isBot } = conversation;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors',
        isActive ? 'bg-brand-50 border border-brand-200' : 'hover:bg-gray-50 border border-transparent'
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-medium">
          {contact.avatarUrl ? (
            <img src={contact.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            contact.displayName.charAt(0).toUpperCase()
          )}
        </div>
        <span
          className="absolute -bottom-0.5 -right-0.5 text-xs"
          title={platform}
        >
          {getPlatformIcon(platform)}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="truncate text-sm font-semibold text-gray-900">
            {contact.displayName}
          </h4>
          <span className="flex-shrink-0 text-xs text-gray-400">
            {lastMsgAt ? formatTimeAgo(lastMsgAt) : ''}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="truncate text-xs text-gray-500">
            {isBot && <span className="text-purple-500 font-medium">🤖 </span>}
            {lastMessage ? truncate(lastMessage, 50) : 'No messages yet'}
          </p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {priority === 'URGENT' && (
              <span className="h-2 w-2 rounded-full bg-red-500" title="Urgent" />
            )}
            {priority === 'HIGH' && (
              <span className="h-2 w-2 rounded-full bg-orange-500" title="High" />
            )}
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {tags.slice(0, 2).map((ct) => (
              <TagBadge key={ct.tagId} name={ct.tag.name} color={ct.tag.color} size="sm" />
            ))}
            {tags.length > 2 && (
              <span className="text-[10px] text-gray-400">+{tags.length - 2}</span>
            )}
          </div>
        )}

        {/* Assigned admin */}
        {assignments && assignments.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            {assignments.slice(0, 1).map((a) => (
              <span key={a.id} className="text-[10px] text-gray-400">
                → {a.admin.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
