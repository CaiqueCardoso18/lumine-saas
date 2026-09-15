'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from './use-toast';

export interface Installment {
  id: string;
  number: number;
  totalCount: number;
  amount: number;
  dueDate: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  paidAt?: string | null;
  paidAmount?: number | null;
  paidMethod?: string | null;
  notes?: string | null;
  customer: { id: string; name: string; phone?: string | null };
  sale: { id: string; saleNumber: number; createdAt: string };
}

export interface CrediarioSummary {
  openAmount: number;
  openCount: number;
  overdueAmount: number;
  overdueCount: number;
  receivedThisMonth: number;
  receivedCount: number;
  debtorCount: number;
}

export interface Debtor {
  customer: { id: string; name: string; phone: string | null };
  openAmount: number;
  openCount: number;
  overdueAmount: number;
  overdueCount: number;
  nextDueDate: string;
}

export function useCrediarioSummary() {
  return useQuery({
    queryKey: ['crediario', 'summary'],
    queryFn: async () => (await api.get<CrediarioSummary>('/api/crediario/summary')).data,
  });
}

export function useDebtors() {
  return useQuery({
    queryKey: ['crediario', 'debtors'],
    queryFn: async () => (await api.get<Debtor[]>('/api/crediario/debtors')).data ?? [],
  });
}

export function useInstallments(query: string, page: number) {
  return useQuery({
    queryKey: ['crediario', 'installments', query, page],
    queryFn: () => {
      const params = new URLSearchParams(query);
      params.set('page', String(page));
      params.set('limit', '30');
      return api.paginated<Installment>(`/api/crediario?${params}`);
    },
    placeholderData: (prev) => prev,
  });
}

export function usePayInstallment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; paidAmount?: number; paidMethod?: string; notes?: string }) =>
      api.post(`/api/crediario/${id}/pay`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crediario'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Parcela baixada!' });
    },
    onError: (err) =>
      toast({
        title: 'Erro ao dar baixa',
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      }),
  });
}

export function useReopenInstallment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/crediario/${id}/reopen`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crediario'] });
      toast({ title: 'Parcela reaberta' });
    },
    onError: (err) =>
      toast({
        title: 'Erro ao reabrir',
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      }),
  });
}
