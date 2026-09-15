'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, X, AlertCircle, Wallet, Users, CheckCircle2, Phone, Undo2, Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SelectMenu } from '@/components/ui/select-menu';
import { MoneyInput } from '@/components/ui/money-input';
import { FilterSelect } from '@/components/ui/filter-select';
import { formatCurrency, formatDate, PAYMENT_METHOD_LABELS } from '@/lib/formatters';
import { usePermission } from '@/hooks/usePermission';
import {
  useCrediarioSummary, useDebtors, useInstallments,
  usePayInstallment, useReopenInstallment, Installment,
} from '@/hooks/useCrediario';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Em aberto',
  PAID: 'Paga',
  CANCELLED: 'Cancelada',
};

function isOverdue(i: Installment) {
  return i.status === 'PENDING' && new Date(i.dueDate) < new Date();
}

/** Card de resumo do topo. */
function StatCard({
  label, value, hint, icon: Icon, tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Wallet;
  tone?: 'default' | 'danger' | 'success';
}) {
  const tones = {
    default: 'text-lumine-lavender bg-lumine-lavender-pale',
    danger: 'text-lumine-danger bg-lumine-danger/10',
    success: 'text-lumine-success bg-lumine-success/10',
  };

  return (
    <Card>
      <CardContent className="pt-4 pb-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}>
          <Icon size={18} strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-heading font-semibold text-lumine-charcoal truncate">{value}</p>
          <p className="text-xs text-lumine-warm-gray">{label}</p>
          {hint && <p className="text-xs text-lumine-warm-gray/80">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

/** Diálogo de baixa de parcela. */
function PayDialog({
  installment, onClose,
}: {
  installment: Installment | null;
  onClose: () => void;
}) {
  const pay = usePayInstallment();
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState('CASH');
  const [notes, setNotes] = useState('');

  if (!installment) return null;

  const valor = amount ?? Number(installment.amount);
  const parcial = valor < Number(installment.amount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-lumine-lavender-pale">
          <p className="font-heading text-lg text-lumine-sage-dark">Dar baixa na parcela</p>
          <p className="text-xs text-lumine-warm-gray mt-0.5">
            {installment.customer.name} · parcela {installment.number}/{installment.totalCount}
          </p>
        </div>

        <div className="p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-lumine-warm-gray">Valor da parcela</span>
            <span className="font-medium">{formatCurrency(Number(installment.amount))}</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-lumine-warm-gray">Valor recebido</label>
            <MoneyInput
              value={amount}
              onValueChange={setAmount}
              placeholder={formatCurrency(Number(installment.amount)).replace('R$', '').trim()}
              className="h-9 text-sm"
            />
            {parcial && (
              <p className="text-xs text-lumine-danger">
                Valor menor que a parcela. A parcela será marcada como paga mesmo assim —
                registre a diferença na observação.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-lumine-warm-gray">Forma de pagamento</label>
            <SelectMenu
              value={method}
              onChange={setMethod}
              options={['CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD'].map((m) => ({
                value: m,
                label: PAYMENT_METHOD_LABELS[m] ?? m,
              }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-lumine-warm-gray">Observação</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
              className="h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2 px-5 py-3 border-t border-lumine-lavender-pale bg-lumine-cream/50">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={pay.isPending}
            onClick={() =>
              pay.mutate(
                {
                  id: installment.id,
                  paidAmount: amount ?? undefined,
                  paidMethod: method,
                  notes: notes.trim() || undefined,
                },
                { onSuccess: onClose }
              )
            }
          >
            {pay.isPending && <Loader2 size={14} className="animate-spin mr-2" />}
            Confirmar baixa
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CrediarioPage() {
  const { isOwner } = usePermission();
  const [tab, setTab] = useState<'debtors' | 'installments'>('debtors');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState<Installment | null>(null);

  const summary = useCrediarioSummary().data;
  const debtors = useDebtors().data ?? [];
  const reopen = useReopenInstallment();

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (onlyOverdue) params.set('overdue', 'true');
  const { data, isLoading } = useInstallments(params.toString(), page);

  const installments = data?.data ?? [];
  const meta = data?.meta;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl text-lumine-sage-dark">Crediário</h1>
        <p className="text-sm text-lumine-warm-gray mt-1">
          Quem deve, quanto e quando vence
        </p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Em aberto"
          value={formatCurrency(summary?.openAmount ?? 0)}
          hint={`${summary?.openCount ?? 0} parcela(s)`}
          icon={Wallet}
        />
        <StatCard
          label="Em atraso"
          value={formatCurrency(summary?.overdueAmount ?? 0)}
          hint={`${summary?.overdueCount ?? 0} parcela(s)`}
          icon={AlertCircle}
          tone={summary?.overdueCount ? 'danger' : 'default'}
        />
        <StatCard
          label="Recebido no mês"
          value={formatCurrency(summary?.receivedThisMonth ?? 0)}
          hint={`${summary?.receivedCount ?? 0} baixa(s)`}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Devedores"
          value={String(summary?.debtorCount ?? 0)}
          hint="com parcela em aberto"
          icon={Users}
        />
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-lumine-lavender-pale/50 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('debtors')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'debtors'
              ? 'bg-white text-lumine-sage-dark shadow-sm'
              : 'text-lumine-warm-gray hover:text-lumine-sage'
          }`}
        >
          Devedores
        </button>
        <button
          onClick={() => setTab('installments')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'installments'
              ? 'bg-white text-lumine-sage-dark shadow-sm'
              : 'text-lumine-warm-gray hover:text-lumine-sage'
          }`}
        >
          Parcelas
        </button>
      </div>

      {tab === 'debtors' ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {debtors.length} cliente(s) com saldo em aberto
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {debtors.length === 0 ? (
              <div className="flex flex-col items-center py-14 text-lumine-warm-gray">
                <CheckCircle2 size={36} strokeWidth={1} className="mb-2 opacity-40" />
                <p className="text-sm">Ninguém devendo. Tudo em dia!</p>
              </div>
            ) : (
              <div className="divide-y divide-lumine-lavender-pale">
                {debtors.map((d) => (
                  <div
                    key={d.customer.id}
                    className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-lumine-charcoal truncate">
                          {d.customer.name}
                        </p>
                        {d.overdueCount > 0 && (
                          <Badge variant="danger">{d.overdueCount} em atraso</Badge>
                        )}
                      </div>
                      <p className="text-xs text-lumine-warm-gray mt-0.5 flex items-center gap-2 flex-wrap">
                        {d.customer.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone size={11} />
                            {d.customer.phone}
                          </span>
                        )}
                        <span>{d.openCount} parcela(s)</span>
                        <span>próx. venc. {formatDate(d.nextDueDate)}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`font-semibold ${
                          d.overdueCount > 0 ? 'text-lumine-danger' : 'text-lumine-charcoal'
                        }`}
                      >
                        {formatCurrency(d.openAmount)}
                      </p>
                      {d.overdueAmount > 0 && (
                        <p className="text-xs text-lumine-danger">
                          {formatCurrency(d.overdueAmount)} vencido
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Filtros das parcelas */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[12rem] max-w-sm">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-lumine-warm-gray"
              />
              <Input
                placeholder="Buscar cliente..."
                className="pl-9 pr-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  aria-label="Limpar"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-lumine-warm-gray"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <FilterSelect
              label="Status"
              placeholder="Todos"
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              options={[
                { value: 'PENDING', label: 'Em aberto' },
                { value: 'PAID', label: 'Paga' },
                { value: 'CANCELLED', label: 'Cancelada' },
              ]}
            />

            <button
              type="button"
              onClick={() => { setOnlyOverdue((v) => !v); setPage(1); }}
              className={`flex items-center gap-1.5 h-9 px-3 rounded-xl border text-sm transition-all ${
                onlyOverdue
                  ? 'border-lumine-danger bg-lumine-danger/10 text-lumine-danger ring-1 ring-lumine-danger/40'
                  : 'border-lumine-lavender-pale bg-white text-lumine-warm-gray hover:border-lumine-lavender'
              }`}
            >
              <AlertCircle size={13} />
              Só atrasadas
            </button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="px-4 sm:px-6 py-3 border-b border-lumine-lavender-pale text-sm text-lumine-warm-gray">
                {meta?.total ?? 0} parcela(s)
              </div>

              {isLoading ? (
                <div className="divide-y divide-lumine-lavender-pale">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 bg-lumine-lavender-pale rounded w-1/3" />
                        <div className="h-3 bg-lumine-lavender-pale rounded w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : installments.length === 0 ? (
                <div className="flex flex-col items-center py-14 text-lumine-warm-gray">
                  <Wallet size={36} strokeWidth={1} className="mb-2 opacity-40" />
                  <p className="text-sm">Nenhuma parcela encontrada</p>
                </div>
              ) : (
                <div className="divide-y divide-lumine-lavender-pale">
                  {installments.map((i) => {
                    const atrasada = isOverdue(i);
                    return (
                      <div
                        key={i.id}
                        className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-lumine-charcoal truncate">
                              {i.customer.name}
                            </p>
                            <Badge
                              variant={
                                i.status === 'PAID'
                                  ? 'success'
                                  : atrasada
                                    ? 'danger'
                                    : 'warning'
                              }
                            >
                              {atrasada ? 'Atrasada' : STATUS_LABELS[i.status]}
                            </Badge>
                          </div>
                          <p className="text-xs text-lumine-warm-gray mt-0.5">
                            Parcela {i.number}/{i.totalCount} · venda #{i.sale.saleNumber} ·
                            {' '}vence {formatDate(i.dueDate)}
                            {i.status === 'PAID' && i.paidAt && ` · paga em ${formatDate(i.paidAt)}`}
                          </p>
                          {i.notes && (
                            <p className="text-xs text-lumine-warm-gray/80 italic mt-0.5">
                              {i.notes}
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <p
                            className={`font-semibold ${
                              atrasada ? 'text-lumine-danger' : 'text-lumine-charcoal'
                            }`}
                          >
                            {formatCurrency(Number(i.amount))}
                          </p>
                          {i.status === 'PAID' && i.paidAmount != null && (
                            <p className="text-xs text-lumine-success">
                              recebido {formatCurrency(Number(i.paidAmount))}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0">
                          {i.status === 'PENDING' ? (
                            <Button size="sm" onClick={() => setPaying(i)}>
                              Dar baixa
                            </Button>
                          ) : i.status === 'PAID' && isOwner ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm('Reabrir esta parcela? A baixa será desfeita.')) {
                                  reopen.mutate(i.id);
                                }
                              }}
                            >
                              <Undo2 size={13} className="mr-1" />
                              Reabrir
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {meta && meta.totalPages > 1 && (
                <div className="flex justify-center gap-2 p-4 border-t border-lumine-lavender-pale">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page === meta.totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <PayDialog installment={paying} onClose={() => setPaying(null)} />
    </motion.div>
  );
}
