'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import type { Admin } from '@/types';
import { X, User } from 'lucide-react';

interface AssignModalProps {
  conversationId: string;
  isOpen: boolean;
  onClose: () => void;
  onAssigned: () => void;
}

export default function AssignModal({ conversationId, isOpen, onClose, onAssigned }: AssignModalProps) {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.get<Admin[]>('/admins').then((res) => setAdmins(res.data)).catch(console.error);
    }
  }, [isOpen]);

  const handleAssign = async (adminId: string) => {
    try {
      setLoading(true);
      await api.post(`/conversations/${conversationId}/assign`, { adminId });
      onAssigned();
      onClose();
    } catch (error) {
      console.error('Failed to assign:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-semibold">Assign Conversation</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {admins.map((admin) => (
            <button
              key={admin.id}
              onClick={() => handleAssign(admin.id)}
              disabled={loading}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-gray-100 disabled:opacity-50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-700">
                {admin.avatar ? (
                  <img src={admin.avatar} alt="" className="h-8 w-8 rounded-full" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{admin.name}</p>
                <p className="text-xs text-gray-500">{admin.role}</p>
              </div>
              <div className="ml-auto">
                <span className={`h-2 w-2 rounded-full inline-block ${admin.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
