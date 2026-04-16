'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import ConversationList from '@/components/chat/ConversationList';
import ChatWindow from '@/components/chat/ChatWindow';
import ConversationInfo from '@/components/chat/ConversationInfo';
import type { Conversation } from '@/types';

export default function ConversationDetailPage() {
  const params = useParams();
  const conversationId = params.id as string;
  const [showInfo, setShowInfo] = useState(true);
  const [selectedId, setSelectedId] = useState(conversationId);

  const handleSelect = (conversation: Conversation) => {
    setSelectedId(conversation.id);
    window.history.replaceState(null, '', `/conversations/${conversation.id}`);
  };

  return (
    <div className="h-full flex">
      {/* Conversation List */}
      <div className="w-80 border-r border-gray-200 bg-white flex-shrink-0 hidden lg:block">
        <ConversationList
          activeId={selectedId}
          onSelect={handleSelect}
        />
      </div>

      {/* Chat Window */}
      <div className="flex-1 min-w-0">
        <ChatWindow
          conversationId={selectedId}
          onToggleInfo={() => setShowInfo(!showInfo)}
        />
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="w-80 border-l border-gray-200 bg-white flex-shrink-0 hidden xl:block overflow-y-auto">
          <ConversationInfo
            conversationId={selectedId}
            onClose={() => setShowInfo(false)}
          />
        </div>
      )}
    </div>
  );
}
