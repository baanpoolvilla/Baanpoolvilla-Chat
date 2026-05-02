'use client';

import { FormEvent, useState } from 'react';
import api from '@/lib/api';
import axios from 'axios';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('ยืนยันรหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }
    if (currentPassword === newPassword) {
      setError('รหัสผ่านใหม่ต้องไม่ซ้ำรหัสผ่านเดิม');
      return;
    }

    setSaving(true);
    try {
      await api.post('/api/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.error || err.message || 'เกิดข้อผิดพลาด')
        : (err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto w-full max-w-xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">เปลี่ยนรหัสผ่าน</h1>
          <p className="text-sm text-gray-500">อัปเดตรหัสผ่านสำหรับบัญชีที่กำลังใช้งาน</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">รหัสผ่านปัจจุบัน</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">รหัสผ่านใหม่</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">ยืนยันรหัสผ่านใหม่</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}