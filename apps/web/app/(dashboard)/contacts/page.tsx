'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import type { Contact } from '@/types';
import { getPlatformIcon, getPlatformColor, formatTimeAgo } from '@/lib/utils';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 30;

  useEffect(() => {
    setLoading(true);
    api
      .get('/api/contacts', { params: { search, page, limit } })
      .then((res) => {
        setContacts(res.data.data || []);
        setTotal(res.data.meta?.total || 0);
      })
      .finally(() => setLoading(false));
  }, [search, page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">ผู้ติดต่อ</h1>
            <p className="text-sm text-gray-500">{total.toLocaleString()} รายการ</p>
          </div>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="ค้นหาชื่อ, อีเมล, เบอร์โทร..."
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
        />
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">ไม่พบผู้ติดต่อ</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  ชื่อ
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  แพลตฟอร์ม
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  อีเมล
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  เบอร์โทร
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  อัปเดตล่าสุด
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                        {(contact.displayName || '?')[0]}
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {contact.displayName || 'ไม่ทราบชื่อ'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1">
                      {contact.platformLinks?.map((pc) => (
                        <span
                          key={pc.id}
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${getPlatformColor(pc.platform)}`}
                        >
                          {getPlatformIcon(pc.platform)} {pc.platform}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {contact.email || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {contact.phone || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatTimeAgo(contact.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-200 bg-white flex items-center justify-between">
          <p className="text-sm text-gray-500">
            หน้า {page} จาก {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              ก่อนหน้า
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              ถัดไป
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
