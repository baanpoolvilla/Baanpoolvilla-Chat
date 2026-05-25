'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatTimeAgo } from '@/lib/utils';
import BroadcastComposer from '@/components/broadcast/BroadcastComposer';

interface Broadcast {
  id: string;
  name: string;
  content: string;
  contentType: string;
  mediaUrl?: string | null;
  targetType: string;
  platforms: string[];
  tagFilter: { tagIds?: string[] } | null;
  status: string;
  totalCount: number;
  sentCount: number;
  failCount: number;
  scheduledAt: string | null;
  createdAt: string;
}

export default function BroadcastPage() {
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<Broadcast | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Broadcast | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadBroadcasts = () => {
    setLoading(true);
    api
      .get('/api/broadcasts')
      .then((res) => setBroadcasts(res.data.broadcasts || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (view === 'list') loadBroadcasts();
  }, [view]);

  const canEdit = (status: string) => status === 'DRAFT' || status === 'SCHEDULED';
  const canDelete = (status: string) => status !== 'SENDING';

  const handleEdit = (b: Broadcast) => {
    setEditTarget(b);
    setView('edit');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/broadcasts/${deleteTarget.id}`);
      setBroadcasts((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

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
        <BroadcastComposer onDone={() => setView('list')} />
      </div>
    );
  }

  if (view === 'edit' && editTarget) {
    return (
      <div className="h-full overflow-auto p-6">
        <button
          onClick={() => { setView('list'); setEditTarget(null); }}
          className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
        >
          ← กลับ
        </button>
        <BroadcastComposer
          broadcastId={editTarget.id}
          initialData={{
            name: editTarget.name,
            content: editTarget.content,
            mediaUrl: editTarget.mediaUrl,
            targetType: (editTarget.targetType === 'CUSTOM' ? 'ALL' : editTarget.targetType) as 'ALL' | 'BY_TAG' | 'BY_PLATFORM',
            tagFilter: editTarget.tagFilter?.tagIds ?? [],
            platforms: editTarget.platforms,
            scheduledAt: editTarget.scheduledAt,
          }}
          onDone={() => { setView('list'); setEditTarget(null); }}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">ลบการประกาศ</h3>
            <p className="text-sm text-gray-600 mb-1">
              คุณต้องการลบ <span className="font-medium text-gray-900">{deleteTarget.name}</span> ใช่หรือไม่?
            </p>
            <p className="text-xs text-gray-400 mb-5">การดำเนินการนี้ไม่สามารถยกเลิกได้</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'กำลังลบ...' : 'ลบ'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">ผู้รับ</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">ส่งสำเร็จ</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">ล้มเหลว</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">สร้างเมื่อ</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {broadcasts.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{b.name}</p>
                    <p className="text-xs text-gray-500 truncate max-w-xs">{b.content}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {b.targetType === 'ALL' ? 'ทั้งหมด' : b.targetType === 'BY_TAG' ? 'ตามแท็ก' : 'ตามแพลตฟอร์ม'}
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(b.status)}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                    {b.totalCount > 0 ? b.totalCount : (
                      <span className="text-yellow-600">0 (ไม่พบผู้รับ)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-green-600 font-medium">{b.sentCount}</td>
                  <td className="px-6 py-4 text-sm text-red-600 font-medium">{b.failCount}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatTimeAgo(b.createdAt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {canEdit(b.status) && (
                        <button
                          onClick={() => handleEdit(b)}
                          className="text-xs px-2 py-1 text-brand-600 hover:text-brand-800 hover:bg-brand-50 rounded transition-colors"
                        >
                          แก้ไข
                        </button>
                      )}
                      {canDelete(b.status) && (
                        <button
                          onClick={() => setDeleteTarget(b)}
                          className="text-xs px-2 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                        >
                          ลบ
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
