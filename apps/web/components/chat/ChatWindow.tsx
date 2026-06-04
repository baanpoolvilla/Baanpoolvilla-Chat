'use client';

import { useRef, useEffect, useLayoutEffect, useState, useMemo } from 'react';
import { useMessages } from '@/hooks/useMessages';
import { useSocket } from '@/hooks/useSocket';
import MessageBubble from './MessageBubble';
import MessageContextMenu from './MessageContextMenu';
import MessageInput from './MessageInput';
import { format } from 'date-fns';
import type { Conversation, ConversationRead, Message } from '@/types';
import { ChevronLeft, ChevronUp, ChevronDown, Info, Loader2, Pin, Search, X } from 'lucide-react';
import api from '@/lib/api';
import PlatformBadge from '@/components/common/PlatformBadge';
import { useAuth } from '@/hooks/useAuth';
import { canWriteChat } from '@/lib/permissions';

interface ChatWindowProps {
  conversationId: string;
  conversation: Conversation | null;
  isConversationLoading?: boolean;
  onToggleInfo?: () => void;
  contactNameOverride?: string;
  onCloseChat?: () => void;
}

export default function ChatWindow({ conversationId, conversation, isConversationLoading = false, onToggleInfo, contactNameOverride, onCloseChat }: ChatWindowProps) {
  const { messages, isLoading, hasMore, loadMore, sendMessage } = useMessages(conversationId);
  const { on } = useSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesWrapperRef = useRef<HTMLDivElement>(null);
  const shouldJumpToBottomRef = useRef(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [reads, setReads] = useState<ConversationRead[]>(conversation?.reads || []);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: Message } | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [pinnedExpanded, setPinnedExpanded] = useState(false);
  const admin = useAuth((s) => s.admin);
  const canModifyChat = canWriteChat(admin?.role);

  useEffect(() => {
    shouldJumpToBottomRef.current = true;
    setReplyingTo(null);
    setSearchOpen(false);
    setSearchQuery('');
    setCurrentMatchIdx(0);
    setReads(conversation?.reads || []);
  }, [conversationId, conversation?.reads]);

  // ResizeObserver: re-scroll เมื่อ image/link-preview โหลดเสร็จและ content สูงขึ้น
  // dependency รวม isLoading เพราะ messagesWrapperRef จะ null ตอน loading (wrapper ยังไม่ mount)
  useEffect(() => {
    const container = scrollContainerRef.current;
    const wrapper = messagesWrapperRef.current;
    if (!container || !wrapper) return;

    const observer = new ResizeObserver(() => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom < 300) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
      }
    });

    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [conversationId, isLoading]);

  // Real-time: อัปเดตรายการผู้อ่านเมื่อ admin อื่น join ห้องเดียวกัน
  useEffect(() => {
    const off = on('conversation:read', (data) => {
      if (data.conversationId !== conversationId) return;
      setReads((prev) => {
        const filtered = prev.filter((r) => r.admin.id !== data.admin.id);
        return [{ admin: data.admin, readAt: data.readAt }, ...filtered].slice(0, 5);
      });
    });
    return off;
  }, [on, conversationId]);

  // Fetch pinned messages เมื่อเปิด conversation
  useEffect(() => {
    if (!conversationId) return;
    api.get<{ messages: Message[] }>(`/api/messages/pinned?conversationId=${conversationId}`)
      .then((res) => setPinnedMessages(res.data.messages))
      .catch(() => {});
  }, [conversationId]);

  // Real-time: อัปเดต pin state
  useEffect(() => {
    const off = on('message:updated', (msg) => {
      if (msg.conversationId !== conversationId) return;
      setPinnedMessages((prev) => {
        if (msg.isPinned) {
          const filtered = prev.filter((m) => m.id !== msg.id);
          return [msg, ...filtered];
        }
        return prev.filter((m) => m.id !== msg.id);
      });
    });
    return off;
  }, [on, conversationId]);

  const handlePin = async (message: Message) => {
    try {
      await api.patch(`/api/messages/${message.id}/pin`, { isPinned: !message.isPinned });
    } catch {
      // socket event จะ update UI อัตโนมัติ
    }
  };

  const handleCopy = (message: Message) => {
    if (message.contentType === 'TEXT') {
      navigator.clipboard.writeText(message.content).catch(() => {});
    }
  };

  const scrollToMessage = (messageId: string) => {
    const el = scrollContainerRef.current?.querySelector(`[data-msg-id="${messageId}"]`) as HTMLElement | null;
    if (!el || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const relativeTop = elRect.top - containerRect.top + container.scrollTop;
    container.scrollTo({ top: relativeTop - container.clientHeight / 2, behavior: 'smooth' });
  };

  const matchIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return messages
      .filter((m) => m.contentType === 'TEXT' && m.content.toLowerCase().includes(q))
      .map((m) => m.id);
  }, [messages, searchQuery]);

  useEffect(() => {
    if (matchIds.length === 0) return;
    const msgId = matchIds[currentMatchIdx] ?? matchIds[0];
    const container = scrollContainerRef.current;
    if (!container) return;
    const msgEl = container.querySelector(`[data-msg-id="${msgId}"]`) as HTMLElement | null;
    if (!msgEl) return;
    const containerRect = container.getBoundingClientRect();
    const msgRect = msgEl.getBoundingClientRect();
    const relativeTop = msgRect.top - containerRect.top + container.scrollTop;
    const center = relativeTop - container.clientHeight / 2 + msgEl.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, center), behavior: 'smooth' });
  }, [currentMatchIdx, matchIds]);

  const goToNextMatch = () => setCurrentMatchIdx((i) => (matchIds.length === 0 ? 0 : (i + 1) % matchIds.length));
  const goToPrevMatch = () => setCurrentMatchIdx((i) => (matchIds.length === 0 ? 0 : (i - 1 + matchIds.length) % matchIds.length));

  const openSearch = () => setSearchOpen(true);
  const closeSearch = () => { setSearchOpen(false); setSearchQuery(''); setCurrentMatchIdx(0); };

  useLayoutEffect(() => {
    if (messages.length === 0) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    // Only scroll if content overflows — when it fits, messages naturally appear at top
    if (container.scrollHeight > container.clientHeight) {
      const behavior: ScrollBehavior = shouldJumpToBottomRef.current ? 'auto' : 'smooth';
      container.scrollTo({ top: container.scrollHeight, behavior });
    }
    shouldJumpToBottomRef.current = false;
  }, [conversationId, messages.length]);

  useEffect(() => {
    if (!canModifyChat) {
      return;
    }

    api.post(`/api/conversations/${conversationId}/read`).catch(() => {});
  }, [canModifyChat, conversationId]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (el && el.scrollTop === 0 && hasMore && !isLoading) {
      loadMore();
    }
  };

  const handleSend = async (content: string, contentType?: string, mediaUrl?: string, replyToMessageId?: string) => {
    const replyTarget = replyingTo && replyingTo.id === replyToMessageId ? replyingTo : null;
    await sendMessage(content, contentType, mediaUrl, replyTarget);
    setReplyingTo(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[linear-gradient(180deg,#e4efd9_0%,#f7faf5_100%)]">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white/95 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.85rem)] shadow-sm backdrop-blur md:px-6 md:py-3">
        {onCloseChat && (
          <button
            onClick={onCloseChat}
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 md:hidden"
            title="กลับไปหน้ารายการแชท"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-sm font-medium md:h-10 md:w-10">
          {conversation?.contact?.avatarUrl ? (
            <img
              src={conversation.contact.avatarUrl}
              alt=""
              className="h-9 w-9 rounded-full object-cover md:h-10 md:w-10"
            />
          ) : (
            (conversation?.contact?.displayName || '?').charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-gray-900">
            {contactNameOverride ?? conversation?.contact?.displayName ?? (isConversationLoading ? 'Loading...' : 'Unknown contact')}
          </h3>
          <div className="mt-0.5 flex items-center gap-2">
            {conversation?.platform && <PlatformBadge platform={conversation.platform} compact />}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={openSearch}
            className={`rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 ${searchOpen ? 'bg-gray-100 text-gray-700' : ''}`}
            title="ค้นหาข้อความในแชท"
          >
            <Search className="h-4 w-4" />
          </button>
          {onCloseChat && (
            <button
              onClick={onCloseChat}
              className="hidden rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 md:inline-flex"
              title="ปิดแชท"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {onToggleInfo && (
            <button
              onClick={onToggleInfo}
              className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              title="ข้อมูลการสนทนา"
            >
              <Info className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* In-chat search bar */}
      {searchOpen && (
        <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            autoFocus
            type="text"
            placeholder="ค้นหาข้อความในแชท..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentMatchIdx(0); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.shiftKey ? goToPrevMatch() : goToNextMatch(); } if (e.key === 'Escape') closeSearch(); }}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {searchQuery && (
            <span className="shrink-0 text-xs text-gray-500">
              {matchIds.length === 0 ? 'ไม่พบ' : `${currentMatchIdx + 1}/${matchIds.length}`}
            </span>
          )}
          <button
            onClick={goToPrevMatch}
            disabled={matchIds.length === 0}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            title="ก่อนหน้า"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            onClick={goToNextMatch}
            disabled={matchIds.length === 0}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            title="ถัดไป"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button onClick={closeSearch} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="ปิด">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Pinned messages banner */}
      {pinnedMessages.length > 0 && (
        <div className="border-b border-amber-100 bg-amber-50">
          {/* Header */}
          <button
            onClick={() => setPinnedExpanded((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left"
          >
            <Pin className="h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-amber-800">
              {pinnedMessages.length === 1
                ? pinnedMessages[0].content.slice(0, 60)
                : `${pinnedMessages.length} ข้อความที่ปักหมุด`}
            </span>
            <span className="ml-auto flex-shrink-0 text-[10px] text-amber-500">
              {pinnedExpanded ? '▲' : '▼'}
            </span>
          </button>

          {/* Expanded list */}
          {pinnedExpanded && (
            <div className="divide-y divide-amber-100 border-t border-amber-100">
              {pinnedMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-amber-100/60"
                >
                  <button
                    onClick={() => { scrollToMessage(msg.id); setPinnedExpanded(false); }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-xs text-gray-700">{msg.content.slice(0, 80)}</p>
                    <p className="mt-0.5 text-[10px] text-amber-600" suppressHydrationWarning>
                      {msg.admin?.name || 'Customer'} · {format(new Date(msg.pinnedAt || msg.sentAt), 'HH:mm')}
                    </p>
                  </button>
                  {canModifyChat && (
                    <button
                      onClick={() => handlePin(msg)}
                      className="flex-shrink-0 rounded-full p-1 text-amber-400 hover:bg-amber-200 hover:text-amber-700"
                      title="เอาหมุดออก"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 py-3 md:px-6 md:py-4"
      >
        {isLoading && messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div ref={messagesWrapperRef} className="pb-1">
            {hasMore && (
              <button
                onClick={loadMore}
                className="mx-auto mb-3 block rounded-full bg-white/80 px-3 py-1 text-xs text-gray-500 shadow-sm hover:text-gray-700"
              >
                Load older messages
              </button>
            )}
            {messages.map((msg, idx) => {
              const matchIdx = matchIds.indexOf(msg.id);
              const prev = messages[idx - 1];
              const next = messages[idx + 1];
              const isLatestMessage = idx === messages.length - 1;
              // Only show reads from admins who read AFTER this message was sent
              const freshReads = isLatestMessage
                ? reads.filter((r) => new Date(r.readAt) >= new Date(msg.sentAt))
                : [];
              // Group ถ้าข้อความก่อนหน้าเป็นคนเดียวกัน และห่างกันไม่เกิน 5 นาที
              const isGrouped = !!(
                prev &&
                prev.senderType === msg.senderType &&
                prev.adminId === msg.adminId &&
                new Date(msg.sentAt).getTime() - new Date(prev.sentAt).getTime() < 5 * 60 * 1000
              );
              const isLastInGroup = !(
                next &&
                next.senderType === msg.senderType &&
                next.adminId === msg.adminId &&
                new Date(next.sentAt).getTime() - new Date(msg.sentAt).getTime() < 5 * 60 * 1000
              );
              return (
                <div key={msg.id} data-msg-id={msg.id}>
                  <MessageBubble
                    message={msg}
                    customerName={conversation?.contact?.displayName}
                    customerAvatarUrl={conversation?.contact?.avatarUrl}
                    customerPlatform={conversation?.platform}
                    canReply={canModifyChat}
                    canPin={canModifyChat}
                    onContextMenu={(e, m) => setContextMenu({ x: e.clientX, y: e.clientY, message: m })}
                    highlight={searchQuery.trim() || undefined}
                    isCurrentMatch={matchIdx !== -1 && matchIdx === currentMatchIdx}
                    isGrouped={isGrouped}
                    isLastInGroup={isLastInGroup}
                  />

                  {isLatestMessage && freshReads.length > 0 && (
                    <div className="flex flex-col items-end gap-1 px-1 pt-2">
                      {freshReads.slice(0, 5).map((r) => (
                        <div key={r.admin.id} className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400" suppressHydrationWarning>
                            อ่านแล้ว ·{' '}
                            <span className="text-gray-500 font-medium">{r.admin.name}</span>
                            {' · '}
                            {format(new Date(r.readAt), 'HH:mm')}
                          </span>
                          <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-[8px] font-medium text-brand-700">
                            {r.admin.avatar ? (
                              <img src={r.admin.avatar} alt={r.admin.name} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                            ) : (
                              r.admin.name.charAt(0).toUpperCase()
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      {canModifyChat ? (
        <MessageInput
          onSend={handleSend}
          platform={conversation?.platform}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          customerName={conversation?.contact?.displayName}
        />
      ) : (
        <div className="border-t border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
          บทบาทนี้ดูแชตได้อย่างเดียว ระบบปิดการส่งข้อความไว้
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          message={contextMenu.message}
          canReply={canModifyChat}
          canPin={canModifyChat}
          onReply={() => contextMenu && setReplyingTo(contextMenu.message)}
          onPin={() => contextMenu && handlePin(contextMenu.message)}
          onCopy={() => contextMenu && handleCopy(contextMenu.message)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
