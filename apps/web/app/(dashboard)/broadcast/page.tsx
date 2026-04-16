'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatTimeAgo } from '@/lib/utils';
import BroadcastComposer from '@/components/broadcast/BroadcastComposer';

interface Broadcast {
  id: string;
  name: string;
  message: string;
  target: string;
  status: string;
  totalSent: number;
  totalFailed: number;
  scheduledAt: string | null;
  createdAt: string;
}

export default function BroadcastPage() {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (view === 'list') {
      setLoading(true);
      api
        .get('/api/broadcasts')
        .then((res) => setBroadcasts(res.data.data || []))
        .finally(() => setLoading(false));
    }
  }, [view]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-700',
      SCHEDULED: 'bg-yellow-100 text-yellow-700',
      SENDING: 'bg-blue-100 text-blue-700',
      COMPLETED: 'bg-green-100 text-green-700',
      FAILED: 'bg-red-100 text-red-700',
    };
    const labels: Record<string, string> = {
      DRAFT: 'แบบร่าง',
      SCHEDULED: 'ตั้งเวลา',
      SENDING: 'กำลังส่ง',
      COMPLETED: 'สำเร็จ',
      FAILED: 'ล้มเหลว',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.DRAFT}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (view === 'create') {
    return (
      <div className="h-full overflow-auto p-6">
        <button
          onClick={() => setView('list')}
          className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
        >
          ← กลับ
        </button>
        <BroadcastComposer />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ส่งข้อความ (Broadcast)</h1>
          <p className="text-sm text-gray-500">จัดการการส่งข้อความกลุ่ม</p>
        </div>
        <button
          onClick={() => setView('create')}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          สร้างใหม่
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">ยังไม่มีการส่งข้อความ</p>
            <button
              onClick={() => setView('create')}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
            >
              สร้างรายการแรก
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">ชื่อ</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">กลุ่มเป้าหมาย</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">ส่งสำเร็จ</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">ล้มเหลว</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">สร้างเมื่อ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {broadcasts.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{b.name}</p>
                    <p className="text-xs text-gray-500 truncate max-w-xs">{b.message}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {b.target === 'ALL' ? 'ทั้งหมด' : b.target === 'BY_TAG' ? 'ตามแท็ก' : 'ตามแพลตฟอร์ม'}
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(b.status)}</td>
                  <td className="px-6 py-4 text-sm text-green-600 font-medium">{b.totalSent}</td>
                  <td className="px-6 py-4 text-sm text-red-600 font-medium">{b.totalFailed}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatTimeAgo(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
