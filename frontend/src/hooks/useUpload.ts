'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface ImportPreviewRow {
  sku: string;
  name: string;
  quantity: number;
  salePrice: number;
  costPrice?: number;
  categoryName?: string;
  action: 'create' | 'update' | 'error';
  error?: string;
}

interface ImportPreview {
  importId: string;
  rows: ImportPreviewRow[];
  summary: { create: number; update: number; error: number };
}

interface ImportRecord {
  id: string;
  fileName: string;
  totalRows: number;
  created: number;
  updated: number;
  errors: number;
  status: string;
  createdAt: string;
}

export function useImportHistory() {
  return useQuery({
    queryKey: ['import-history'],
    queryFn: () => api.get<ImportRecord[]>('/api/upload/history'),
  });
}

export function usePreviewUpload() {
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.upload<ImportPreview>('/api/upload/preview', formData);
    },
    onError: (err) => {
      toast({ title: 'Erro ao processar arquivo', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    },
  });
}

export function useConfirmUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (importId: string) => api.post('/api/upload/confirm', { importId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['import-history'] });
      toast({ title: 'Importação concluída com sucesso!' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao confirmar importação', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    },
  });
}
