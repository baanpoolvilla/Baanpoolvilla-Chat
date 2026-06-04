'use client';

import { memo, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { Message, Platform } from '@/types';
import { format } from 'date-fns';
import { Bot, Download, ExternalLink, Globe, Pin, X } from 'lucide-react';
import PlatformBadge from '@/components/common/PlatformBadge';
import { getReplyPreviewText, getReplySenderLabel } from '@/lib/messageReply';
import { createFallbackLinkPreview, extractUrls, normalizeUrl, type LinkPreviewData } from '@/lib/linkPreview';

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

type MessageTone = 'customer' | 'admin' | 'bot';

const linkPreviewCache = new Map<string, LinkPreviewData>();

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

function getLinkClassName(tone: MessageTone) {
  switch (tone) {
    case 'customer':
      return 'cursor-pointer break-all font-medium text-blue-600 underline decoration-blue-500/70 underline-offset-2 hover:text-blue-700';
    case 'bot':
      return 'cursor-pointer break-all font-medium text-purple-700 underline decoration-purple-500/70 underline-offset-2 hover:text-purple-800';
    default:
      return 'cursor-pointer break-all font-medium text-white underline decoration-white/80 underline-offset-2 hover:opacity-90';
  }
}

function renderTextWithLinks(text: string, query?: string, tone: MessageTone = 'customer') {
  const parts = text.split(/(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi);

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null;

        if (part.match(/^(https?:\/\/|www\.)/i)) {
          const href = normalizeUrl(part);
          return (
            <a
              key={`${part}-${index}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={getLinkClassName(tone)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.stopPropagation()}
              draggable={false}
            >
              {query ? highlightText(part, query) : part}
            </a>
          );
        }

        return <span key={`${part}-${index}`}>{query ? highlightText(part, query) : part}</span>;
      })}
    </>
  );
}

function LinkPreviewCard({ preview, tone }: { preview: LinkPreviewData; tone: MessageTone }) {
  const isCustomer = tone === 'customer';
  const isBot = tone === 'bot';

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'block overflow-hidden rounded-xl border transition-colors',
        isCustomer && 'border-gray-200 bg-gray-50 hover:border-blue-200 hover:bg-white',
        isBot && 'border-purple-200 bg-purple-50/80 hover:bg-purple-50',
        tone === 'admin' && 'border-white/25 bg-white/10 hover:bg-white/15'
      )}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <div className="flex min-w-0 items-stretch">
        <div className="min-w-0 flex-1 px-3 py-2.5">
          <div
            className={cn(
              'mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em]',
              isCustomer && 'text-gray-500',
              isBot && 'text-purple-500',
              tone === 'admin' && 'text-brand-100'
            )}
          >
            <Globe className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{preview.siteName || preview.hostname}</span>
          </div>

          <p
            className={cn(
              'text-sm font-semibold leading-snug break-words',
              isCustomer && 'text-gray-900',
              isBot && 'text-purple-900',
              tone === 'admin' && 'text-white'
            )}
          >
            {preview.title || preview.hostname}
          </p>

          {preview.description && (
            <p
              className={cn(
                'mt-1 line-clamp-2 text-xs leading-relaxed',
                isCustomer && 'text-gray-600',
                isBot && 'text-purple-700/80',
                tone === 'admin' && 'text-brand-50/85'
              )}
            >
              {preview.description}
            </p>
          )}

          <div
            className={cn(
              'mt-2 flex items-center gap-1.5 text-[11px]',
              isCustomer && 'text-blue-600',
              isBot && 'text-purple-600',
              tone === 'admin' && 'text-brand-50'
            )}
          >
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{preview.url}</span>
          </div>
        </div>

        {preview.imageUrl && (
          <div
            className={cn(
              'w-20 flex-shrink-0 border-l',
              isCustomer && 'border-gray-200',
              isBot && 'border-purple-200',
              tone === 'admin' && 'border-white/15'
            )}
          >
            <img
              src={preview.imageUrl}
              alt={preview.title || preview.hostname}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        )}
      </div>
    </a>
  );
}

function MessageTextContent({ text, highlight, tone }: { text: string; highlight?: string; tone: MessageTone }) {
  const urls = useMemo(() => extractUrls(text), [text]);
  const previewUrl = urls[0] ?? null;
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);

  useEffect(() => {
    if (!previewUrl) {
      setPreview(null);
      return;
    }

    const cachedPreview = linkPreviewCache.get(previewUrl);
    if (cachedPreview) {
      setPreview(cachedPreview);
      return;
    }

    const fallbackPreview = createFallbackLinkPreview(previewUrl);
    setPreview(fallbackPreview);

    const controller = new AbortController();
    let isCancelled = false;

    const loadPreview = async () => {
      try {
        const response = await fetch(`/api/link-preview?url=${encodeURIComponent(previewUrl)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          linkPreviewCache.set(previewUrl, fallbackPreview);
          return;
        }

        const data = (await response.json()) as Partial<LinkPreviewData>;
        const nextPreview: LinkPreviewData = {
          ...fallbackPreview,
          ...data,
          url: data.url || fallbackPreview.url,
          hostname: data.hostname || fallbackPreview.hostname,
        };

        linkPreviewCache.set(previewUrl, nextPreview);
        if (!isCancelled) {
          setPreview(nextPreview);
        }
      } catch {
        linkPreviewCache.set(previewUrl, fallbackPreview);
      }
    };

    void loadPreview();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [previewUrl]);

  return (
    <>
      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
        {renderTextWithLinks(text, highlight, tone)}
      </p>
      {preview && (
        <div className="mt-2">
          <LinkPreviewCard preview={preview} tone={tone} />
        </div>
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
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMoved = useRef(false);
  // ป้องกัน click หลัง long press ปล่อยนิ้ว
  const longPressJustFired = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!onContextMenu) return;
    touchMoved.current = false;
    longPressJustFired.current = false;
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    longPressTimer.current = setTimeout(() => {
      if (!touchMoved.current) {
        longPressJustFired.current = true;
        if (navigator.vibrate) navigator.vibrate(30);
        onContextMenu(
          { clientX: x, clientY: y, preventDefault: () => {} } as React.MouseEvent,
          message
        );
      }
    }, 500);
  }, [onContextMenu, message]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // ถ้า long press เพิ่งยิง ป้องกัน touchend scroll/select behavior
    if (longPressJustFired.current) {
      e.preventDefault();
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    touchMoved.current = true;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // ป้องกัน click event ที่ตามหลัง long press
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (longPressJustFired.current) {
      e.preventDefault();
      e.stopPropagation();
      longPressJustFired.current = false;
    }
  }, []);

  const isCustomer = message.senderType === 'CUSTOMER';
  const isBot = message.senderType === 'BOT';
  const isSystem = message.senderType === 'SYSTEM';
  const isAdmin = message.senderType === 'ADMIN';
  const messageTone: MessageTone = isCustomer ? 'customer' : isBot ? 'bot' : 'admin';
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
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          onClick={handleClick}
          className={cn(
            'min-w-0 overflow-hidden rounded-2xl px-3 py-2 sm:px-4 transition-shadow cursor-default select-text',
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
          {message.replyToMessage && (() => {
            const rm = message.replyToMessage;
            // หา thumbnail URL สำหรับ IMAGE และ STICKER
            let thumbUrl: string | null = null;
            if (rm.contentType === 'IMAGE' && rm.mediaUrl) {
              thumbUrl = rm.mediaUrl;
            } else if (rm.contentType === 'STICKER') {
              const m = rm.content.match(/\[Sticker:\s*\d+\/(\d+)\]/);
              if (m) thumbUrl = `https://stickershop.line-scdn.net/stickershop/v1/sticker/${m[1]}/android/sticker.png`;
            }
            return (
              <div className={cn(
                'mb-2 flex items-center gap-2 rounded-xl border-l-2 px-3 py-1.5',
                isCustomer && 'border-gray-300 bg-gray-50 text-gray-700',
                isAdmin && 'border-white/40 bg-white/10 text-brand-50',
                isBot && 'border-purple-300 bg-purple-50 text-purple-800'
              )}>
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    'text-[10px] font-semibold',
                    isCustomer ? 'text-gray-500' : isAdmin ? 'text-brand-100' : 'text-purple-500'
                  )}>
                    {getReplySenderLabel(rm, customerName)}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-xs opacity-80">
                    {getReplyPreviewText(rm)}
                  </p>
                </div>
                {thumbUrl && (
                  <img
                    src={thumbUrl}
                    alt="preview"
                    className="h-10 w-10 flex-shrink-0 rounded-md object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                )}
              </div>
            );
          })()}

          {/* Content */}
          {renderContent(message, setLightboxUrl, highlight, messageTone)}

          {/* Timestamp */}
          <div
            suppressHydrationWarning
            className={cn(
              'mt-1 text-[10px] flex items-center gap-1',
              isCustomer ? 'text-gray-400 justify-start' : isBot ? 'text-purple-400 justify-end' : 'text-brand-200 justify-end'
            )}
          >
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

function renderContent(
  message: Message,
  onImageClick: (url: string) => void,
  highlight?: string,
  tone: MessageTone = 'customer'
) {
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
      return <MessageTextContent text={message.content} highlight={highlight} tone={tone} />;
  }
}

export default memo(MessageBubble);
