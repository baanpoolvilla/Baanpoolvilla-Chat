'use client';

import { cn } from '@/lib/utils';
import type { Message, Platform } from '@/types';
import { format } from 'date-fns';
import { Bot, Download, X } from 'lucide-react';
import PlatformBadge from '@/components/common/PlatformBadge';
import { useState } from 'react';

interface MessageBubbleProps {
  message: Message;
  customerName?: string;
  customerAvatarUrl?: string;
  customerPlatform?: Platform;
}

export default function MessageBubble({
  message,
  customerName,
  customerAvatarUrl,
  customerPlatform,
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
      <div className="flex justify-center py-2">
        <span className="rounded-full bg-gray-100 px-4 py-1 text-xs text-gray-500">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex gap-2 message-enter',
        isCustomer ? 'justify-start' : 'justify-end'
      )}
    >
      {isCustomer && (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium">
          {customerAvatarUrl ? (
            <img src={customerAvatarUrl} alt={fallbackCustomerName} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            fallbackInitial
          )}
        </div>
      )}

      <div
        className={cn(
          'max-w-[70%] rounded-2xl px-4 py-2',
          isCustomer && 'bg-gray-100 text-gray-900 rounded-bl-md',
          isAdmin && 'bg-brand-600 text-white rounded-br-md',
          isBot && 'bg-purple-100 text-purple-900 rounded-br-md'
        )}
      >
        {/* Sender label */}
        <div className={cn(
          'mb-0.5 flex items-center gap-1 text-[10px]',
          isCustomer ? 'text-gray-400' : isBot ? 'text-purple-400' : 'text-brand-200'
        )}>
          {isBot && <Bot className="h-3 w-3" />}
          {isBot ? 'AI Bot' : isAdmin ? message.admin?.name || 'Admin' : fallbackCustomerName}
          {isCustomer && customerPlatform && (
            <PlatformBadge platform={customerPlatform} compact showLabel={false} className="ml-1" />
          )}
        </div>

        {/* Content */}
        {renderContent(message, setLightboxUrl)}

        {/* Timestamp */}
        <div className={cn(
          'mt-1 text-[10px]',
          isCustomer ? 'text-gray-400' : isBot ? 'text-purple-400' : 'text-brand-200'
        )}>
          {format(new Date(message.sentAt), 'HH:mm')}
        </div>
      </div>

      {(isAdmin || isBot) && (
        <div className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium',
          isBot ? 'bg-purple-200 text-purple-700' : 'bg-brand-200 text-brand-700'
        )}>
          {isBot ? <Bot className="h-4 w-4" /> : message.admin?.name?.charAt(0) || 'A'}
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

function renderContent(message: Message, onImageClick: (url: string) => void) {
  switch (message.contentType) {
    case 'IMAGE':
      return (
        <div>
          {message.mediaUrl && (
            <img
              src={message.mediaUrl}
              alt="Image"
              className="max-w-full rounded-lg mt-1 cursor-pointer hover:opacity-90 transition-opacity"
              style={{ maxHeight: 300 }}
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
              className="max-w-full rounded-lg mt-1"
              style={{ maxHeight: 300 }}
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
            style={{ width: 100, height: 100, objectFit: 'contain' }}
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
      return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>;
  }
}
