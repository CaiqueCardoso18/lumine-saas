'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Search, ShoppingCart, XCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatCurrency, formatDateTime, PAYMENT_METHOD_LABELS } from '@/lib/formatters';
import { Sale } from '@/types';
import { toast } from '@/hooks/use-toast';
import { NewSaleDialog } from '@/components/sales/NewSaleDialog';
import { SaleDetailDialog } from '@/components/sales/SaleDetailDialog';

export default function SalesPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [newSaleOpen, setNewSaleOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (searchParams.get('new') === 'true') setNewSaleOpen(true);
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['sales', page],
    queryFn: () => api.paginated<Sale>(`/api/sales?page=${page}&limit=20`),
    placeholderData: (prev) => prev,
  });

  const { data: summaryData } = useQuery({
    queryKey: ['sales', 'summary'],
    queryFn: () => api.get<{ totalSales: number; totalRevenue: number; avgTicket: number }>('/api/sales/summary'),
  });

  const cancelMutation = useMutation({
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

  const sales = data?.data ?? [];
  const meta = data?.meta;
  const summary = summaryData?.data;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Vendas hoje', value: String(summary?.totalSales ?? 0) },
          { label: 'Faturamento', value: formatCurrency(summary?.totalRevenue ?? 0) },
          { label: 'Ticket médio', value: formatCurrency(summary?.avgTicket ?? 0) },
        ].map((kpi) => (
          <Card key={kpi.label} className="p-4 text-center">
            <p className="text-xs text-lumine-warm-gray">{kpi.label}</p>
            <p className="font-heading text-xl font-semibold text-lumine-charcoal mt-1">{kpi.value}</p>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex gap-3 justify-between">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-lumine-warm-gray" strokeWidth={1.5} />
          <Input placeholder="Buscar venda..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={() => setNewSaleOpen(true)}>
          <Plus size={14} className="mr-2" />
          Nova Venda
        </Button>
      </div>

      {/* Sales list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Histórico de Vendas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-lumine-lavender-pale">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                  <div className="w-10 h-10 bg-lumine-lavender-pale rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-lumine-lavender-pale rounded w-1/4" />
                    <div className="h-3 bg-lumine-lavender-pale rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-lumine-warm-gray">
              <ShoppingCart size={40} strokeWidth={1} className="mb-3 opacity-40" />
              <p className="text-sm">Nenhuma venda registrada</p>
            </div>
          ) : (
            <div className="divide-y divide-lumine-lavender-pale">
              {sales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-lumine-lavender-pale/30 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-lumine-lavender-pale flex items-center justify-center shrink-0">
                    <ShoppingCart size={16} strokeWidth={1.5} className="text-lumine-lavender" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-lumine-charcoal">#{sale.saleNumber}</span>
                      <Badge variant={sale.status === 'COMPLETED' ? 'success' : 'danger'}>
                        {sale.status === 'COMPLETED' ? 'Concluída' : 'Cancelada'}
                      </Badge>
                      <Badge variant="default">{PAYMENT_METHOD_LABELS[sale.paymentMethod]}</Badge>
                    </div>
                    <p className="text-xs text-lumine-warm-gray mt-0.5">
                      {formatDateTime(sale.createdAt)} · {sale.user.name}
                    </p>
                  </div>

                  <span className="font-heading font-semibold text-lumine-gold">
                    {formatCurrency(sale.total)}
                  </span>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedSale(sale)}>
                      <Eye size={14} strokeWidth={1.5} />
                    </Button>
                    {sale.status === 'COMPLETED' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:text-lumine-danger"
                        onClick={() => {
                          const reason = prompt('Motivo do cancelamento:');
                          if (reason) cancelMutation.mutate({ id: sale.id, reason });
                        }}
                      >
                        <XCircle size={14} strokeWidth={1.5} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <div className="flex justify-center gap-2 p-4 border-t border-lumine-lavender-pale">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Anterior</Button>
              <span className="flex items-center text-sm text-lumine-warm-gray px-3">
                {meta.page}/{meta.totalPages}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page === meta.totalPages}>Próxima</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <NewSaleDialog open={newSaleOpen} onOpenChange={setNewSaleOpen} />
      {selectedSale && (
        <SaleDetailDialog sale={selectedSale} onClose={() => setSelectedSale(null)} />
      )}
    </motion.div>
  );
}
