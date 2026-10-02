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
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'RENEGOTIATED';
  /** Quando renegociada, aponta para a primeira parcela do plano novo */
  renegotiatedIntoId?: string | null;
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

/**
 * Totais do crediário. Só para quem tem `view_financials` — a lista de
 * devedores continua aberta, mas o montante total da loja não.
 */
export function useCrediarioSummary(enabled = true) {
  return useQuery({
    enabled,
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

/**
 * Lista parcelas. O `limit` é parametrizável porque a renegociação precisa de
 * TODAS as parcelas em aberto do cliente — com o teto fixo de 30, quem tivesse
 * mais que isso renegociaria só a primeira página, sem nenhum aviso.
 */
export function useInstallments(query: string, page: number, limit = 30) {
  return useQuery({
    queryKey: ['crediario', 'installments', query, page, limit],
    queryFn: () => {
      const params = new URLSearchParams(query);
      params.set('page', String(page));
      params.set('limit', String(limit));
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

export type CrediarioFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

/** Edita valor, vencimento ou observação de uma parcela em aberto. */
export function useUpdateInstallment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: {
      id: string; amount?: number; dueDate?: string; notes?: string;
    }) => api.patch(`/api/crediario/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crediario'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Parcela atualizada' });
    },
    onError: (err) =>
      toast({
        title: 'Erro ao editar parcela',
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      }),
  });
}

export interface RenegotiateResult {
  somaAntiga: number;
  adjustment: number;
  novoTotal: number;
  substituidas: number;
  installments: Installment[];
}

/** Junta parcelas em aberto do mesmo cliente num plano novo. */
export function useRenegotiate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      installmentIds: string[];
      count: number;
      firstDueDate: string;
      frequency: CrediarioFrequency;
      adjustment?: number;
      notes?: string;
    }) => api.post<RenegotiateResult>('/api/crediario/renegotiate', body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['crediario'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      const n = res.data?.installments.length ?? 0;
      toast({ title: `Dívida renegociada em ${n} parcela(s)` });
    },
    onError: (err) =>
      toast({
        title: 'Erro ao renegociar',
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      }),
  });
}
