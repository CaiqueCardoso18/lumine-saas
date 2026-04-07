'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  TrendingUp, Package, ShoppingCart, AlertTriangle,
  Plus, Upload, ArrowRight,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatters';

const fadeIn = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

function KPICard({
  title, value, subtitle, icon: Icon, color, delay = 0,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div variants={fadeIn} transition={{ delay }}>
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-lumine-warm-gray">{title}</p>
            <p className="text-2xl font-heading font-semibold text-lumine-charcoal mt-1">{value}</p>
            <p className="text-xs text-lumine-warm-gray mt-1">{subtitle}</p>
          </div>
          <div className={`p-3 rounded-xl ${color}`}>
            <Icon size={20} strokeWidth={1.5} className="text-white" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { data: summary } = useQuery({
    queryKey: ['sales', 'summary'],
    queryFn: () => api.get<{
      totalSales: number; totalRevenue: number; avgTicket: number; cancelledCount: number;
    }>('/api/sales/summary'),
  });

  const { data: revenue } = useQuery({
    queryKey: ['analytics', 'revenue', '30d'],
    queryFn: () => api.get<{
      chart: Array<{ date: string; revenue: number; sales: number }>;
      summary: { totalRevenue: number; totalSales: number; avgTicket: number };
    }>('/api/analytics/revenue?period=30d&groupBy=day'),
  });

  const { data: recentSales } = useQuery({
    queryKey: ['sales', 'recent'],
    queryFn: () => api.paginated<{
      id: string; saleNumber: number; total: number; createdAt: string;
      user: { name: string }; paymentMethod: string;
    }>('/api/sales?limit=10'),
  });

  const { data: lowStock } = useQuery({
    queryKey: ['products', 'low-stock'],
    queryFn: () => api.get<Array<{
      id: string; name: string; sku: string; quantity: number; min_stock: number; category_name: string;
    }>>('/api/products/low-stock'),
  });

  const s = summary?.data;
  const chartData = revenue?.data?.chart ?? [];
  const sales = recentSales?.data ?? [];
  const lowStockItems = lowStock?.data ?? [];

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.08 } } }}
      className="space-y-6"
    >
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Vendas hoje"
          value={String(s?.totalSales ?? 0)}
          subtitle="transações concluídas"
          icon={ShoppingCart}
          color="bg-lumine-lavender"
          delay={0}
        />
        <KPICard
          title="Faturamento"
          value={formatCurrency(s?.totalRevenue ?? 0)}
          subtitle="receita do dia"
          icon={TrendingUp}
          color="bg-lumine-sage"
          delay={0.08}
        />
        <KPICard
          title="Ticket médio"
          value={formatCurrency(s?.avgTicket ?? 0)}
          subtitle="por venda"
          icon={Package}
          color="bg-lumine-gold"
          delay={0.16}
        />
        <KPICard
          title="Estoque baixo"
          value={String(lowStockItems.length)}
          subtitle="produtos abaixo do mínimo"
          icon={AlertTriangle}
          color={lowStockItems.length > 0 ? 'bg-lumine-danger' : 'bg-lumine-success'}
          delay={0.24}
        />
      </div>

      {/* Quick Actions */}
      <motion.div variants={fadeIn} transition={{ delay: 0.3 }}>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/sales?new=true">
              <Plus size={16} className="mr-2" />
              Nova Venda
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/products?new=true">
              <Package size={16} className="mr-2" />
              Novo Produto
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/upload">
              <Upload size={16} className="mr-2" />
              Importar Planilha
            </Link>
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Gráfico de faturamento */}
        <motion.div variants={fadeIn} transition={{ delay: 0.35 }} className="xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Faturamento — últimos 30 dias</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
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
                      labelFormatter={(label) => formatDate(label)}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #EDE7F4',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#B8A9C9"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5, fill: '#B8A9C9', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-lumine-warm-gray text-sm">
                  Sem dados de faturamento ainda
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Estoque baixo */}
        <motion.div variants={fadeIn} transition={{ delay: 0.4 }}>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Estoque Baixo</CardTitle>
              <Link href="/products?lowStock=true" className="text-xs text-lumine-lavender hover:underline flex items-center gap-1">
                Ver todos <ArrowRight size={12} />
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {lowStockItems.length === 0 ? (
                <p className="text-sm text-lumine-warm-gray text-center py-6">
                  Tudo em ordem!
                </p>
              ) : (
                lowStockItems.slice(0, 6).map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-lumine-charcoal truncate">{item.name}</p>
                      <p className="text-xs text-lumine-warm-gray">{item.category_name}</p>
                    </div>
                    <Badge variant={item.quantity === 0 ? 'danger' : 'warning'}>
                      {item.quantity} un.
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Últimas vendas */}
      <motion.div variants={fadeIn} transition={{ delay: 0.45 }}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>Últimas Vendas</CardTitle>
            <Link href="/sales" className="text-xs text-lumine-lavender hover:underline flex items-center gap-1">
              Ver todas <ArrowRight size={12} />
            </Link>
          </CardHeader>
          <CardContent>
            {sales.length === 0 ? (
              <p className="text-sm text-lumine-warm-gray text-center py-6">
                Nenhuma venda registrada ainda
              </p>
            ) : (
              <div className="space-y-1">
                {sales.map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between py-2.5 border-b border-lumine-lavender-pale last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-lumine-lavender-pale flex items-center justify-center">
                        <ShoppingCart size={14} strokeWidth={1.5} className="text-lumine-lavender" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-lumine-charcoal">
                          Venda #{sale.saleNumber}
                        </p>
                        <p className="text-xs text-lumine-warm-gray">{formatDateTime(sale.createdAt)}</p>
                      </div>
                    </div>
                    <span className="font-heading font-semibold text-lumine-gold">
                      {formatCurrency(sale.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
