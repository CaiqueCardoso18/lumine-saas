'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Product } from '@/types';
import { toast } from './use-toast';

export function useProducts(params?: Record<string, string>) {
  const query = new URLSearchParams({ limit: '20', ...params }).toString();
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => api.paginated<Product>(`/api/products?${query}`),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => api.get<Product>(`/api/products/${id}`),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Product>) => api.post<Product>('/api/products', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Produto criado!' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao criar produto', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    },
  });
}

export function useUpdateProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Product>) => api.put<Product>(`/api/products/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Produto atualizado!' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao atualizar', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Produto removido.' });
    },
  });
}

export function useLowStockProducts() {
  return useQuery({
    queryKey: ['products', 'low-stock'],
    queryFn: () => api.get<Array<{
      id: string; sku: string; name: string; quantity: number;
      min_stock: number; category_name: string;
    }>>('/api/products/low-stock'),
    staleTime: 2 * 60 * 1000,
  });
}
