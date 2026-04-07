'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { User } from '@/types';

export function useAuth() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<User>('/api/auth/me'),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user: data?.data ?? null,
    isLoading,
    isAuthenticated: !!data?.data,
    error,
  };
}

export function useLogin() {
  const qc = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      api.post<{ user: User }>('/api/auth/login', credentials),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      router.push('/dashboard');
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => api.post('/api/auth/logout'),
    onSuccess: () => {
      qc.clear();
      router.push('/login');
    },
  });
}
