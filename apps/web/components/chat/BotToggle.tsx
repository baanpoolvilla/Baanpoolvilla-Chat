'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { Bot, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BotToggleProps {
  conversationId: string;
  isBot: boolean;
  onToggle: (isBot: boolean) => void;
  size?: 'sm' | 'md';
}

export default function BotToggle({ conversationId, isBot, onToggle, size = 'md' }: BotToggleProps) {
  const [loading, setLoading] = useState(false);

  const toggle = async (value: boolean) => {
    if (loading || value === isBot) return;
    try {
      setLoading(true);
      await api.patch(`/conversations/${conversationId}/bot`, { isBot: value });
      onToggle(value);
    } catch (error) {
      console.error('Failed to toggle bot:', error);
    } finally {
      setLoading(false);
    }
  };

  if (size === 'sm') {
    return (
      <div className={cn('flex overflow-hidden rounded-md border border-gray-200', loading && 'pointer-events-none opacity-60')}>
        <button
          onClick={() => toggle(false)}
          className={cn(
            'flex items-center gap-1 px-2 py-1 text-[11px] font-semibold transition-colors',
            !isBot ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50',
          )}
        >
          <UserCheck className="h-3 w-3" />
          Admin
        </button>
        <button
          onClick={() => toggle(true)}
          className={cn(
            'flex items-center gap-1 border-l border-gray-200 px-2 py-1 text-[11px] font-semibold transition-colors',
            isBot ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50',
          )}
        >
          <Bot className="h-3 w-3" />
          Bot
        </button>
      </div>
    );
  }

  return (
    <div className={cn('flex overflow-hidden rounded-lg border border-gray-200', loading && 'pointer-events-none opacity-60')}>
      <button
        onClick={() => toggle(false)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors',
          !isBot ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50',
        )}
      >
        <UserCheck className="h-3.5 w-3.5" />
        Admin
      </button>
      <button
        onClick={() => toggle(true)}
        className={cn(
          'flex items-center gap-1.5 border-l border-gray-200 px-3 py-2 text-xs font-semibold transition-colors',
          isBot ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50',
        )}
      >
        <Bot className="h-3.5 w-3.5" />
        Bot
      </button>
    </div>
  );
}
