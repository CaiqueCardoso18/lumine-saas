'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Sale } from '@/types';
import { toast } from './use-toast';

export function useSales(params?: Record<string, string>) {
  const query = new URLSearchParams({ limit: '20', ...params }).toString();
  return useQuery({
    queryKey: ['sales', params],
    queryFn: () => api.paginated<Sale>(`/api/sales?${query}`),
  });
}

export function useSalesSummary(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);

  return useQuery({
    queryKey: ['sales', 'summary', startDate, endDate],
    queryFn: () => api.get<{
      totalSales: number; totalRevenue: number; avgTicket: number; cancelledCount: number;
    }>(`/api/sales/summary?${params}`),
    staleTime: 60 * 1000,
  });
}

export function useCancelSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/api/sales/${id}/cancel`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      toast({ title: 'Venda cancelada. Estoque devolvido.' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao cancelar', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    },
  });
}

export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      items: Array<{ productId: string; quantity: number; unitPrice: number; discount?: number }>;
      paymentMethod: string;
      discountAmount?: number;
      notes?: string;
      payments?: Array<{ method: string; amount: number }>;
    }) => api.post<Sale>('/api/sales', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => {
      toast({ title: 'Erro ao registrar venda', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    },
  });
}
