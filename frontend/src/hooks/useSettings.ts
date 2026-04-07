'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { User } from '@/types';
import { toast } from '@/hooks/use-toast';

interface StoreSettings {
  storeName?: string;
  storePhone?: string;
  storeEmail?: string;
  storeAddress?: string;
  minStock?: number;
  [key: string]: string | number | undefined;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  _count: { products: number };
  subcategories: Array<{ id: string; name: string; slug: string }>;
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Record<string, string | number>>('/api/settings'),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: StoreSettings) => api.put('/api/settings', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: 'Configurações salvas!' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao salvar configurações', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/api/settings/categories'),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; icon?: string }) => api.post<Category>('/api/settings/categories', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categoria criada!' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao criar categoria', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/settings/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categoria removida!' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao remover categoria', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    },
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/api/settings/users'),
  });
}

export function useToggleUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/api/settings/users/${id}`, { active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'Usuário atualizado!' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao atualizar usuário', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    },
  });
}
