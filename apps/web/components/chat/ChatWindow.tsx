'use client';

import { useRef, useEffect, useLayoutEffect, useState, useMemo } from 'react';
import { useMessages } from '@/hooks/useMessages';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import type { Conversation, Message } from '@/types';
import { ChevronLeft, ChevronUp, ChevronDown, Info, Loader2, Search, X } from 'lucide-react';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldJumpToBottomRef = useRef(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const admin = useAuth((s) => s.admin);
  const canModifyChat = canWriteChat(admin?.role);

  const scrollToBottom = (behavior: ScrollBehavior) => {
    // Use scrollTop directly instead of scrollIntoView — avoids iOS Safari bug
    // where scrollIntoView scrolls through overflow:hidden ancestor elements,
    // causing the entire page layout to shift and the header to disappear.
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  useEffect(() => {
    shouldJumpToBottomRef.current = true;
    setReplyingTo(null);
    setSearchOpen(false);
    setSearchQuery('');
    setCurrentMatchIdx(0);
  }, [conversationId]);

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

    if (messages.length === 0) return;

    const behavior: ScrollBehavior = shouldJumpToBottomRef.current ? 'auto' : 'smooth';
    scrollToBottom(behavior);
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

      {/* Messages */}}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 md:px-6 md:py-4"
      >
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-3">
            {hasMore && (
              <button
                onClick={loadMore}
                className="mx-auto block rounded-full bg-white/80 px-3 py-1 text-xs text-gray-500 shadow-sm hover:text-gray-700"
              >
                Load older messages
              </button>
            )}
            {messages.map((msg) => {
              const matchIdx = matchIds.indexOf(msg.id);
              return (
                <div key={msg.id} data-msg-id={msg.id}>
                  <MessageBubble
                    message={msg}
                    customerName={conversation?.contact?.displayName}
                    customerAvatarUrl={conversation?.contact?.avatarUrl}
                    customerPlatform={conversation?.platform}
                    canReply={canModifyChat}
                    onReply={setReplyingTo}
                    highlight={searchQuery.trim() || undefined}
                    isCurrentMatch={matchIdx !== -1 && matchIdx === currentMatchIdx}
                  />
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
    </div>
  );
}
