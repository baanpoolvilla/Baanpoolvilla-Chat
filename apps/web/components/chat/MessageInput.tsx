'use client';

import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { Send, Paperclip, MessageSquarePlus, Sticker, Star } from 'lucide-react';
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
  { packageId: '1', stickerId: '5' },
  { packageId: '1', stickerId: '6' },
  { packageId: '1', stickerId: '7' },
  { packageId: '1', stickerId: '8' },
  { packageId: '1', stickerId: '9' },
  { packageId: '1', stickerId: '10' },
  { packageId: '1', stickerId: '11' },
  { packageId: '1', stickerId: '12' },
  { packageId: '1', stickerId: '13' },
  { packageId: '1', stickerId: '14' },
  { packageId: '2', stickerId: '15' },
  { packageId: '2', stickerId: '16' },
  { packageId: '2', stickerId: '17' },
  { packageId: '2', stickerId: '18' },
  { packageId: '2', stickerId: '19' },
  { packageId: '2', stickerId: '20' },
  { packageId: '2', stickerId: '21' },
  { packageId: '2', stickerId: '22' },
  { packageId: '2', stickerId: '23' },
  { packageId: '2', stickerId: '24' },
  { packageId: '2', stickerId: '25' },
  { packageId: '2', stickerId: '26' },
  { packageId: '2', stickerId: '27' },
  { packageId: '2', stickerId: '28' },
  { packageId: '2', stickerId: '29' },
  { packageId: '4', stickerId: '266' },
  { packageId: '4', stickerId: '267' },
  { packageId: '4', stickerId: '268' },
  { packageId: '4', stickerId: '269' },
  { packageId: '4', stickerId: '270' },
  { packageId: '4', stickerId: '271' },
  { packageId: '4', stickerId: '272' },
  { packageId: '4', stickerId: '273' },
  { packageId: '4', stickerId: '274' },
  { packageId: '4', stickerId: '275' },
  // OA Sticker Pack 1 (11537)
  { packageId: '11537', stickerId: '52002734' },
  { packageId: '11537', stickerId: '52002735' },
  { packageId: '11537', stickerId: '52002736' },
  { packageId: '11537', stickerId: '52002737' },
  { packageId: '11537', stickerId: '52002738' },
  { packageId: '11537', stickerId: '52002739' },
  { packageId: '11537', stickerId: '52002740' },
  { packageId: '11537', stickerId: '52002741' },
  // OA Sticker Pack 2 (11538)
  { packageId: '11538', stickerId: '51626494' },
  { packageId: '11538', stickerId: '51626495' },
  { packageId: '11538', stickerId: '51626496' },
  { packageId: '11538', stickerId: '51626497' },
  { packageId: '11538', stickerId: '51626498' },
  { packageId: '11538', stickerId: '51626499' },
  { packageId: '11538', stickerId: '51626500' },
  { packageId: '11538', stickerId: '51626501' },
  // OA Sticker Pack 3 (11539)
  { packageId: '11539', stickerId: '52114110' },
  { packageId: '11539', stickerId: '52114111' },
  { packageId: '11539', stickerId: '52114112' },
  { packageId: '11539', stickerId: '52114113' },
  { packageId: '11539', stickerId: '52114114' },
  { packageId: '11539', stickerId: '52114115' },
  { packageId: '11539', stickerId: '52114116' },
  { packageId: '11539', stickerId: '52114117' },
];

const STICKER_FAVORITES_KEY = 'lineStickerFavorites';

export default function MessageInput({ onSend, disabled, platform }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [favoriteStickers, setFavoriteStickers] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const quickReplyBtnRef = useRef<HTMLDivElement>(null);
  const stickerBtnRef = useRef<HTMLDivElement>(null);
  const maxChars = platform ? PLATFORM_LIMITS[platform] || 5000 : 5000;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STICKER_FAVORITES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setFavoriteStickers(parsed.filter((v) => typeof v === 'string'));
      }
    } catch {
      // ignore invalid local storage
    }
  }, []);

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

  const stickerKey = (packageId: string, stickerId: string) => `${packageId}/${stickerId}`;

  const toggleFavoriteSticker = (packageId: string, stickerId: string) => {
    const key = stickerKey(packageId, stickerId);
    const next = favoriteStickers.includes(key)
      ? favoriteStickers.filter((s) => s !== key)
      : [key, ...favoriteStickers];
    setFavoriteStickers(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STICKER_FAVORITES_KEY, JSON.stringify(next));
    }
  };

  const favoriteStickerList = LINE_STICKERS.filter((s) => favoriteStickers.includes(stickerKey(s.packageId, s.stickerId)));

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
              <div className="absolute bottom-12 left-0 z-20 w-80 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                <p className="mb-2 text-xs font-semibold text-gray-500">เลือกสติกเกอร์ LINE OA (รองรับแน่นอน)</p>

                {favoriteStickerList.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-1 text-[11px] font-semibold text-amber-500">ติดดาว</p>
                    <div className="grid grid-cols-5 gap-2">
                      {favoriteStickerList.map((s) => {
                        const key = stickerKey(s.packageId, s.stickerId);
                        const stickerUrl = `https://stickershop.line-scdn.net/stickershop/v1/sticker/${s.stickerId}/android/sticker.png`;
                        return (
                          <div key={`fav-${key}`} className="group relative">
                            <button
                              onClick={() => handleSendSticker(s.packageId, s.stickerId)}
                              className="w-full rounded-lg border border-amber-200 p-1 hover:border-brand-300 hover:bg-gray-50"
                              title={key}
                            >
                              <img src={stickerUrl} alt="sticker" className="h-12 w-12 object-contain" />
                            </button>
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavoriteSticker(s.packageId, s.stickerId); }}
                              className="absolute -top-1 -right-1 rounded-full bg-white p-0.5 text-amber-500 shadow"
                              title="ยกเลิกติดดาว"
                            >
                              <Star className="h-3 w-3 fill-current" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <p className="mb-1 text-[11px] font-semibold text-gray-500">ทั้งหมด</p>
                <div className="max-h-56 overflow-y-auto pr-1">
                  <div className="grid grid-cols-5 gap-2">
                    {LINE_STICKERS.map((s) => {
                      const key = stickerKey(s.packageId, s.stickerId);
                      const isFav = favoriteStickers.includes(key);
                      const stickerUrl = `https://stickershop.line-scdn.net/stickershop/v1/sticker/${s.stickerId}/android/sticker.png`;
                      return (
                        <div key={key} className="group relative">
                          <button
                            onClick={() => handleSendSticker(s.packageId, s.stickerId)}
                            className="w-full rounded-lg border border-transparent p-1 hover:border-brand-300 hover:bg-gray-50"
                            title={key}
                          >
                            <img src={stickerUrl} alt="sticker" className="h-12 w-12 object-contain" />
                          </button>
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavoriteSticker(s.packageId, s.stickerId); }}
                            className={`absolute -top-1 -right-1 rounded-full bg-white p-0.5 shadow ${isFav ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500'}`}
                            title={isFav ? 'ยกเลิกติดดาว' : 'ติดดาว'}
                          >
                            <Star className={`h-3 w-3 ${isFav ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
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

