'use client';

import { memo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Message, Platform } from '@/types';
import { format } from 'date-fns';
import { Bot, Download, Pin, X } from 'lucide-react';
import PlatformBadge from '@/components/common/PlatformBadge';
import { getReplyPreviewText, getReplySenderLabel } from '@/lib/messageReply';

interface MessageBubbleProps {
  message: Message;
  customerName?: string;
  customerAvatarUrl?: string;
  customerPlatform?: Platform;
  canReply?: boolean;
  canPin?: boolean;
  onContextMenu?: (e: React.MouseEvent, message: Message) => void;
  highlight?: string;
  isCurrentMatch?: boolean;
  /** ข้อความนี้ส่งต่อเนื่องจากคนเดิม — ซ่อน avatar + ชื่อ ลด margin */
  isGrouped?: boolean;
  /** ข้อความสุดท้ายในกลุ่ม — แสดง avatar */
  isLastInGroup?: boolean;
}

function highlightText(text: string, query: string) {
  if (!query) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-300 text-gray-900 rounded-sm px-0.5">{part}</mark>
        ) : (
          part
        )
      )}
    </>
  );
}

function MessageBubble({
  message,
  customerName,
  customerAvatarUrl,
  customerPlatform,
  canReply = false,
  canPin = false,
  onContextMenu,
  highlight,
  isCurrentMatch,
  isGrouped = false,
  isLastInGroup = true,
}: MessageBubbleProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const isCustomer = message.senderType === 'CUSTOMER';
  const isBot = message.senderType === 'BOT';
  const isSystem = message.senderType === 'SYSTEM';
  const isAdmin = message.senderType === 'ADMIN';
  const fallbackCustomerName = customerName || 'Customer';
  const fallbackInitial = fallbackCustomerName.charAt(0).toUpperCase();

  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-gray-100 px-4 py-1 text-xs text-gray-500">
          {message.content}
        </span>
      </div>
    );
  }

  const showAvatar = isLastInGroup;
  const showSenderLabel = !isGrouped;

  return (
    <div
      className={cn(
        'group flex items-end gap-2',
        isCustomer ? 'justify-start' : 'justify-end',
        isGrouped ? 'mt-0.5' : 'mt-3'
      )}
    >
      {/* Customer avatar */}
      {isCustomer && (
        <div className={cn(
          'h-8 w-8 flex-shrink-0 rounded-full bg-gray-200 text-xs font-medium hidden sm:flex items-center justify-center overflow-hidden',
          !showAvatar && 'invisible'
        )}>
          {customerAvatarUrl ? (
            <img src={customerAvatarUrl} alt={fallbackCustomerName} className="h-full w-full object-cover" loading="lazy" decoding="async" />
          ) : (
            fallbackInitial
          )}
        </div>
      )}

      {/* Bubble wrapper — max-width อยู่ที่นี่ */}
      <div className={cn(
        'relative min-w-0 max-w-[72%] sm:max-w-[60%]',
        isCustomer ? 'items-start' : 'items-end'
      )}>
        {/* Pin badge */}
        {message.isPinned && (
          <div className={cn(
            'absolute -top-2 z-10 flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700',
            isCustomer ? 'left-2' : 'right-2'
          )}>
            <Pin className="h-2.5 w-2.5" />
            ปักหมุด
          </div>
        )}

        <div
          onContextMenu={onContextMenu ? (e) => { e.preventDefault(); onContextMenu(e, message); } : undefined}
          className={cn(
            'rounded-2xl px-3 py-2 sm:px-4 transition-shadow cursor-default select-text',
            isCustomer && 'bg-white text-gray-900 rounded-bl-sm shadow-sm border border-gray-100',
            isAdmin && 'bg-brand-600 text-white rounded-br-sm',
            isBot && 'bg-purple-100 text-purple-900 rounded-br-sm',
            isCurrentMatch && 'ring-2 ring-yellow-400 ring-offset-1'
          )}
        >
          {/* Sender label — ซ่อนเมื่อ grouped */}
          {showSenderLabel && (
            <div className={cn(
              'mb-0.5 flex items-center gap-1 text-[10px] font-medium',
              isCustomer ? 'text-gray-400' : isBot ? 'text-purple-400' : 'text-brand-200'
            )}>
              {isBot && <Bot className="h-3 w-3" />}
              {isBot ? 'AI Bot' : isAdmin ? (message.admin?.name || 'Admin') : fallbackCustomerName}
              {isCustomer && customerPlatform && (
                <PlatformBadge platform={customerPlatform} compact showLabel={false} className="ml-1" />
              )}
            </div>
          )}

          {/* Reply preview */}
          {message.replyToMessage && (
            <div className={cn(
              'mb-2 rounded-xl border-l-2 px-3 py-1.5',
              isCustomer && 'border-gray-300 bg-gray-50 text-gray-700',
              isAdmin && 'border-white/40 bg-white/10 text-brand-50',
              isBot && 'border-purple-300 bg-purple-50 text-purple-800'
            )}>
              <p className={cn(
                'text-[10px] font-semibold',
                isCustomer ? 'text-gray-500' : isAdmin ? 'text-brand-100' : 'text-purple-500'
              )}>
                {getReplySenderLabel(message.replyToMessage, customerName)}
              </p>
              {message.replyToMessage.contentType === 'IMAGE' && message.replyToMessage.mediaUrl ? (
                <img
                  src={message.replyToMessage.mediaUrl}
                  alt="Photo"
                  className="mt-1 h-12 w-12 rounded-md object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <p className="mt-0.5 line-clamp-2 text-xs opacity-80">
                  {getReplyPreviewText(message.replyToMessage)}
                </p>
              )}
            </div>
          )}

          {/* Content */}
          {renderContent(message, setLightboxUrl, highlight)}

          {/* Timestamp */}
          <div className={cn(
            'mt-1 text-[10px] flex items-center gap-1',
            isCustomer ? 'text-gray-400 justify-start' : isBot ? 'text-purple-400 justify-end' : 'text-brand-200 justify-end'
          )}>
            {format(new Date(message.sentAt), 'HH:mm')}
          </div>
        </div>
      </div>

      {/* Admin / Bot avatar */}
      {(isAdmin || isBot) && (
        <div className={cn(
          'h-8 w-8 flex-shrink-0 rounded-full text-xs font-medium hidden sm:flex items-center justify-center overflow-hidden',
          isBot ? 'bg-purple-200 text-purple-700' : 'bg-brand-100 text-brand-700',
          !showAvatar && 'invisible'
        )}>
          {isBot ? (
            <Bot className="h-4 w-4" />
          ) : message.admin?.avatar ? (
            <img src={message.admin.avatar} alt={message.admin.name} className="h-full w-full object-cover" loading="lazy" decoding="async" />
          ) : (
            message.admin?.name?.charAt(0).toUpperCase() || 'A'
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-8 w-8" />
          </button>
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function renderContent(message: Message, onImageClick: (url: string) => void, highlight?: string) {
  switch (message.contentType) {
    case 'IMAGE':
      return (
        <div>
          {message.mediaUrl && (
            <img
              src={message.mediaUrl}
              alt="Image"
              className="max-w-full rounded-xl mt-1 cursor-pointer hover:opacity-90 transition-opacity"
              style={{ maxHeight: 280 }}
              loading="lazy"
              decoding="async"
              onClick={() => onImageClick(message.mediaUrl!)}
            />
          )}
          {message.content !== '[Image]' && <p className="text-sm mt-1">{message.content}</p>}
        </div>
      );
    case 'VIDEO':
      return (
        <div>
          {message.mediaUrl && (
            <video
              src={message.mediaUrl}
              controls
              className="max-w-full rounded-xl mt-1"
              style={{ maxHeight: 280 }}
            />
          )}
        </div>
      );
    case 'FILE':
      return (
        <a
          href={message.mediaUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm underline"
        >
          <Download className="h-4 w-4" />
          {message.content}
        </a>
      );
    case 'STICKER': {
      const match = message.content.match(/\[Sticker:\s*(\d+)\/(\d+)\]/);
      if (match) {
        const stickerId = match[2];
        const stickerUrl = `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/android/sticker.png`;
        return (
          <img
            src={stickerUrl}
            alt="Sticker"
            className="mt-1 cursor-pointer hover:opacity-90 transition-opacity"
            style={{ width: 96, height: 96, objectFit: 'contain' }}
            loading="lazy"
            decoding="async"
            onClick={() => onImageClick(stickerUrl)}
          />
        );
      }
      return <p className="text-2xl">{message.content}</p>;
    }
    case 'LOCATION':
      try {
        const loc = JSON.parse(message.content);
        return (
          <div className="text-sm">
            <p className="font-medium">📍 {loc.title || 'Location'}</p>
            {loc.address && <p className="text-xs opacity-70">{loc.address}</p>}
          </div>
        );
      } catch {
        return <p className="text-sm">{message.content}</p>;
      }
    default:
      return (
        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {highlight ? highlightText(message.content, highlight) : message.content}
        </p>
      );
  }
}

export default memo(MessageBubble);
