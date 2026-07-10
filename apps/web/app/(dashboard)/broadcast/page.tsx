'use client';

import { useState, useEffect } from 'react';
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

type View = 'list' | 'create' | 'edit' | 'detail';

export default function BroadcastPage() {
  const [view, setView] = useState<View>('list');
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<Broadcast | null>(null);
  const [detailTarget, setDetailTarget] = useState<Broadcast | null>(null);
  const [templateData, setTemplateData] = useState<Broadcast | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Broadcast | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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

  const goList = () => {
    setView('list');
    setEditTarget(null);
    setDetailTarget(null);
    setTemplateData(null);
  };

  const goCreate = () => {
    setTemplateData(null);
    setView('create');
  };

  const handleEdit = (b: Broadcast) => {
    setEditTarget(b);
    setView('edit');
  };

  const handleUseAsTemplate = (b: Broadcast) => {
    setTemplateData(b);
    setView('create');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/api/broadcasts/${deleteTarget.id}`);
      setBroadcasts((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      if (detailTarget?.id === deleteTarget.id) {
        setDetailTarget(null);
        setView('list');
      }
      setDeleteTarget(null);
    } catch {
      setDeleteError('ลบไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setDeleting(false);
    }
  };

  const targetLabel = (t: string) =>
    t === 'ALL' ? 'ทั้งหมด' : t === 'BY_TAG' ? 'ตามแท็ก' : t === 'BY_PLATFORM' ? 'ตามแพลตฟอร์ม' : t;

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

  const tabClass = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      active ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'
    }`;

  // ── Create view ──────────────────────────────────────────────
  if (view === 'create') {
    return (
      <div className="h-full overflow-auto p-6">
        <button
          onClick={goList}
          className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
        >
          ← กลับ
        </button>
        <BroadcastComposer
          key={templateData?.id ?? 'blank'}
          initialData={
            templateData
              ? {
                  name: templateData.name,
                  content: templateData.content,
                  mediaUrl: templateData.mediaUrl,
                  targetType: (templateData.targetType === 'CUSTOM' ? 'ALL' : templateData.targetType) as 'ALL' | 'BY_TAG' | 'BY_PLATFORM',
                  tagFilter: templateData.tagFilter?.tagIds ?? [],
                  platforms: templateData.platforms,
                  scheduledAt: null,
                }
              : undefined
          }
          onDone={goList}
        />
      </div>
    );
  }

  // ── Edit view ────────────────────────────────────────────────
  if (view === 'edit' && editTarget) {
    return (
      <div className="h-full overflow-auto p-6">
        <button
          onClick={goList}
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
          onDone={goList}
        />
      </div>
    );
  }

  // ── Detail view ──────────────────────────────────────────────
  if (view === 'detail' && detailTarget) {
    const b = detailTarget;
    return (
      <div className="h-full overflow-auto p-6">
        <button
          onClick={goList}
          className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
        >
          ← กลับ
        </button>
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{b.name}</h2>
              <div className="mt-2">{getStatusBadge(b.status)}</div>
            </div>
            <button
              onClick={() => handleUseAsTemplate(b)}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors whitespace-nowrap"
            >
              ใช้เป็นเทมเพลต
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">ข้อความ</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{b.content}</p>
            </div>

            {b.mediaUrl && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">รูปภาพ</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.mediaUrl} alt={b.name} className="max-h-64 rounded-lg border border-gray-200 object-contain" />
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">กลุ่มเป้าหมาย</p>
                <p className="text-sm text-gray-800">{targetLabel(b.targetType)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">ผู้รับ</p>
                <p className="text-sm text-gray-800">{b.totalCount}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">ส่งสำเร็จ</p>
                <p className="text-sm text-green-600 font-medium">{b.sentCount}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">ล้มเหลว</p>
                <p className="text-sm text-red-600 font-medium">{b.failCount}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">แพลตฟอร์ม</p>
              <p className="text-sm text-gray-800">{b.platforms.join(', ') || '-'}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">สร้างเมื่อ</p>
              <p className="text-sm text-gray-800">{formatTimeAgo(b.createdAt)}</p>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 flex items-center gap-3">
            {canEdit(b.status) && (
              <button
                onClick={() => handleEdit(b)}
                className="px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
              >
                แก้ไข
              </button>
            )}
            {canDelete(b.status) && (
              <button
                onClick={() => setDeleteTarget(b)}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                ลบ
              </button>
            )}
          </div>
        </div>

        {/* Delete confirmation modal (shared) */}
        {deleteTarget && (
          <DeleteModal
            name={deleteTarget.name}
            deleting={deleting}
            error={deleteError}
            onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
            onConfirm={handleDeleteConfirm}
          />
        )}
      </div>
    );
  }

  // ── List view (tab: ประกาศ) ──────────────────────────────────
  return (
    <div className="h-full flex flex-col">
      {deleteTarget && (
        <DeleteModal
          name={deleteTarget.name}
          deleting={deleting}
          error={deleteError}
          onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
          onConfirm={handleDeleteConfirm}
        />
      )}

      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">ส่งข้อความ (Broadcast)</h1>
            <p className="text-sm text-gray-500">จัดการการส่งข้อความกลุ่ม</p>
          </div>
        </div>
        {/* Tabs: ประกาศ | สร้างใหม่ */}
        <div className="flex items-center gap-2 mt-4">
          <button className={tabClass(true)} onClick={goList}>
            ประกาศ
          </button>
          <button className={tabClass(false)} onClick={goCreate}>
            สร้างใหม่
          </button>
        </div>
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
              onClick={goCreate}
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
                <tr
                  key={b.id}
                  onClick={() => { setDetailTarget(b); setView('detail'); }}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{b.name}</p>
                    <p className="text-xs text-gray-500 truncate max-w-xs">{b.content}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{targetLabel(b.targetType)}</td>
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
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUseAsTemplate(b); }}
                        className="text-xs px-2 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                      >
                        ใช้เป็นเทมเพลต
                      </button>
                      {canEdit(b.status) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(b); }}
                          className="text-xs px-2 py-1 text-brand-600 hover:text-brand-800 hover:bg-brand-50 rounded transition-colors"
                        >
                          แก้ไข
                        </button>
                      )}
                      {canDelete(b.status) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(b); }}
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

function DeleteModal({
  name,
  deleting,
  error,
  onCancel,
  onConfirm,
}: {
  name: string;
  deleting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-base font-semibold text-gray-900 mb-2">ลบการประกาศ</h3>
        <p className="text-sm text-gray-600 mb-1">
          คุณต้องการลบ <span className="font-medium text-gray-900">{name}</span> ใช่หรือไม่?
        </p>
        <p className="text-xs text-gray-400 mb-2">การดำเนินการนี้ไม่สามารถยกเลิกได้</p>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'กำลังลบ...' : 'ลบ'}
          </button>
        </div>
      </div>
    </div>
  );
}
