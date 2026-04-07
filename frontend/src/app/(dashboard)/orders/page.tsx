'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, ClipboardList } from 'lucide-react';
import { NewOrderDialog } from '@/components/orders/NewOrderDialog';
import { OrderDetailDialog } from '@/components/orders/OrderDetailDialog';
import { PermissionGuard } from '@/components/layout/PermissionGuard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, ORDER_STATUS_LABELS } from '@/lib/formatters';
import { Order } from '@/types';

const STATUS_BADGE: Record<string, 'default' | 'warning' | 'success' | 'danger' | 'sage'> = {
  DRAFT: 'default',
  SENT: 'warning',
  RECEIVED: 'sage',
  CHECKED: 'success',
  CANCELLED: 'danger',
};

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', page, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      return api.paginated<Order>(`/api/orders?${params}`);
    },
    placeholderData: (prev) => prev,
  });

  const orders = data?.data ?? [];
  const meta = data?.meta;

  return (
    <PermissionGuard permission="view_orders">
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 justify-between">
        <div className="flex flex-wrap gap-2">
          {['', 'DRAFT', 'SENT', 'RECEIVED', 'CHECKED', 'CANCELLED'].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter(s); setPage(1); }}
            >
              {s ? ORDER_STATUS_LABELS[s] : 'Todos'}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={() => setNewOrderOpen(true)}>
          <Plus size={14} className="mr-2" />
          Novo Pedido
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pedidos de Reposição</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-lumine-lavender-pale">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                  <div className="w-10 h-10 bg-lumine-lavender-pale rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-lumine-lavender-pale rounded w-1/4" />
                    <div className="h-3 bg-lumine-lavender-pale rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-lumine-warm-gray">
              <ClipboardList size={40} strokeWidth={1} className="mb-3 opacity-40" />
              <p className="text-sm">Nenhum pedido encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-lumine-lavender-pale">
              {orders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setDetailOrder(order)}
                  className="w-full text-left p-6 hover:bg-lumine-lavender-pale/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-lumine-lavender-pale flex items-center justify-center shrink-0">
                        <ClipboardList size={16} strokeWidth={1.5} className="text-lumine-lavender" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-lumine-charcoal">Pedido #{order.orderNumber}</span>
                          <Badge variant={STATUS_BADGE[order.status]}>
                            {ORDER_STATUS_LABELS[order.status]}
                          </Badge>
                        </div>
                        <p className="text-xs text-lumine-warm-gray mt-0.5">
                          {order.supplier?.name ?? 'Sem fornecedor'} · {order.items.length} itens
                          {order.createdAt && ` · ${formatDate(order.createdAt)}`}
                        </p>
                      </div>
                    </div>
                    <span className="font-heading font-semibold text-lumine-gold hidden sm:block">
                      {formatCurrency(order.totalCost)}
                    </span>
                  </div>

                  {order.items.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3 ml-[52px]">
                      {order.items.slice(0, 4).map((item) => (
                        <span key={item.id} className="text-xs bg-lumine-lavender-pale/50 text-lumine-sage px-2 py-0.5 rounded-full">
                          {item.product?.name ?? 'Produto'} × {item.quantityOrdered}
                        </span>
                      ))}
                      {order.items.length > 4 && (
                        <span className="text-xs text-lumine-warm-gray px-2 py-0.5">
                          +{order.items.length - 4} mais
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <div className="flex justify-center gap-2 p-4 border-t border-lumine-lavender-pale">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Anterior</Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page === meta.totalPages}>Próxima</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <NewOrderDialog open={newOrderOpen} onOpenChange={setNewOrderOpen} />

      {detailOrder && (
        <OrderDetailDialog
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
        />
      )}
    </motion.div>
    </PermissionGuard>
  );
}
