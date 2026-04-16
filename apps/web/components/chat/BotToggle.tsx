'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface BotToggleProps {
  conversationId: string;
  isBot: boolean;
  onToggle: (isBot: boolean) => void;
}

export default function BotToggle({ conversationId, isBot, onToggle }: BotToggleProps) {
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    try {
      setLoading(true);
      await api.patch(`/conversations/${conversationId}/bot`, { isBot: !isBot });
      onToggle(!isBot);
    } catch (error) {
      console.error('Failed to toggle bot:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
      <div>
        <p className="text-sm font-medium text-gray-900">AI Bot</p>
        <p className="text-xs text-gray-500">
          {isBot ? 'Bot is responding' : 'Admin mode active'}
        </p>
      </div>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          isBot ? 'bg-purple-600' : 'bg-gray-300',
          loading && 'opacity-50'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white transition-transform',
            isBot ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
}
