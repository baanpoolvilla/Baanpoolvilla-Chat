'use client';

import { useRouter } from 'next/navigation';
import ConversationList from '@/components/chat/ConversationList';
import type { Conversation } from '@/types';

export default function ConversationsPage() {
  const router = useRouter();

  const handleSelect = (conversation: Conversation) => {
    router.push(`/conversations/${conversation.id}`);
  };

  return (
    <div className="h-full flex">
      <div className="w-full max-w-md border-r border-gray-200 bg-white">
        <ConversationList
          onSelect={handleSelect}
        />
      </div>
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <svg
            className="w-16 h-16 text-gray-300 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <p className="text-gray-500">เลือกสนทนาเพื่อเริ่มต้น</p>
        </div>
      </div>
    </div>
  );
}
