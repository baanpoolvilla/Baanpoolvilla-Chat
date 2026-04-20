'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import TargetSelector from './TargetSelector';
import axios from 'axios';

const ALL_PLATFORMS = ['LINE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK'];

interface BroadcastComposerProps {
  onDone?: () => void;
}

export default function BroadcastComposer({ onDone }: BroadcastComposerProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [target, setTarget] = useState<'ALL' | 'BY_TAG' | 'BY_PLATFORM'>('ALL');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(ALL_PLATFORMS);
  const [scheduledAt, setScheduledAt] = useState('');
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

  const handleTargetChange = (newTarget: 'ALL' | 'BY_TAG' | 'BY_PLATFORM') => {
    setTarget(newTarget);
    setSelectedTagIds([]);
    setSelectedPlatforms(newTarget === 'BY_PLATFORM' ? [] : ALL_PLATFORMS);
    setEstimatedCount(undefined);
    if (newTarget === 'ALL') {
      api.post('/api/broadcasts/estimate', { targetType: 'ALL', platforms: ALL_PLATFORMS }).then((res) => {
        setEstimatedCount(res.data?.count ?? 0);
      }).catch(() => {});
    }
  };

  const handleTagIdsChange = (ids: string[]) => {
    setSelectedTagIds(ids);
    if (ids.length > 0) {
      setTimeout(fetchEstimate, 300);
    }
  };

  const handlePlatformsChange = (platforms: string[]) => {
    setSelectedPlatforms(platforms);
    if (platforms.length > 0) {
      setTimeout(fetchEstimate, 300);
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

      const res = await api.post('/api/broadcasts', payload);
      const broadcastId = res.data?.id || res.data?.data?.id;

      if (sendNow && broadcastId) {
        await api.post(`/api/broadcasts/${broadcastId}/send`);
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
          <h2 className="text-lg font-semibold text-gray-900">สร้างการส่งข้อความ</h2>
          <p className="text-sm text-gray-500 mt-1">
            สร้างแคมเปญเพื่อส่งข้อความถึงผู้ติดต่อ
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

          {/* Image URL */}
          <div>
            <label
              htmlFor="broadcast-image"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              URL รูปภาพ (ไม่บังคับ)
            </label>
            <input
              id="broadcast-image"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
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
            {scheduledAt ? (
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={sending}
                className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? 'กำลังบันทึก...' : 'ตั้งเวลาส่ง'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={sending}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  บันทึกแบบร่าง
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={sending}
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
