'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { InventorySession, StockMovement } from '@/types';
import { toast } from './use-toast';

// ─── Sessões de Inventário ───────────────────────────────────

export function useInventorySessions(params?: Record<string, string>) {
  const query = new URLSearchParams({ limit: '20', ...params }).toString();
  return useQuery({
    queryKey: ['inventory-sessions', params],
    queryFn: () => api.paginated<InventorySession>(`/api/inventory/sessions?${query}`),
  });
}

export function useInventorySession(id: string) {
  return useQuery({
    queryKey: ['inventory-sessions', id],
    queryFn: () => api.get<InventorySession>(`/api/inventory/sessions/${id}`),
    enabled: !!id,
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; notes?: string }) =>
      api.post<InventorySession>('/api/inventory/sessions', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-sessions'] });
      toast({ title: 'Sessão de inventário criada!' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao criar sessão', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    },
  });
}

export function useAddCounts(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { counts: Array<{ productId: string; countedQuantity: number; notes?: string }> }) =>
      api.post(`/api/inventory/sessions/${sessionId}/counts`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-sessions', sessionId] });
      toast({ title: 'Contagens registradas!' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao registrar contagem', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    },
  });
}

export function useApplySession(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/api/inventory/sessions/${sessionId}/apply`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-sessions'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Inventário aplicado! Estoque atualizado.' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao aplicar inventário', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    },
  });
}

export function useCancelSession(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/api/inventory/sessions/${sessionId}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-sessions'] });
      toast({ title: 'Sessão cancelada.' });
    },
  });
}

// ─── Movimentações de Estoque ────────────────────────────────

export function useStockMovements(params?: Record<string, string>) {
  const query = new URLSearchParams({ limit: '20', ...params }).toString();
  return useQuery({
    queryKey: ['stock-movements', params],
    queryFn: () => api.paginated<StockMovement>(`/api/inventory/movements?${query}`),
  });
}

export function useCreateMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      productId: string;
      type: string;
      quantity: number;
      reason: string;
      reference?: string;
    }) => api.post<StockMovement>('/api/inventory/movements', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Movimentação registrada!' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao registrar movimentação', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    },
  });
}

export function useProductMovements(productId: string) {
  return useQuery({
    queryKey: ['stock-movements', 'product', productId],
    queryFn: () => api.get<StockMovement[]>(`/api/inventory/movements/product/${productId}`),
    enabled: !!productId,
  });
}
