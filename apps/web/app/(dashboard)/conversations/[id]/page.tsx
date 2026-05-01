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
  const [contactNameOverride, setContactNameOverride] = useState<string | undefined>(undefined);

  const handleSelect = (conversation: Conversation) => {
    setSelectedId(conversation.id);
    setContactNameOverride(undefined);
    window.history.replaceState(null, '', `/conversations/${conversation.id}`);
  };

  return (
    <div className="flex h-full min-h-0">
      {/* Conversation List */}
      <div className="hidden w-80 min-h-0 flex-shrink-0 border-r border-gray-200 bg-white lg:block">
        <ConversationList
          activeId={selectedId}
          onSelect={handleSelect}
        />
      </div>

      {/* Chat Window */}
      <div className="flex min-h-0 min-w-0 flex-1">
        <ChatWindow
          conversationId={selectedId}
          onToggleInfo={() => setShowInfo(!showInfo)}
          contactNameOverride={contactNameOverride}
        />
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="hidden w-80 min-h-0 flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-white xl:block">
          <ConversationInfo
            conversationId={selectedId}
            onClose={() => setShowInfo(false)}
            onContactRenamed={(name) => setContactNameOverride(name)}
          />
        </div>
      )}
    </div>
  );
}
