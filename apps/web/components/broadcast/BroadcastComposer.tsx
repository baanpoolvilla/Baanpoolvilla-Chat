'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import TargetSelector from './TargetSelector';
import axios from 'axios';

const ALL_PLATFORMS = ['LINE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK'];

interface BroadcastInitialData {
  name: string;
  content: string;
  mediaUrl?: string | null;
  targetType: 'ALL' | 'BY_TAG' | 'BY_PLATFORM';
  tagFilter?: string[];
  platforms?: string[];
  scheduledAt?: string | null;
}

interface BroadcastComposerProps {
  onDone?: () => void;
  broadcastId?: string;
  initialData?: BroadcastInitialData;
}

export default function BroadcastComposer({ onDone, broadcastId, initialData }: BroadcastComposerProps) {
  const isEditMode = Boolean(broadcastId);
  const router = useRouter();
  const [name, setName] = useState(initialData?.name ?? '');
  const [message, setMessage] = useState(initialData?.content ?? '');
  const [imageUrl, setImageUrl] = useState(initialData?.mediaUrl ?? '');
  const [target, setTarget] = useState<'ALL' | 'BY_TAG' | 'BY_PLATFORM'>(initialData?.targetType ?? 'ALL');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(initialData?.tagFilter ?? []);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(initialData?.platforms ?? ALL_PLATFORMS);
  const [scheduledAt, setScheduledAt] = useState(
    initialData?.scheduledAt ? new Date(initialData.scheduledAt).toISOString().slice(0, 16) : ''
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const [estimatedCount, setEstimatedCount] = useState<number | undefined>();
  const [error, setError] = useState('');

  const fetchEstimate = useCallback(async () => {
    try {
      const payload: Record<string, unknown> = {
        targetType: target,
        platforms: target === 'BY_PLATFORM' ? selectedPlatforms : ALL_PLATFORMS,
      };
      if (target === 'BY_TAG') payload.tagFilter = selectedTagIds;
      const res = await api.post('/api/broadcasts/estimate', payload);
      setEstimatedCount(res.data?.count ?? 0);
    } catch {
      setEstimatedCount(undefined);
    }
  }, [target, selectedTagIds, selectedPlatforms]);

  useEffect(() => {
    const shouldFetch =
      target === 'ALL' ||
      (target === 'BY_TAG' && selectedTagIds.length > 0) ||
      (target === 'BY_PLATFORM' && selectedPlatforms.length > 0);

    if (!shouldFetch) {
      setEstimatedCount(undefined);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void fetchEstimate();
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [fetchEstimate, selectedPlatforms.length, selectedTagIds.length, target]);

  const handleTargetChange = (newTarget: 'ALL' | 'BY_TAG' | 'BY_PLATFORM') => {
    setTarget(newTarget);
    setSelectedTagIds([]);
    setSelectedPlatforms(newTarget === 'BY_PLATFORM' ? [] : ALL_PLATFORMS);
    setEstimatedCount(undefined);
  };

  const handleTagIdsChange = (ids: string[]) => {
    setSelectedTagIds(ids);
  };

  const handlePlatformsChange = (platforms: string[]) => {
    setSelectedPlatforms(platforms);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('กรุณาเลือกไฟล์รูปภาพ');
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('รูปภาพต้องมีขนาดไม่เกิน 10 MB');
      e.target.value = '';
      return;
    }
    setError('');
    setUploadingImage(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await api.post('/api/media/upload', { data: base64, mimeType: file.type });
      const url = res.data?.data?.url;
      if (!url) throw new Error('อัปโหลดไม่สำเร็จ');
      setImageUrl(url);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.error || err.message)
        : (err instanceof Error ? err.message : 'อัปโหลดรูปไม่สำเร็จ');
      setError(`อัปโหลดรูปไม่สำเร็จ: ${msg}`);
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (sendNow: boolean) => {
    setError('');

    if (!name.trim()) {
      setError('กรุณาใส่ชื่อแคมเปญ');
      return;
    }
    if (!message.trim()) {
      setError('กรุณาใส่ข้อความ');
      return;
    }
    if (target === 'BY_TAG' && selectedTagIds.length === 0) {
      setError('กรุณาเลือกอย่างน้อย 1 แท็ก');
      return;
    }
    if (target === 'BY_PLATFORM' && selectedPlatforms.length === 0) {
      setError('กรุณาเลือกอย่างน้อย 1 แพลตฟอร์ม');
      return;
    }
    if (estimatedCount === 0) {
      setError('ไม่พบผู้รับที่ตรงกับเงื่อนไข กรุณาแท็กบทสนทนาก่อนส่ง Broadcast');
      return;
    }

    setSending(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        content: message.trim(),
        contentType: imageUrl.trim() ? 'IMAGE' : 'TEXT',
        targetType: target,
        platforms: target === 'BY_PLATFORM' ? selectedPlatforms : ALL_PLATFORMS,
      };
      if (imageUrl.trim()) payload.mediaUrl = imageUrl.trim();
      if (target === 'BY_TAG') payload.tagFilter = selectedTagIds;
      if (!sendNow && scheduledAt) {
        payload.scheduledAt = new Date(scheduledAt).toISOString();
      }

      let broadcastIdToSend: string;
      if (isEditMode && broadcastId) {
        await api.put(`/api/broadcasts/${broadcastId}`, payload);
        broadcastIdToSend = broadcastId;
      } else {
        const res = await api.post('/api/broadcasts', payload);
        broadcastIdToSend = res.data?.id || res.data?.data?.id;
      }

      if (sendNow && broadcastIdToSend && !isEditMode) {
        await api.post(`/api/broadcasts/${broadcastIdToSend}/send`);
      }

      if (onDone) {
        onDone();
      } else {
        router.push('/broadcast');
        router.refresh();
      }
    } catch (err: unknown) {
      const errorMessage = axios.isAxiosError(err)
        ? (err.response?.data?.error || err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
        : (err instanceof Error ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่');
      setError(errorMessage);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{isEditMode ? 'แก้ไขการส่งข้อความ' : 'สร้างการส่งข้อความ'}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {isEditMode ? 'แก้ไขแคมเปญ (สามารถแก้ได้เฉพาะแบบร่างและที่ตั้งเวลาไว้)' : 'สร้างแคมเปญเพื่อส่งข้อความถึงผู้ติดต่อ'}
          </p>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Campaign Name */}
          <div>
            <label
              htmlFor="broadcast-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              ชื่อแคมเปญ
            </label>
            <input
              id="broadcast-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น โปรโมชั่นเดือนมกราคม"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              maxLength={200}
            />
          </div>

          {/* Message */}
          <div>
            <label
              htmlFor="broadcast-message"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              ข้อความ
            </label>
            <textarea
              id="broadcast-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="พิมพ์ข้อความที่ต้องการส่ง..."
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
              maxLength={5000}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">
              {message.length}/5,000
            </p>
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              รูปภาพ (ไม่บังคับ)
            </label>
            {imageUrl ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="ตัวอย่างรูปภาพ"
                  className="max-h-48 rounded-lg border border-gray-200 object-contain"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm leading-none transition-colors"
                  aria-label="ลบรูปภาพ"
                >
                  ×
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-brand-400 hover:bg-gray-50 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                  disabled={uploadingImage}
                />
                {uploadingImage ? (
                  <span className="text-sm text-gray-500">กำลังอัปโหลด...</span>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span className="text-sm text-gray-600">คลิกเพื่อเลือกรูปภาพ</span>
                    <span className="text-xs text-gray-400 mt-1">PNG, JPG, GIF สูงสุด 10 MB</span>
                  </>
                )}
              </label>
            )}
          </div>

          {/* Target Selector */}
          <TargetSelector
            target={target}
            onTargetChange={handleTargetChange}
            selectedTagIds={selectedTagIds}
            onTagIdsChange={handleTagIdsChange}
            selectedPlatforms={selectedPlatforms}
            onPlatformsChange={handlePlatformsChange}
            estimatedCount={estimatedCount}
          />

          {/* Schedule */}
          <div>
            <label
              htmlFor="broadcast-schedule"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              ตั้งเวลาส่ง (ไม่บังคับ)
            </label>
            <input
              id="broadcast-schedule"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
            {scheduledAt && (
              <button
                type="button"
                onClick={() => setScheduledAt('')}
                className="text-xs text-gray-500 hover:text-gray-700 mt-1"
              >
                ล้างเวลา
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
          >
            ยกเลิก
          </button>
          <div className="flex gap-3">
            {isEditMode ? (
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={sending || uploadingImage}
                className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
            ) : scheduledAt ? (
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={sending || uploadingImage}
                className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? 'กำลังบันทึก...' : 'ตั้งเวลาส่ง'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={sending || uploadingImage}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  บันทึกแบบร่าง
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={sending || uploadingImage}
                  className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sending ? 'กำลังส่ง...' : 'ส่งทันที'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
