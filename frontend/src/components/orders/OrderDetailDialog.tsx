'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Printer, ChevronLeft, ChevronRight, Loader2, Ban } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, formatDateTime, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/formatters';
import { Order } from '@/types';
import { toast } from '@/hooks/use-toast';

const STATUS_BADGE: Record<string, 'default' | 'warning' | 'success' | 'danger' | 'sage'> = {
  DRAFT: 'default',
  SENT: 'warning',
  RECEIVED: 'sage',
  CHECKED: 'success',
  CANCELLED: 'danger',
};

const STATUS_FLOW = ['DRAFT', 'SENT', 'RECEIVED', 'CHECKED'];

const NEXT_STATUS: Record<string, string> = {
  DRAFT: 'SENT',
  SENT: 'RECEIVED',
  RECEIVED: 'CHECKED',
};

const PREV_STATUS: Record<string, string> = {
  SENT: 'DRAFT',
  RECEIVED: 'SENT',
  CHECKED: 'RECEIVED',
  CANCELLED: 'DRAFT',
};

const NEXT_LABEL: Record<string, string> = {
  DRAFT: 'Marcar Enviado',
  SENT: 'Confirmar Recebimento',
  RECEIVED: 'Conferir e Dar Entrada',
};

const PREV_LABEL: Record<string, string> = {
  SENT: 'Voltar p/ Rascunho',
  RECEIVED: 'Voltar p/ Enviado',
  CHECKED: 'Voltar p/ Recebido',
  CANCELLED: 'Reabrir',
};

interface Props {
  order: Order;
  onClose: () => void;
}

