'use client';

import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Search, ShoppingCart, XCircle, Eye, Pencil } from 'lucide-react';
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
import { EditSaleDialog } from '@/components/sales/EditSaleDialog';
import { usePermission } from '@/hooks/usePermission';
import { SortControl, SortState } from '@/components/ui/sort-control';

type SaleSortKey = 'createdAt' | 'total' | 'saleNumber';

const SALE_SORT_OPTIONS: Array<{ value: SaleSortKey; label: string }> = [
  { value: 'createdAt', label: 'Data' },
  { value: 'total', label: 'Valor' },
  { value: 'saleNumber', label: 'Nº da venda' },
];

const SALE_DEFAULT_ORDER = { createdAt: 'desc', total: 'desc', saleNumber: 'desc' } as const;

function SalesPageContent() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [newSaleOpen, setNewSaleOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const { isOwner, can } = usePermission();
  // Faturamento, líquido e ticket médio são números do negócio
  const veFinanceiro = can('view_financials');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState<SaleSortKey>>({ by: 'createdAt', order: 'desc' });

  useEffect(() => {
    if (searchParams.get('new') === 'true') setNewSaleOpen(true);
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['sales', page, sort.by, sort.order],
    queryFn: () =>
      api.paginated<Sale>(
        `/api/sales?page=${page}&limit=20&sortBy=${sort.by}&sortOrder=${sort.order}`
      ),
    placeholderData: (prev) => prev,
  });

  const { data: summaryData } = useQuery({
    enabled: veFinanceiro,
    queryKey: ['sales', 'summary'],
    queryFn: () =>
      api.get<{
        totalSales: number;
        totalRevenue: number;
        avgTicket: number;
        totalFee: number;
        netRevenue: number;
      }>('/api/sales/summary'),
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
      {veFinanceiro && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'Vendas hoje', value: String(summary?.totalSales ?? 0), hint: '' },
            { label: 'Faturamento', value: formatCurrency(summary?.totalRevenue ?? 0), hint: '' },
            {
              // O que sobra depois da maquininha — é esse valor que entra na conta
              label: 'Você recebe',
              value: formatCurrency(summary?.netRevenue ?? 0),
              hint: (summary?.totalFee ?? 0) > 0
                ? `Taxa: ${formatCurrency(summary?.totalFee ?? 0)}`
                : '',
            },
            { label: 'Ticket médio', value: formatCurrency(summary?.avgTicket ?? 0), hint: '' },
          ].map((kpi) => (
            <Card key={kpi.label} className="p-4 text-center">
              <p className="text-xs text-lumine-warm-gray">{kpi.label}</p>
              <p className="font-heading text-xl font-semibold text-lumine-charcoal mt-1">{kpi.value}</p>
              {kpi.hint && <p className="text-[11px] text-lumine-warm-gray mt-0.5">{kpi.hint}</p>}
            </Card>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 justify-between">
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Histórico de Vendas</CardTitle>
            <SortControl
              value={sort}
              onChange={(next) => { setSort(next); setPage(1); }}
              options={SALE_SORT_OPTIONS}
              defaultOrder={SALE_DEFAULT_ORDER}
            />
          </div>
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
                  className="flex items-center gap-3 sm:gap-4 px-3 sm:px-6 py-4 hover:bg-lumine-lavender-pale/30 transition-colors group"
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

                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedSale(sale)}>
                      <Eye size={14} strokeWidth={1.5} />
                    </Button>
                    {/* Editar venda mexe em estoque e caixa de algo já fechado,
                        então é só do dono — e sempre vai para a auditoria */}
                    {sale.status === 'COMPLETED' && isOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Editar venda"
                        onClick={() => setEditingSale(sale)}
                      >
                        <Pencil size={14} strokeWidth={1.5} />
                      </Button>
                    )}
                    {sale.status === 'COMPLETED' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:text-lumine-danger"
                        title="Estornar venda"
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
      {/* key por venda: remonta o diálogo a cada abertura.
          Sem isso, reabrir a MESMA venda devolvia a mesma referência do cache
          do React Query, o useEffect não disparava e as alterações abandonadas
          da vez anterior continuavam na tela. */}
      {editingSale && (
        <EditSaleDialog
          key={editingSale.id}
          sale={editingSale}
          onClose={() => setEditingSale(null)}
        />
      )}
    </motion.div>
  );
}

export default function SalesPage() {
  return (
    <Suspense>
      <SalesPageContent />
    </Suspense>
  );
}
