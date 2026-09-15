'use client';

import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SelectMenu } from '@/components/ui/select-menu';
import { MoneyInput } from '@/components/ui/money-input';
import { formatCurrency, PAYMENT_METHOD_LABELS } from '@/lib/formatters';

export type PaymentMethod =
  | 'CASH' | 'PIX' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'CREDIARIO' | 'MIXED';

/** Formas que podem compor um pagamento misto (MIXED não entra em si mesmo). */
export const SPLIT_METHODS: Exclude<PaymentMethod, 'MIXED'>[] = [
  'CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'CREDIARIO',
];

export interface SplitPayment {
  method: Exclude<PaymentMethod, 'MIXED'>;
  amount: number | null;
  installments?: number;
}

export type DiscountMode = 'value' | 'percent';

interface Props {
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (m: PaymentMethod) => void;
  installments: number;
  onInstallmentsChange: (n: number) => void;
  payments: SplitPayment[];
  onPaymentsChange: (p: SplitPayment[]) => void;
  discountMode: DiscountMode;
  onDiscountModeChange: (m: DiscountMode) => void;
  discountValue: number | null;
  onDiscountValueChange: (v: number | null) => void;
  crediarioCount: number;
  onCrediarioCountChange: (n: number) => void;
  crediarioFirstDue: string;
  onCrediarioFirstDueChange: (d: string) => void;
  subtotal: number;
  discountAmount: number;
  total: number;
  /** Quanto do total vai para o crediário (venda inteira ou parte do misto) */
  crediarioAmount: number;
  notes: string;
  onNotesChange: (v: string) => void;
}

