'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from './use-toast';

export interface CalendarEntry {
  id: string;
  kind: 'RECEIVABLE' | 'PAYABLE';
  description: string;
  amount: number;
  dueDate: string;
  overdue: boolean;
  party?: string | null;
  link?: { type: 'installment' | 'payable'; id: string };
}

export interface CalendarDay {
  date: string;
  receivable: number;
  payable: number;
  net: number;
  entries: CalendarEntry[];
}

export interface CalendarResponse {
  period: { year: number; month: number; start: string; end: string };
  totals: {
    receivable: number;
    payable: number;
    net: number;
    overdueReceivable: number;
    overduePayable: number;
  };
  days: CalendarDay[];
}

export interface Payable {
  id: string;
  description: string;
  category?: string | null;
  amount: number;
  dueDate: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  paidAt?: string | null;
  paidAmount?: number | null;
  notes?: string | null;
  supplier?: { id: string; name: string } | null;
}

export function useCalendar(year: number, month: number) {
  return useQuery({
    queryKey: ['finance', 'calendar', year, month],
    queryFn: async () =>
      (await api.get<CalendarResponse>(`/api/finance/calendar?year=${year}&month=${month}`)).data,
    placeholderData: (prev) => prev,
  });
}

export function usePayables(query: string, page: number) {
  return useQuery({
    queryKey: ['finance', 'payables', query, page],
    queryFn: () => {
      const params = new URLSearchParams(query);
      params.set('page', String(page));
      params.set('limit', '30');
      return api.paginated<Payable>(`/api/finance/payables?${params}`);
    },
    placeholderData: (prev) => prev,
  });
}

/** Invalida calendário e lista de uma vez — as duas leem a mesma tabela. */
function useFinanceMutation<TVars>(
  fn: (vars: TVars) => Promise<unknown>,
  sucesso: string,
  erro: string
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance'] });
      toast({ title: sucesso });
    },
    onError: (err) =>
      toast({
        title: erro,
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      }),
  });
}

export function useCreatePayable() {
  return useFinanceMutation<{
    description: string;
    category?: string;
    amount: number;
    dueDate: string;
    notes?: string;
    repeatMonths?: number;
  }>(
    (body) => api.post('/api/finance/payables', body),
    'Conta cadastrada',
    'Erro ao cadastrar conta'
  );
}

export function useUpdatePayable() {
  return useFinanceMutation<{
    id: string; description?: string; category?: string | null;
    amount?: number; dueDate?: string; notes?: string | null;
  }>(
    ({ id, ...body }) => api.patch(`/api/finance/payables/${id}`, body),
    'Conta atualizada',
    'Erro ao editar conta'
  );
}

export function usePayPayable() {
  return useFinanceMutation<{ id: string; paidAmount?: number; notes?: string }>(
    ({ id, ...body }) => api.post(`/api/finance/payables/${id}/pay`, body),
    'Conta marcada como paga',
    'Erro ao pagar conta'
  );
}

export function useCancelPayable() {
  return useFinanceMutation<string>(
    (id) => api.post(`/api/finance/payables/${id}/cancel`),
    'Conta cancelada',
    'Erro ao cancelar conta'
  );
}
