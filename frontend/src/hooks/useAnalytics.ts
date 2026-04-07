'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface RevenuePoint {
  label: string;
  revenue: number;
  count: number;
}

interface TopProduct {
  id: string;
  name: string;
  sku: string;
  totalQty: number;
  totalRevenue: number;
}

interface CategoryStat {
  categoryId: string;
  categoryName: string;
  totalQty: number;
  totalRevenue: number;
}

interface MarginProduct {
  id: string;
  name: string;
  sku: string;
  salePrice: number;
  costPrice: number;
  margin: number;
  marginPct: number;
}

interface TrendData {
  current: { revenue: number; count: number; avgTicket: number };
  previous: { revenue: number; count: number; avgTicket: number };
  revenueGrowth: number;
  countGrowth: number;
}

interface StockTurnProduct {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitsSold: number;
  turnoverRate: number;
}

export function useRevenue(params: {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}) {
  const search = new URLSearchParams();
  if (params.startDate) search.set('startDate', params.startDate);
  if (params.endDate) search.set('endDate', params.endDate);
  if (params.groupBy) search.set('groupBy', params.groupBy);

  return useQuery({
    queryKey: ['analytics', 'revenue', params],
    queryFn: () => api.get<RevenuePoint[]>(`/api/analytics/revenue?${search}`),
  });
}

export function useTopProducts(params: { startDate?: string; endDate?: string; limit?: number }) {
  const search = new URLSearchParams();
  if (params.startDate) search.set('startDate', params.startDate);
  if (params.endDate) search.set('endDate', params.endDate);
  if (params.limit) search.set('limit', String(params.limit));

  return useQuery({
    queryKey: ['analytics', 'top-products', params],
    queryFn: () => api.get<TopProduct[]>(`/api/analytics/top-products?${search}`),
  });
}

export function useCategoryStats(params: { startDate?: string; endDate?: string }) {
  const search = new URLSearchParams();
  if (params.startDate) search.set('startDate', params.startDate);
  if (params.endDate) search.set('endDate', params.endDate);

  return useQuery({
    queryKey: ['analytics', 'categories', params],
    queryFn: () => api.get<CategoryStat[]>(`/api/analytics/categories?${search}`),
  });
}

export function useMargins(params: { startDate?: string; endDate?: string; limit?: number }) {
  const search = new URLSearchParams();
  if (params.startDate) search.set('startDate', params.startDate);
  if (params.endDate) search.set('endDate', params.endDate);
  if (params.limit) search.set('limit', String(params.limit));

  return useQuery({
    queryKey: ['analytics', 'margins', params],
    queryFn: () => api.get<MarginProduct[]>(`/api/analytics/margins?${search}`),
  });
}

export function useTrends(params: { startDate?: string; endDate?: string }) {
  const search = new URLSearchParams();
  if (params.startDate) search.set('startDate', params.startDate);
  if (params.endDate) search.set('endDate', params.endDate);

  return useQuery({
    queryKey: ['analytics', 'trends', params],
    queryFn: () => api.get<TrendData>(`/api/analytics/trends?${search}`),
  });
}

export function useStockTurnover(params: { startDate?: string; endDate?: string }) {
  const search = new URLSearchParams();
  if (params.startDate) search.set('startDate', params.startDate);
  if (params.endDate) search.set('endDate', params.endDate);

  return useQuery({
    queryKey: ['analytics', 'stock-turn', params],
    queryFn: () => api.get<StockTurnProduct[]>(`/api/analytics/stock-turn?${search}`),
  });
}
