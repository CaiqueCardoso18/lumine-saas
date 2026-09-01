'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  user?: { id: string; name: string; email: string; role: string } | null;
  product?: { id: string; sku: string; name: string } | null;
}

export interface AuditFacets {
  total: number;
  actions: Array<{ value: string; count: number }>;
  entityTypes: Array<{ value: string; count: number }>;
  users: Array<{ value: string; label: string; count: number }>;
}

export function useAuditLogs(query: string, page: number) {
  return useQuery({
    queryKey: ['audit', query, page],
    queryFn: () => {
      const params = new URLSearchParams(query);
      params.set('page', String(page));
      params.set('limit', '30');
      return api.paginated<AuditLog>(`/api/audit?${params}`);
    },
    placeholderData: (prev) => prev,
  });
}

export function useAuditFacets(query: string) {
  return useQuery({
    queryKey: ['audit-facets', query],
    queryFn: async () => {
      const res = await api.get<AuditFacets>(`/api/audit/facets?${query}`);
      return res.data;
    },
    placeholderData: (prev) => prev,
  });
}
