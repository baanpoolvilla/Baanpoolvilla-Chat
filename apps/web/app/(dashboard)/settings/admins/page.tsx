'use client';

import { useState, useEffect, FormEvent } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface Admin {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function AdminsPage() {
  const currentAdmin = useAuth((s) => s.admin);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Create form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('AGENT');

  const fetchAdmins = () => {
    setLoading(true);
    api
      .get('/api/admins')
      .then((res) => setAdmins(res.data.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      await api.post('/api/admins', {
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
      });
      setShowCreate(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('AGENT');
      fetchAdmins();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (admin: Admin) => {
    await api.put(`/api/admins/${admin.id}`, { isActive: !admin.isActive });
    fetchAdmins();
  };

  const handleDelete = async (admin: Admin) => {
    if (admin.id === currentAdmin?.id) return;
    if (!confirm(`ลบผู้ดูแล ${admin.name}?`)) return;
    await api.delete(`/api/admins/${admin.id}`);
    fetchAdmins();
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      SUPER_ADMIN: 'bg-red-100 text-red-700',
      ADMIN: 'bg-blue-100 text-blue-700',
      AGENT: 'bg-gray-100 text-gray-700',
    };
    const labels: Record<string, string> = {
      SUPER_ADMIN: 'Super Admin',
      ADMIN: 'Admin',
      AGENT: 'Agent',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[role] || styles.AGENT}`}>
        {labels[role] || role}
      </span>
    );
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">จัดการผู้ดูแล</h1>
          <p className="text-sm text-gray-500">เพิ่มและจัดการสิทธิ์ผู้ดูแลระบบ</p>
        </div>
        {currentAdmin?.role === 'SUPER_ADMIN' && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            เพิ่มผู้ดูแล
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">เพิ่มผู้ดูแลใหม่</h2>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">บทบาท</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                >
                  <option value="AGENT">Agent</option>
                  <option value="ADMIN">Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setError('');
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {creating ? 'กำลังสร้าง...' : 'สร้าง'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admin List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">ชื่อ</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">อีเมล</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">บทบาท</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-sm font-medium text-brand-700">
                        {admin.name[0]}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{admin.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{admin.email}</td>
                  <td className="px-6 py-4">{getRoleBadge(admin.role)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${admin.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {admin.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {currentAdmin?.role === 'SUPER_ADMIN' && admin.id !== currentAdmin?.id && (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleToggleActive(admin)}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          {admin.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                        </button>
                        <button
                          onClick={() => handleDelete(admin)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          ลบ
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
