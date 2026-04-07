'use client';

import { Sale } from '@/types';
import { formatCurrency, formatDateTime, PAYMENT_METHOD_LABELS } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface Props {
  sale: Sale;
  onClose: () => void;
}

export function SaleDetailDialog({ sale, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-lumine-lavender-pale flex items-center justify-between">
          <div>
            <h2 className="font-heading text-xl text-lumine-sage-dark">Venda #{sale.saleNumber}</h2>
            <p className="text-xs text-lumine-warm-gray mt-0.5">{formatDateTime(sale.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={sale.status === 'COMPLETED' ? 'success' : 'danger'}>
              {sale.status === 'COMPLETED' ? 'Concluída' : 'Cancelada'}
            </Badge>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X size={16} />
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Items */}
          <div>
            <p className="text-xs font-medium text-lumine-warm-gray uppercase tracking-wide mb-2">Itens</p>
            <div className="space-y-2">
              {sale.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-lumine-lavender-pale last:border-0">
                  <div>
                    <p className="text-sm font-medium text-lumine-charcoal">{item.productName}</p>
                    <p className="text-xs text-lumine-warm-gray">{item.productSku} · {item.quantity}x {formatCurrency(item.unitPrice)}</p>
                  </div>
                  <span className="text-sm font-semibold text-lumine-charcoal">{formatCurrency(item.total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment */}
          <div className="bg-lumine-lavender-pale/30 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-lumine-warm-gray">Subtotal</span>
              <span>{formatCurrency(sale.subtotal)}</span>
            </div>
            {sale.discountAmount > 0 && (
              <div className="flex justify-between text-sm text-lumine-danger">
                <span>Desconto</span>
                <span>-{formatCurrency(sale.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t border-lumine-lavender-pale pt-2">
              <span className="text-lumine-sage-dark">Total</span>
              <span className="text-lumine-gold font-heading text-lg">{formatCurrency(sale.total)}</span>
            </div>
            <div className="flex justify-between text-xs text-lumine-warm-gray pt-1">
              <span>Pagamento</span>
              <span>{PAYMENT_METHOD_LABELS[sale.paymentMethod]}</span>
            </div>
          </div>

          {/* Payments detail */}
          {sale.payments.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-lumine-warm-gray uppercase tracking-wide">Detalhamento do pagamento</p>
              {sale.payments.map((p) => (
                <div key={p.id} className="flex justify-between text-sm">
                  <span className="text-lumine-warm-gray">
                    {PAYMENT_METHOD_LABELS[p.method]}
                    {p.method === 'CREDIT_CARD' && p.installments > 1 && (
                      <span className="ml-1.5 text-xs bg-lumine-lavender-pale text-lumine-sage px-1.5 py-0.5 rounded-full">
                        {p.installments}x de {formatCurrency(p.amount / p.installments)}
                      </span>
                    )}
                    {p.method === 'CREDIT_CARD' && p.installments === 1 && (
                      <span className="ml-1.5 text-xs bg-lumine-lavender-pale text-lumine-sage px-1.5 py-0.5 rounded-full">
                        à vista
                      </span>
                    )}
                  </span>
                  <span>{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {sale.cancelReason && (
            <div className="bg-lumine-danger/5 border border-lumine-danger/20 rounded-xl p-3">
              <p className="text-xs text-lumine-danger font-medium">Motivo do cancelamento</p>
              <p className="text-sm text-lumine-danger mt-1">{sale.cancelReason}</p>
            </div>
          )}

          <div className="flex justify-between text-sm text-lumine-warm-gray">
            <span>Atendente</span>
            <span>{sale.user.name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
