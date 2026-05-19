'use client';

import { create } from 'zustand';
import api from '@/lib/api';
import type { Admin, LoginResponse } from '@/types';

interface AuthState {
  admin: Admin | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => void;
  refreshProfile: () => Promise<void>;
}

function readStoredAdmin(): Pick<AuthState, 'admin' | 'isAuthenticated' | 'isLoading'> {
  if (typeof window === 'undefined') {
    return { admin: null, isAuthenticated: false, isLoading: true };
  }

  const token = localStorage.getItem('accessToken');
  const adminStr = localStorage.getItem('admin');

  if (!token || !adminStr) {
    return { admin: null, isAuthenticated: false, isLoading: false };
  }

  try {
    const admin = JSON.parse(adminStr) as Admin;
    return { admin, isAuthenticated: true, isLoading: false };
  } catch {
    return { admin: null, isAuthenticated: false, isLoading: false };
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  ...readStoredAdmin(),

  login: async (email: string, password: string) => {
    const response = await api.post<LoginResponse>('/api/auth/login', { email, password });
    const { accessToken, refreshToken, admin } = response.data;

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('admin', JSON.stringify(admin));

    set({ admin, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Ignore logout errors
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('admin');
    set({ admin: null, isAuthenticated: false, isLoading: false });
  },

  loadSession: () => {
    set(readStoredAdmin());
  },

  refreshProfile: async () => {
    try {
      const response = await api.get<Admin>('/api/auth/me');
      const admin = response.data;
      localStorage.setItem('admin', JSON.stringify(admin));
      set({ admin });
    } catch {
      // Ignore profile refresh errors
    }
  },
}));