export function OrderDetailDialog({ order, onClose }: Props) {
  const qc = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/api/orders/${order.id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Status atualizado!' });
    },
    onError: (err) => {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    },
  });

  const currentStep = STATUS_FLOW.indexOf(order.status);

  function printOrder() {
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8"/>
        <title>Pedido #${order.orderNumber} — Lumine</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family:'Segoe UI',Arial,sans-serif; padding:40px; color:#3D3935; }
          .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; }
          .brand { font-size:24px; font-weight:700; color:#B8A9C9; letter-spacing:1px; }
          .brand span { display:block; font-size:11px; font-weight:400; color:#8B8680; margin-top:2px; letter-spacing:0; }
          .meta { text-align:right; font-size:12px; color:#8B8680; line-height:1.8; }
          h2 { font-size:16px; color:#4A5750; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #EDE7F4; }
          .info-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:32px; }
          .info-box { background:#FAF8F5; border:1px solid #EDE7F4; border-radius:8px; padding:14px; }
          .info-box label { font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#8B8680; display:block; margin-bottom:4px; }
          .info-box p { font-size:13px; color:#3D3935; }
          table { width:100%; border-collapse:collapse; margin-bottom:24px; }
          th { background:#EDE7F4; padding:10px 14px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#5C6B63; }
          td { padding:12px 14px; border-bottom:1px solid #EDE7F4; font-size:13px; }
          tr:last-child td { border-bottom:none; }
          .text-right { text-align:right; }
          .total-row td { font-size:14px; font-weight:600; background:#FAF8F5; padding:14px; }
          .signatures { display:grid; grid-template-columns:1fr 1fr; gap:40px; margin:32px 0; }
          .sig-line { border-top:1px solid #3D3935; padding-top:8px; font-size:12px; text-align:center; color:#8B8680; }
          .footer { text-align:center; font-size:11px; color:#8B8680; border-top:1px solid #EDE7F4; padding-top:20px; }
          .status-badge { display:inline-block; padding:2px 10px; border-radius:99px; font-size:11px; font-weight:600;
            background:${order.status === 'CHECKED' ? '#7FB88B' : order.status === 'CANCELLED' ? '#D47B7B' : '#EDE7F4'};
            color:${order.status === 'CHECKED' ? '#fff' : order.status === 'CANCELLED' ? '#fff' : '#5C6B63'}; }
          @media print { body { padding:20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">Lumine<span>Pedido de Reposição</span></div>
          <div class="meta">
            <strong>Pedido Nº:</strong> #${order.orderNumber}<br/>
            <strong>Data:</strong> ${formatDate(order.createdAt)}<br/>
            <strong>Status:</strong> <span class="status-badge">${ORDER_STATUS_LABELS[order.status]}</span>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <label>Fornecedor</label>
            <p>${order.supplier?.name ?? 'Não informado'}</p>
          </div>
          <div class="info-box">
            <label>Criado em</label>
            <p>${formatDateTime(order.createdAt)}</p>
          </div>
          <div class="info-box">
            <label>Total do Pedido</label>
            <p style="font-size:16px;font-weight:600;color:#C9B97A;">${formatCurrency(order.totalCost)}</p>
          </div>
        </div>

        <h2>Itens do Pedido</h2>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Produto</th><th>SKU</th>
              <th class="text-right">Qtd. Pedida</th>
              <th class="text-right">Qtd. Recebida</th>
              <th class="text-right">Custo Unit.</th>
              <th class="text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map((item, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${item.product?.name ?? '-'}</td>
                <td style="color:#8B8680;font-size:12px;">${item.product?.sku ?? '-'}</td>
                <td class="text-right">${item.quantityOrdered}</td>
                <td class="text-right">${item.quantityReceived ?? '-'}</td>
                <td class="text-right">${formatCurrency(item.unitCost)}</td>
                <td class="text-right">${formatCurrency(Number(item.unitCost) * item.quantityOrdered)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="6" class="text-right">Total</td>
              <td class="text-right">${formatCurrency(order.totalCost)}</td>
            </tr>
          </tbody>
        </table>

        ${order.notes ? `<div style="background:#FAF8F5;border:1px solid #EDE7F4;border-radius:8px;padding:16px;margin-bottom:24px;">
          <label style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#8B8680;display:block;margin-bottom:6px;">Observações</label>
          <p style="font-size:13px;">${order.notes}</p></div>` : ''}

        <div class="signatures">
          <div class="sig-line">Solicitante</div>
          <div class="sig-line">Fornecedor / Responsável</div>
        </div>

        <div class="footer">Lumine — Sistema de Gestão · Gerado em ${new Date().toLocaleString('pt-BR')}</div>
        <script>window.onload = () => window.print();</script>
      </body></html>
    `);
    win.document.close();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-lumine-lavender-pale shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-xl text-lumine-sage-dark">
              Pedido #{order.orderNumber}
            </h2>
            <Badge variant={STATUS_BADGE[order.status]}>
              {ORDER_STATUS_LABELS[order.status]}
            </Badge>
          </div>
          <button onClick={onClose} className="text-lumine-warm-gray hover:text-lumine-charcoal">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Kanban progress */}
          {order.status !== 'CANCELLED' && (
            <div className="flex items-center gap-1">
              {STATUS_FLOW.map((s, idx) => (
                <div key={s} className="flex items-center flex-1">
                  <div className={`flex-1 flex flex-col items-center gap-1`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors ${
                      idx < currentStep
                        ? 'bg-lumine-sage border-lumine-sage text-white'
                        : idx === currentStep
                        ? 'bg-lumine-lavender border-lumine-lavender text-white'
                        : 'bg-white border-lumine-lavender-pale text-lumine-warm-gray'
                    }`}>
                      {idx < currentStep ? '✓' : idx + 1}
                    </div>
                    <span className={`text-xs text-center leading-tight ${
                      idx === currentStep ? 'text-lumine-sage-dark font-medium' : 'text-lumine-warm-gray'
                    }`}>
                      {ORDER_STATUS_LABELS[s]}
                    </span>
                  </div>
                  {idx < STATUS_FLOW.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 mb-4 ${idx < currentStep ? 'bg-lumine-sage' : 'bg-lumine-lavender-pale'}`} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-lumine-cream rounded-xl p-4">
              <p className="text-xs text-lumine-warm-gray uppercase tracking-wide mb-1">Fornecedor</p>
              <p className="text-sm font-medium text-lumine-charcoal">{order.supplier?.name ?? 'Não informado'}</p>
            </div>
            <div className="bg-lumine-cream rounded-xl p-4">
              <p className="text-xs text-lumine-warm-gray uppercase tracking-wide mb-1">Data do Pedido</p>
              <p className="text-sm font-medium text-lumine-charcoal">{formatDateTime(order.createdAt)}</p>
            </div>
            <div className="bg-lumine-cream rounded-xl p-4">
              <p className="text-xs text-lumine-warm-gray uppercase tracking-wide mb-1">Total</p>
              <p className="text-sm font-heading font-semibold text-lumine-gold">{formatCurrency(order.totalCost)}</p>
            </div>
          </div>

          {order.notes && (
            <div className="bg-lumine-lavender-pale/30 rounded-xl p-4 border border-lumine-lavender-pale">
              <p className="text-xs text-lumine-warm-gray uppercase tracking-wide mb-1">Observações</p>
              <p className="text-sm text-lumine-charcoal">{order.notes}</p>
            </div>
          )}

          {/* Items table */}
          <div>
            <p className="text-sm font-medium text-lumine-sage-dark mb-3">Itens do Pedido ({order.items.length})</p>
            <div className="border border-lumine-lavender-pale rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-lumine-cream/70 text-xs text-lumine-warm-gray uppercase tracking-wide border-b border-lumine-lavender-pale">
                <span className="col-span-5">Produto</span>
                <span className="col-span-2 text-center">Pedido</span>
                <span className="col-span-2 text-center">Recebido</span>
                <span className="col-span-3 text-right">Subtotal</span>
              </div>
              {order.items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-lumine-lavender-pale last:border-0">
                  <div className="col-span-5 min-w-0">
                    <p className="text-sm font-medium text-lumine-charcoal truncate">{item.product?.name ?? '-'}</p>
                    <p className="text-xs text-lumine-warm-gray">{item.product?.sku ?? '-'}</p>
                  </div>
                  <div className="col-span-2 text-center text-sm text-lumine-charcoal">{item.quantityOrdered}</div>
                  <div className="col-span-2 text-center text-sm text-lumine-charcoal">{item.quantityReceived ?? '—'}</div>
                  <div className="col-span-3 text-right text-sm font-medium text-lumine-charcoal">
                    {formatCurrency(Number(item.unitCost) * item.quantityOrdered)}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 bg-lumine-lavender-pale/30">
                <span className="text-sm font-medium text-lumine-sage">Total</span>
                <span className="font-heading font-semibold text-lumine-gold">{formatCurrency(order.totalCost)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer — ações */}
        <div className="flex items-center justify-between p-6 border-t border-lumine-lavender-pale shrink-0 gap-3">
          <div className="flex gap-2">
            {PREV_STATUS[order.status] && (
              <Button
                variant="outline"
                size="sm"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate(PREV_STATUS[order.status])}
              >
                {statusMutation.isPending ? <Loader2 size={13} className="mr-1 animate-spin" /> : <ChevronLeft size={13} className="mr-1" />}
                {PREV_LABEL[order.status]}
              </Button>
            )}
            {(order.status === 'DRAFT' || order.status === 'SENT') && (
              <Button
                variant="ghost"
                size="sm"
                disabled={statusMutation.isPending}
                className="text-lumine-danger hover:text-lumine-danger hover:bg-lumine-danger/10"
                onClick={() => {
                  if (confirm('Cancelar este pedido?')) statusMutation.mutate('CANCELLED');
                }}
              >
                <Ban size={13} className="mr-1" />
                Cancelar Pedido
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={printOrder}>
              <Printer size={14} className="mr-2" />
              Gerar PDF
            </Button>
            {NEXT_STATUS[order.status] && (
              <Button
                size="sm"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate(NEXT_STATUS[order.status])}
              >
                {statusMutation.isPending ? <Loader2 size={13} className="mr-1 animate-spin" /> : null}
                {NEXT_LABEL[order.status]}
                <ChevronRight size={13} className="ml-1" />
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
