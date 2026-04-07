'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, formatPercent } from '@/lib/formatters';
import { PermissionGuard } from '@/components/layout/PermissionGuard';

const PERIODS = [
  { label: 'Hoje', value: 'day' },
  { label: '7 dias', value: 'week' },
  { label: 'Mês', value: 'month' },
  { label: 'Ano', value: 'year' },
];

const PIE_COLORS = ['#B8A9C9', '#5C6B63', '#C9B97A', '#D4A0A0', '#7FB88B', '#D47B7B'];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('month');

  const { data: revenueData } = useQuery({
    queryKey: ['analytics', 'revenue', period],
    queryFn: () =>
      api.get<{
        summary: { totalRevenue: number; totalSales: number; avgTicket: number };
        chart: Array<{ date: string; revenue: number; sales: number }>;
      }>(`/api/analytics/revenue?period=${period}&groupBy=${period === 'year' ? 'month' : 'day'}`),
  });

  const { data: topProductsData } = useQuery({
    queryKey: ['analytics', 'top-products', period],
    queryFn: () =>
      api.get<Array<{ name: string; sku: string; totalQuantity: number; totalRevenue: number; totalProfit: number }>>(
        `/api/analytics/top-products?period=${period}&limit=10`
      ),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['analytics', 'categories', period],
    queryFn: () =>
      api.get<Array<{ category: string; totalRevenue: number; totalQuantity: number }>>(
        `/api/analytics/categories?period=${period}`
      ),
  });

  const { data: trendsData } = useQuery({
    queryKey: ['analytics', 'trends', period],
    queryFn: () =>
      api.get<{
        current: { revenue: number; count: number; avgTicket: number };
        previous: { revenue: number; count: number };
        growth: { revenuePercent: number };
      }>(`/api/analytics/trends?period=${period === 'month' ? 'month' : 'week'}`),
  });

  const revenue = revenueData?.data;
  const topProducts = topProductsData?.data ?? [];
  const categories = categoriesData?.data ?? [];
  const trends = trendsData?.data;
  const chartData = revenue?.chart ?? [];

  return (
    <PermissionGuard permission="view_analytics">
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <Button
            key={p.value}
            size="sm"
            variant={period === p.value ? 'default' : 'outline'}
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Faturamento', value: formatCurrency(revenue?.summary.totalRevenue ?? 0) },
          { label: 'Vendas', value: String(revenue?.summary.totalSales ?? 0) },
          { label: 'Ticket Médio', value: formatCurrency(revenue?.summary.avgTicket ?? 0) },
          {
            label: 'Crescimento',
            value: trends ? formatPercent(trends.growth.revenuePercent) : '—',
            color: (trends?.growth.revenuePercent ?? 0) >= 0 ? 'text-lumine-success' : 'text-lumine-danger',
          },
        ].map((kpi) => (
          <Card key={kpi.label} className="p-5">
            <p className="text-xs text-lumine-warm-gray">{kpi.label}</p>
            <p className={`font-heading text-2xl font-semibold mt-1 ${kpi.color ?? 'text-lumine-charcoal'}`}>
              {kpi.value}
            </p>
          </Card>
        ))}
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader>
          <CardTitle>Faturamento no Período</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE7F4" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => formatDate(v, { day: '2-digit', month: '2-digit' })}
                  tick={{ fontSize: 11, fill: '#8B8680' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: '#8B8680' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                  labelFormatter={(l) => formatDate(l)}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #EDE7F4' }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#B8A9C9"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: '#B8A9C9', stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-lumine-warm-gray text-sm">
              Sem dados para o período
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topProducts.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDE7F4" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 10, fill: '#8B8680' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#8B8680' }}
                    width={100}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => v.length > 15 ? v.slice(0, 15) + '…' : v}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #EDE7F4' }}
                  />
                  <Bar dataKey="totalRevenue" fill="#B8A9C9" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-lumine-warm-gray text-sm">Sem dados</div>
            )}
          </CardContent>
        </Card>

        {/* Categories Pie */}
        <Card>
          <CardHeader>
            <CardTitle>Vendas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {categories.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="totalRevenue"
                    nameKey="category"
                    cx="40%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={3}
                  >
                    {categories.map((_entry, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #EDE7F4' }}
                  />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    formatter={(value) => <span className="text-xs text-lumine-charcoal">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-lumine-warm-gray text-sm">Sem dados</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Margins table */}
      {topProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Margem por Produto</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-lumine-lavender-pale/50">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-lumine-sage-dark">Produto</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-lumine-sage-dark">Qtd Vendida</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-lumine-sage-dark">Faturamento</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-lumine-sage-dark">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p, i) => (
                    <tr key={i} className="border-t border-lumine-lavender-pale hover:bg-lumine-lavender-pale/20">
                      <td className="px-6 py-3">
                        <p className="font-medium text-lumine-charcoal">{p.name}</p>
                        <p className="text-xs text-lumine-warm-gray">{p.sku}</p>
                      </td>
                      <td className="px-6 py-3 text-right">{p.totalQuantity}</td>
                      <td className="px-6 py-3 text-right text-lumine-gold font-semibold">{formatCurrency(p.totalRevenue)}</td>
                      <td className={`px-6 py-3 text-right font-semibold ${p.totalProfit >= 0 ? 'text-lumine-success' : 'text-lumine-danger'}`}>
                        {formatCurrency(p.totalProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
    </PermissionGuard>
  );
}
