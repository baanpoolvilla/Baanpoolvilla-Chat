'use client';

import { useState, useEffect, useRef, useCallback, type ChangeEvent, type ClipboardEvent } from 'react';
import { X, Search, Send, Loader2, MessageSquarePlus, ImagePlus } from 'lucide-react';
import api from '@/lib/api';
import type { Conversation } from '@/types';
import { cn } from '@/lib/utils';
import PlatformBadge from '@/components/common/PlatformBadge';
import QuickReplyPicker from './QuickReplyPicker';

interface BulkSendModalProps {
  onClose: () => void;
}

type SendResult = { conversationId: string; success: boolean; error?: string };

interface PendingImage {
  // null when the image is already on the server (picked from a quick reply)
  file: File | null;
  previewUrl: string;
  // Already-uploaded URL — send as-is instead of re-uploading
  remoteUrl?: string;
}

function revokePreview(previewUrl: string) {
  if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
}

const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
// The API caps conversationIds at 50 per request.
const BULK_BATCH_SIZE = 50;

function readAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

function chunk<T>(items: T[], size: number) {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

export default function BulkSendModal({ onClose }: BulkSendModalProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [images, setImages] = useState<PendingImage[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const quickReplyBtnRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<{ conversations: Conversation[] }>('/api/conversations', {
        params: { limit: 200 },
      })
      .then((r) => setConversations(r.data.conversations ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = conversations.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.contact.displayName.toLowerCase().includes(q) ||
      (c.lastMessage ?? '').toLowerCase().includes(q)
    );
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  // Revoke preview object URLs on unmount
  useEffect(() => {
    return () => {
      setImages((prev) => {
        prev.forEach((img) => revokePreview(img.previewUrl));
        return prev;
      });
    };
  }, []);

  const addImages = useCallback((files: File[]) => {
    const picked: PendingImage[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setSendError('แนบได้เฉพาะไฟล์รูปภาพ');
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setSendError(`รูป "${file.name}" ใหญ่เกิน 10 MB`);
        continue;
      }
      picked.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    if (picked.length === 0) return;

    setImages((prev) => {
      const combined = [...prev, ...picked];
      if (combined.length > MAX_IMAGES) {
        combined.slice(MAX_IMAGES).forEach((img) => revokePreview(img.previewUrl));
        setSendError(`แนบรูปได้สูงสุด ${MAX_IMAGES} รูป`);
        return combined.slice(0, MAX_IMAGES);
      }
      return combined;
    });
  }, []);

  const removeImage = (index: number) => {
    setImages((prev) => {
      revokePreview(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
    setSendError(null);
  };

  const handleSelectQuickReply = (text: string, mediaUrl?: string | null) => {
    // '[Image]' is the placeholder an image-only quick reply stores as its content.
    setContent(mediaUrl && text === '[Image]' ? '' : text);

    if (mediaUrl) {
      setImages((prev) =>
        prev.length >= MAX_IMAGES ? prev : [...prev, { file: null, previewUrl: mediaUrl, remoteUrl: mediaUrl }]
      );
    }

    setShowQuickReplies(false);
  };

  const handleFilePick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) addImages(files);
    e.target.value = '';
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = Array.from(e.clipboardData?.items || [])
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (pasted.length > 0) {
      e.preventDefault();
      addImages(pasted);
    }
  };

  const handleSend = async () => {
    const text = content.trim();
    if ((!text && images.length === 0) || selected.size === 0 || isSending) return;

    setIsSending(true);
    setSendError(null);
    try {
      const conversationIds = Array.from(selected);

      // Upload each image once and reuse its URL for every conversation.
      const mediaUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        if (image.remoteUrl) {
          // Already uploaded (quick reply image) — reuse the stored URL.
          mediaUrls.push(image.remoteUrl);
          continue;
        }

        setUploadProgress({ current: i + 1, total: images.length });
        try {
          const base64 = await readAsBase64(image.file!);
          const uploadRes = await api.post('/api/media/upload', {
            data: base64,
            mimeType: image.file!.type,
          });
          const url = uploadRes.data?.data?.url;
          if (!url) throw new Error('เซิร์ฟเวอร์ไม่ได้ส่ง URL กลับมา');
          mediaUrls.push(url);
        } catch (uploadErr: unknown) {
          const msg = uploadErr instanceof Error ? uploadErr.message : 'อัปโหลดไม่สำเร็จ';
          setSendError(`อัปโหลดรูปที่ ${i + 1} ไม่สำเร็จ: ${msg}`);
          return;
        }
      }
      setUploadProgress(null);

      const payloads =
        mediaUrls.length === 0
          ? [{ content: text, contentType: 'TEXT' as const, mediaUrl: undefined }]
          : mediaUrls.map((mediaUrl, i) => ({
              // The caption rides on the first image — every platform sends it
              // as a separate text message right before the image.
              content: i === 0 && text ? text : '[Image]',
              contentType: 'IMAGE' as const,
              mediaUrl,
            }));

      const merged = new Map<string, SendResult>();
      for (const payload of payloads) {
        for (const batch of chunk(conversationIds, BULK_BATCH_SIZE)) {
          const res = await api.post<{ results: SendResult[] }>('/api/messages/bulk-send', {
            conversationIds: batch,
            ...payload,
          });
          for (const result of res.data.results) {
            // A chat counts as sent only if every image/message reached it.
            const previous = merged.get(result.conversationId);
            if (!previous || previous.success) merged.set(result.conversationId, result);
          }
        }
      }

      setResults(
        conversationIds.map(
          (id) => merged.get(id) ?? { conversationId: id, success: false, error: 'ไม่ได้รับผลลัพธ์' }
        )
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'ส่งไม่สำเร็จ';
      setSendError(`ส่งข้อความไม่สำเร็จ: ${msg}`);
    } finally {
      setUploadProgress(null);
      setIsSending(false);
    }
  };

  const allFilteredSelected = filtered.length > 0 && selected.size === filtered.length;
  const successCount = results?.filter((r) => r.success).length ?? 0;
  const failCount = results?.filter((r) => !r.success).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">ส่งข้อความหลายแชท</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {results ? (
          /* Results */
          <div className="flex flex-col items-center justify-center gap-3 p-10">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">
                {successCount} / {results.length}
              </p>
              <p className="mt-1 text-gray-500">ส่งสำเร็จ</p>
            </div>
            {failCount > 0 && (
              <p className="text-sm text-red-500">{failCount} รายการส่งไม่สำเร็จ</p>
            )}
            <button
              onClick={onClose}
              className="mt-4 rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              ปิด
            </button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row overflow-hidden">
            {/* Left — conversation selector */}
            <div className="flex min-h-0 flex-col border-b border-gray-200 md:w-1/2 md:border-b-0 md:border-r">
              <div className="flex-shrink-0 p-3 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาแชท..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    เลือกแล้ว{' '}
                    <span className="font-semibold text-brand-600">{selected.size}</span> แชท
                  </span>
                  <button
                    onClick={toggleAll}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    {allFilteredSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto max-h-52 md:max-h-none">
                {isLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="py-10 text-center text-sm text-gray-400">ไม่พบแชท</p>
                ) : (
                  filtered.map((conv) => {
                    const isChecked = selected.has(conv.id);
                    return (
                      <button
                        key={conv.id}
                        onClick={() => toggleSelect(conv.id)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50',
                          isChecked && 'bg-brand-50 hover:bg-brand-50'
                        )}
                      >
                        {/* Checkbox */}
                        <div
                          className={cn(
                            'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors',
                            isChecked ? 'border-brand-600 bg-brand-600' : 'border-gray-300 bg-white'
                          )}
                        >
                          {isChecked && (
                            <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                              <path
                                d="M2 6l3 3 5-5"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-gray-900">
                              {conv.contact.displayName}
                            </span>
                            <PlatformBadge platform={conv.platform} compact showLabel={false} />
                          </div>
                          {conv.lastMessage && (
                            <p className="truncate text-xs text-gray-400">{conv.lastMessage}</p>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right — message composer */}
            <div className="flex flex-shrink-0 flex-col gap-3 p-4 md:w-1/2 md:flex-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">ข้อความที่จะส่ง</label>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSending}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                    title="แนบรูปภาพ"
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    แนบรูป
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFilePick}
                  />
                  <div ref={quickReplyBtnRef} className="relative">
                    <button
                      onClick={() => setShowQuickReplies((v) => !v)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                        showQuickReplies
                          ? 'bg-brand-100 text-brand-700'
                          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                      )}
                      title="ข้อความสำเร็จรูป"
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                      Quick Reply
                    </button>
                    {showQuickReplies && (
                      <QuickReplyPicker
                        onSelect={handleSelectQuickReply}
                        onClose={() => setShowQuickReplies(false)}
                        className="absolute right-0 top-full z-50 mt-1 w-80 rounded-xl border border-gray-200 bg-white shadow-xl"
                      />
                    )}
                  </div>
                </div>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onPaste={handlePaste}
                placeholder={images.length > 0 ? 'ใส่ข้อความประกอบรูป (ไม่ใส่ก็ได้)...' : 'พิมพ์ข้อความ... (วางรูปได้)'}
                className="flex-1 resize-none rounded-lg border border-gray-300 p-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 min-h-[160px]"
              />

              {images.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {images.map((img, i) => (
                    <div key={i} className="relative h-16 w-16 flex-shrink-0">
                      <img
                        src={img.previewUrl}
                        alt=""
                        className="h-full w-full rounded-lg border border-gray-200 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        disabled={isSending}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700/80 text-white shadow disabled:opacity-50"
                        title="ลบรูป"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {sendError && <p className="text-xs font-medium text-red-500">{sendError}</p>}

              {images.length > 0 && selected.size > 0 && (
                <p className="text-xs text-gray-500">
                  จะส่ง {images.length} รูป{content.trim() ? ' พร้อมข้อความ' : ''} ไปยัง {selected.size} แชท
                  {' '}(รวม {images.length * selected.size} ข้อความ)
                </p>
              )}

              <button
                onClick={handleSend}
                disabled={(!content.trim() && images.length === 0) || selected.size === 0 || isSending}
                className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {uploadProgress
                  ? `กำลังอัปโหลดรูป ${uploadProgress.current}/${uploadProgress.total}...`
                  : isSending
                  ? 'กำลังส่ง...'
                  : `ส่งถึง ${selected.size} แชท`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
