'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ConversationList from '@/components/chat/ConversationList';
import ChatWindow from '@/components/chat/ChatWindow';
import ConversationInfo from '@/components/chat/ConversationInfo';
import type { Conversation } from '@/types';
import api from '@/lib/api';

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;
  const [desktopInfoVisible, setDesktopInfoVisible] = useState(true);
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(conversationId);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isConversationLoading, setIsConversationLoading] = useState(true);
  const [isLgUp, setIsLgUp] = useState(false);
  const [isXlUp, setIsXlUp] = useState(false);
  const [contactNameOverride, setContactNameOverride] = useState<string | undefined>(undefined);
  const listContactRenamer = useRef<((contactId: string, displayName: string) => void) | null>(null);

  const refreshConversation = useCallback(async (targetConversationId = selectedId) => {
    setIsConversationLoading(true);

    try {
      const res = await api.get(`/api/conversations/${targetConversationId}`);
      setConversation(res.data.data || res.data);
    } catch {
      setConversation(null);
    } finally {
      setIsConversationLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    setSelectedId(conversationId);
    setContactNameOverride(undefined);
    setMobileInfoOpen(false);
  }, [conversationId]);

  useEffect(() => {
    void refreshConversation(selectedId);
  }, [refreshConversation, selectedId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const lgMediaQuery = window.matchMedia('(min-width: 1024px)');
    const xlMediaQuery = window.matchMedia('(min-width: 1280px)');
    const syncViewport = () => {
      setIsLgUp(lgMediaQuery.matches);
      setIsXlUp(xlMediaQuery.matches);
    };

    syncViewport();

    if (typeof lgMediaQuery.addEventListener === 'function' && typeof xlMediaQuery.addEventListener === 'function') {
      lgMediaQuery.addEventListener('change', syncViewport);
      xlMediaQuery.addEventListener('change', syncViewport);
      return () => {
        lgMediaQuery.removeEventListener('change', syncViewport);
        xlMediaQuery.removeEventListener('change', syncViewport);
      };
    }

    lgMediaQuery.addListener(syncViewport);
    xlMediaQuery.addListener(syncViewport);
    return () => {
      lgMediaQuery.removeListener(syncViewport);
      xlMediaQuery.removeListener(syncViewport);
    };
  }, []);

  useEffect(() => {
    if (isXlUp) {
      setMobileInfoOpen(false);
    }
  }, [isXlUp]);

  const handleSelect = (conversation: Conversation) => {
    setSelectedId(conversation.id);
    setConversation(null);
    setIsConversationLoading(true);
    setContactNameOverride(undefined);
    window.history.replaceState(null, '', `/conversations/${conversation.id}`);
  };

  const handleContactRenamed = useCallback((contactId: string, displayName: string) => {
    setContactNameOverride(displayName);
    setConversation((current) => {
      if (!current || current.contact.id !== contactId) {
        return current;
      }

      return {
        ...current,
        contact: {
          ...current.contact,
          displayName,
        },
      };
    });
    listContactRenamer.current?.(contactId, displayName);
  }, []);

  const handleToggleInfo = useCallback(() => {
    if (isXlUp) {
      setDesktopInfoVisible((current) => !current);
      return;
    }

    setMobileInfoOpen((current) => !current);
  }, [isXlUp]);

  return (
    <div className="flex h-full min-h-0 bg-white md:bg-transparent">
      {/* Conversation List */}
      {isLgUp && (
        <div className="w-80 min-h-0 flex-shrink-0 border-r border-gray-200 bg-white">
          <ConversationList
            activeId={selectedId}
            onSelect={handleSelect}
            registerContactRenamer={(fn) => { listContactRenamer.current = fn; }}
          />
        </div>
      )}

      {/* Chat Window */}
      <div className="flex min-h-0 min-w-0 flex-1">
        <ChatWindow
          conversationId={selectedId}
          conversation={conversation}
          isConversationLoading={isConversationLoading}
          onToggleInfo={handleToggleInfo}
          contactNameOverride={contactNameOverride}
          onCloseChat={() => router.push('/conversations')}
        />
      </div>

      {/* Info Panel */}
      {desktopInfoVisible && isXlUp && (
        <div className="hidden w-80 min-h-0 flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-white xl:block">
          <ConversationInfo
            conversationId={selectedId}
            conversation={conversation}
            isLoading={isConversationLoading}
            onConversationChange={setConversation}
            refreshConversation={() => refreshConversation(selectedId)}
            onContactRenamed={handleContactRenamed}
          />
        </div>
      )}

      {mobileInfoOpen && !isXlUp && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            type="button"
            aria-label="ปิดข้อมูลแชท"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setMobileInfoOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.9rem)]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Chat Details</p>
                <h2 className="text-sm font-semibold text-gray-900">ข้อมูลการสนทนา</h2>
              </div>
              <button
                type="button"
                onClick={() => setMobileInfoOpen(false)}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <span className="sr-only">ปิดข้อมูลแชท</span>
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <ConversationInfo
                conversationId={selectedId}
                conversation={conversation}
                isLoading={isConversationLoading}
                onConversationChange={setConversation}
                refreshConversation={() => refreshConversation(selectedId)}
                onContactRenamed={handleContactRenamed}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
