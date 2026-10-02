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
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });

      // Quem não pode ver o dashboard cai direto no PDV. Mandar todo mundo
      // para '/dashboard' fazia a vendedora ver um piscar de redirect no
      // primeiro acesso. A decisão usa o usuário que acabou de vir do login,
      // porque o cache do /me ainda não foi revalidado neste instante.
      const u = res.data?.user;
      const perms: string[] = Array.isArray(u?.permissions) ? (u!.permissions as string[]) : [];
      const veDashboard = u?.role === 'OWNER' || perms.includes('view_financials');

      // Full page reload para o middleware do Next.js ler o cookie httpOnly
      window.location.href = veDashboard ? '/dashboard' : '/sales';
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