export function PaymentPanel(p: Props) {
  const splitSum = p.payments.reduce((acc, x) => acc + (x.amount ?? 0), 0);
  const splitDiff = Math.round((p.total - splitSum) * 100) / 100;
  const splitOk = Math.abs(splitDiff) < 0.005;

  function updatePayment(i: number, patch: Partial<SplitPayment>) {
    p.onPaymentsChange(p.payments.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  function addPayment() {
    // Sugere o que falta para fechar o total, que é o caso comum
    const restante = Math.max(0, Math.round((p.total - splitSum) * 100) / 100);
    const usados = p.payments.map((x) => x.method);
    const proximo = SPLIT_METHODS.find((m) => !usados.includes(m)) ?? 'CASH';
    p.onPaymentsChange([...p.payments, { method: proximo, amount: restante || null }]);
  }

  return (
    <div className="space-y-3">
      {/* Forma de pagamento */}
      <div className="space-y-1.5">
        <Label className="text-xs">Forma de pagamento</Label>
        <SelectMenu
          value={p.paymentMethod}
          onChange={(v) => p.onPaymentMethodChange(v as PaymentMethod)}
          dropUp
          options={Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </div>

      {/* Parcelas do cartão de crédito */}
      {p.paymentMethod === 'CREDIT_CARD' && (
        <div className="space-y-1.5">
          <Label className="text-xs">Parcelas</Label>
          <SelectMenu
            value={String(p.installments)}
            onChange={(v) => p.onInstallmentsChange(Number(v))}
            dropUp
            options={Array.from({ length: 12 }, (_, i) => i + 1).map((n) => ({
              value: String(n),
              label: n > 1 ? `${n}x` : '1x (à vista)',
              hint: n > 1 ? `de ${formatCurrency(p.total / n)}` : undefined,
            }))}
          />
        </div>
      )}

      {/* Divisão do pagamento misto */}
      {p.paymentMethod === 'MIXED' && (
        <div className="rounded-xl border border-lumine-lavender-pale p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Formas de pagamento</Label>
            <button
              type="button"
              onClick={addPayment}
              className="text-xs text-lumine-lavender hover:text-lumine-sage inline-flex items-center gap-1 transition-colors"
            >
              <Plus size={12} />
              Adicionar
            </button>
          </div>

          {p.payments.length === 0 && (
            <p className="text-xs text-lumine-warm-gray py-1">
              Adicione ao menos duas formas de pagamento.
            </p>
          )}

          {p.payments.map((pay, i) => (
            <div key={i} className="flex items-center gap-2">
              <SelectMenu
                value={pay.method}
                onChange={(v) => updatePayment(i, { method: v as SplitPayment['method'] })}
                dropUp
                className="flex-1"
                options={SPLIT_METHODS.map((m) => ({
                  value: m,
                  label: PAYMENT_METHOD_LABELS[m] ?? m,
                }))}
              />
              <MoneyInput
                value={pay.amount}
                onValueChange={(v) => updatePayment(i, { amount: v })}
                placeholder="0,00"
                className="h-9 w-28 text-sm"
              />
              <button
                type="button"
                onClick={() => p.onPaymentsChange(p.payments.filter((_, idx) => idx !== i))}
                aria-label="Remover forma de pagamento"
                className="text-lumine-warm-gray hover:text-lumine-danger transition-colors shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {p.payments.length > 0 && (
            <div
              className={`flex items-center gap-1.5 text-xs pt-1 ${
                splitOk ? 'text-lumine-success' : 'text-lumine-danger'
              }`}
            >
              {!splitOk && <AlertCircle size={12} className="shrink-0" />}
              <span>
                Somado: {formatCurrency(splitSum)} de {formatCurrency(p.total)}
                {!splitOk &&
                  (splitDiff > 0
                    ? ` — faltam ${formatCurrency(splitDiff)}`
                    : ` — passou ${formatCurrency(Math.abs(splitDiff))}`)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Crediário */}
      {p.crediarioAmount > 0 && (
        <div className="rounded-xl border border-lumine-lavender-pale p-3 space-y-2">
          <Label className="text-xs">
            Crediário — {formatCurrency(p.crediarioAmount)}
          </Label>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <span className="text-xs text-lumine-warm-gray">Parcelas</span>
              <SelectMenu
                value={String(p.crediarioCount)}
                onChange={(v) => p.onCrediarioCountChange(Number(v))}
                dropUp
                options={Array.from({ length: 12 }, (_, i) => i + 1).map((n) => ({
                  value: String(n),
                  label: `${n}x`,
                  hint: formatCurrency(p.crediarioAmount / n),
                }))}
              />
            </div>
            <div className="flex-1 space-y-1">
              <span className="text-xs text-lumine-warm-gray">1º vencimento</span>
              <Input
                type="date"
                value={p.crediarioFirstDue}
                onChange={(e) => p.onCrediarioFirstDueChange(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-lumine-warm-gray">
            {p.crediarioCount}x de {formatCurrency(p.crediarioAmount / p.crediarioCount)},
            vencendo todo mês a partir da data escolhida.
          </p>
        </div>
      )}

      {/* Desconto com alternância R$ / % */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Desconto</Label>
          <div className="flex rounded-lg border border-lumine-lavender-pale overflow-hidden">
            <button
              type="button"
              onClick={() => p.onDiscountModeChange('value')}
              className={`px-2 py-0.5 text-xs transition-colors ${
                p.discountMode === 'value'
                  ? 'bg-lumine-lavender text-white'
                  : 'bg-white text-lumine-warm-gray hover:bg-lumine-lavender-pale/40'
              }`}
            >
              R$
            </button>
            <button
              type="button"
              onClick={() => p.onDiscountModeChange('percent')}
              className={`px-2 py-0.5 text-xs transition-colors ${
                p.discountMode === 'percent'
                  ? 'bg-lumine-lavender text-white'
                  : 'bg-white text-lumine-warm-gray hover:bg-lumine-lavender-pale/40'
              }`}
            >
              %
            </button>
          </div>
        </div>
        <MoneyInput
          value={p.discountValue}
          onValueChange={p.onDiscountValueChange}
          placeholder={p.discountMode === 'percent' ? '0' : '0,00'}
          formatOnBlur={p.discountMode === 'value'}
          className="h-9 text-sm"
        />
        {p.discountMode === 'percent' && p.discountValue ? (
          <p className="text-xs text-lumine-warm-gray">
            {p.discountValue}% de {formatCurrency(p.subtotal)} = {formatCurrency(p.discountAmount)}
          </p>
        ) : null}
      </div>

      {/* Observação */}
      <div className="space-y-1.5">
        <Label className="text-xs">Observação</Label>
        <textarea
          value={p.notes}
          onChange={(e) => p.onNotesChange(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Ex: cliente vai trocar o tamanho depois, levou sem sacola..."
          className="flex w-full rounded-xl border border-lumine-lavender-pale bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumine-lavender resize-y"
        />
      </div>
    </div>
  );
}
