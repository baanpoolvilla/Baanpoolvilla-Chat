'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Send, Paperclip, MessageSquarePlus, Sticker } from 'lucide-react';
import QuickReplyPicker from './QuickReplyPicker';

interface MessageInputProps {
  onSend: (content: string, contentType?: string, mediaUrl?: string) => void;
  disabled?: boolean;
  platform?: string;
}

const PLATFORM_LIMITS: Record<string, number> = {
  LINE: 5000,
  FACEBOOK: 2000,
  INSTAGRAM: 1000,
  TIKTOK: 500,
};

const LINE_STICKERS = [
  { packageId: '1', stickerId: '1' },
  { packageId: '1', stickerId: '2' },
  { packageId: '1', stickerId: '3' },
  { packageId: '1', stickerId: '4' },
  { packageId: '1', stickerId: '13' },
  { packageId: '1', stickerId: '14' },
  { packageId: '2', stickerId: '18' },
  { packageId: '2', stickerId: '19' },
  { packageId: '2', stickerId: '24' },
  { packageId: '2', stickerId: '28' },
  { packageId: '4', stickerId: '266' },
  { packageId: '4', stickerId: '275' },
];

export default function MessageInput({ onSend, disabled, platform }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const quickReplyBtnRef = useRef<HTMLDivElement>(null);
  const stickerBtnRef = useRef<HTMLDivElement>(null);
  const maxChars = platform ? PLATFORM_LIMITS[platform] || 5000 : 5000;

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  };

  const handleSelectQuickReply = (text: string) => {
    setContent(text.slice(0, maxChars));
    setShowQuickReplies(false);
    setTimeout(() => {
      textareaRef.current?.focus();
      handleInput();
    }, 0);
  };

  const handleSendSticker = (packageId: string, stickerId: string) => {
    if (disabled || platform !== 'LINE') return;
    onSend(`[Sticker: ${packageId}/${stickerId}]`, 'STICKER');
    setShowStickerPicker(false);
  };

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="relative flex items-end gap-2">
        {/* Quick Reply button */}
        <div ref={quickReplyBtnRef} className="relative flex-shrink-0">
          <button
            onClick={() => setShowQuickReplies((v) => !v)}
            disabled={disabled}
            title="ข้อความสำเร็จรูป"
            className={`rounded-lg p-2 transition-colors hover:bg-gray-100 disabled:opacity-50 ${
              showQuickReplies ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <MessageSquarePlus className="h-5 w-5" />
          </button>
          {showQuickReplies && (
            <QuickReplyPicker
              onSelect={handleSelectQuickReply}
              onClose={() => setShowQuickReplies(false)}
            />
          )}
        </div>

        <button
          className="flex-shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Attach file"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        {platform === 'LINE' && (
          <div ref={stickerBtnRef} className="relative flex-shrink-0">
            <button
              onClick={() => setShowStickerPicker((v) => !v)}
              disabled={disabled}
              title="ส่งสติกเกอร์"
              className={`rounded-lg p-2 transition-colors hover:bg-gray-100 disabled:opacity-50 ${
                showStickerPicker ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Sticker className="h-5 w-5" />
            </button>
            {showStickerPicker && (
              <div className="absolute bottom-12 left-0 z-20 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                <p className="mb-2 text-xs font-semibold text-gray-500">เลือกสติกเกอร์ LINE</p>
                <div className="grid grid-cols-4 gap-2">
                  {LINE_STICKERS.map((s) => {
                    const stickerUrl = `https://stickershop.line-scdn.net/stickershop/v1/sticker/${s.stickerId}/android/sticker.png`;
                    return (
                      <button
                        key={`${s.packageId}-${s.stickerId}`}
                        onClick={() => handleSendSticker(s.packageId, s.stickerId)}
                        className="rounded-lg border border-transparent p-1 hover:border-brand-300 hover:bg-gray-50"
                        title={`${s.packageId}/${s.stickerId}`}
                      >
                        <img src={stickerUrl} alt="sticker" className="h-12 w-12 object-contain" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, maxChars))}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Type a message..."
            disabled={disabled}
            rows={1}
            className="w-full resize-none rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-gray-400">
            {content.length}/{maxChars}
          </span>
          <button
            onClick={handleSend}
            disabled={!content.trim() || disabled}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

