'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Order, Supplier } from '@/types';
import { toast } from '@/hooks/use-toast';

export function useOrders(params?: {
  page?: number;
  limit?: number;
  status?: string;
  supplierId?: string;
}) {
  const search = new URLSearchParams();
  if (params?.page) search.set('page', String(params.page));
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.status) search.set('status', params.status);
  if (params?.supplierId) search.set('supplierId', params.supplierId);

  return useQuery({
    queryKey: ['orders', params],
    queryFn: () => api.paginated<Order>(`/api/orders?${search}`),
    placeholderData: (prev) => prev,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: () => api.get<Order>(`/api/orders/${id}`),
    enabled: !!id,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Order>) => api.post<Order>('/api/orders', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: 'Pedido criado com sucesso!' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao criar pedido', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    },
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/orders/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Status do pedido atualizado!' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao atualizar status', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    },
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get<Supplier[]>('/api/settings/suppliers'),
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Supplier>) => api.post<Supplier>('/api/settings/suppliers', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ title: 'Fornecedor criado com sucesso!' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao criar fornecedor', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    },
  });
}
