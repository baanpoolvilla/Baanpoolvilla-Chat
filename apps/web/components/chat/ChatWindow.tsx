'use client';

import { useRef, useEffect, useState } from 'react';
import { useMessages } from '@/hooks/useMessages';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import type { Conversation } from '@/types';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import PlatformBadge from '@/components/common/PlatformBadge';

interface ChatWindowProps {
  conversationId: string;
  onToggleInfo?: () => void;
}

export default function ChatWindow({ conversationId, onToggleInfo }: ChatWindowProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const { messages, isLoading, hasMore, loadMore, sendMessage } = useMessages(conversationId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get(`/api/conversations/${conversationId}`).then((res) => {
      setConversation(res.data.data || res.data);
    }).catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    api.post(`/api/conversations/${conversationId}/read`).catch(() => {});
  }, [conversationId]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (el && el.scrollTop === 0 && hasMore && !isLoading) {
      loadMore();
    }
  };

  const handleSend = async (content: string, contentType?: string, mediaUrl?: string) => {
    await sendMessage(content, contentType, mediaUrl);
  };

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-medium">
          {conversation?.contact?.avatarUrl ? (
            <img
              src={conversation.contact.avatarUrl}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            (conversation?.contact?.displayName || '?').charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">
            {conversation?.contact?.displayName || 'Loading...'}
          </h3>
          <div className="flex items-center gap-2">
            {conversation?.platform && <PlatformBadge platform={conversation.platform} compact />}
          </div>
        </div>
        {onToggleInfo && (
          <button onClick={onToggleInfo} className="p-2 text-gray-400 hover:text-gray-600">
            ☰
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 py-4"
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
                className="mx-auto block text-xs text-gray-400 hover:text-gray-600"
              >
                Load older messages
              </button>
            )}
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        platform={conversation?.platform}
      />
    </div>
  );
}
