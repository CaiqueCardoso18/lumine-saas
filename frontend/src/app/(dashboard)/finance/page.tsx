'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownCircle, ArrowUpCircle, Ban, CalendarDays, Check, ChevronLeft,
  ChevronRight, Loader2, Plus, Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoneyInput } from '@/components/ui/money-input';
import { SelectMenu } from '@/components/ui/select-menu';
import { PermissionGuard } from '@/components/layout/PermissionGuard';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  CalendarDay, useCalendar, useCancelPayable, useCreatePayable, usePayPayable,
} from '@/hooks/useFinance';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** YYYY-MM-DD no fuso local — mesma chave que o backend devolve. */
function dayKey(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Células do mês, com as lacunas antes do dia 1 e depois do último.
 *
 * O backend manda só os dias que têm lançamento; a grade precisa das casas
 * vazias para as colunas caírem no dia da semana certo.
 */
function buildGrid(year: number, month: number): Array<Date | null> {
  const primeiro = new Date(year, month - 1, 1);
  const ultimo = new Date(year, month, 0);
  const antes = primeiro.getDay();

  const celulas: Array<Date | null> = Array.from({ length: antes }, () => null);
  for (let d = 1; d <= ultimo.getDate(); d++) {
    celulas.push(new Date(year, month - 1, d));
  }
  // Completa a última semana para a grade não ficar com buraco visual
  while (celulas.length % 7 !== 0) celulas.push(null);

  return celulas;
}

function Kpi({
  label, value, hint, icon: Icon, tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Wallet;
  tone?: 'default' | 'success' | 'danger';
}) {
  const cor =
    tone === 'success' ? 'text-lumine-success'
      : tone === 'danger' ? 'text-lumine-danger'
        : 'text-lumine-charcoal';
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-lumine-warm-gray">{label}</p>
          <p className={`font-heading text-xl font-semibold mt-1 ${cor}`}>{value}</p>
          {hint && <p className="text-xs text-lumine-warm-gray mt-0.5">{hint}</p>}
        </div>
        <Icon size={18} strokeWidth={1.5} className="text-lumine-lavender shrink-0" />
      </div>
    </Card>
  );
}

/** Formulário de nova conta a pagar. */
function NovaContaDialog({ onClose }: { onClose: () => void }) {
  const criar = useCreatePayable();
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState(dayKey(new Date()));
  const [repeatMonths, setRepeatMonths] = useState(1);
  const [notes, setNotes] = useState('');

  const pode = description.trim().length > 0 && (amount ?? 0) > 0 && !!dueDate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-lumine-lavender-pale">
          <p className="font-heading text-lg text-lumine-sage-dark">Nova conta a pagar</p>
        </div>

        <div className="p-5 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-lumine-warm-gray">Descrição</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Aluguel da loja"
              className="h-9 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs text-lumine-warm-gray">Valor</label>
              <MoneyInput
                value={amount}
                onValueChange={setAmount}
                placeholder="0,00"
                className="h-9 text-sm"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-xs text-lumine-warm-gray">Vencimento</label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs text-lumine-warm-gray">Categoria</label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Aluguel, Energia..."
                className="h-9 text-sm"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-xs text-lumine-warm-gray">Repetir por</label>
              <SelectMenu
                value={String(repeatMonths)}
                onChange={(v) => setRepeatMonths(Number(v))}
                options={[1, 2, 3, 6, 12, 24].map((n) => ({
                  value: String(n),
                  label: n === 1 ? 'Só uma vez' : `${n} meses`,
                }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-lumine-warm-gray">Observação</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {repeatMonths > 1 && (
            <p className="text-xs text-lumine-warm-gray">
              Serão criadas {repeatMonths} contas, uma por mês. Vencimento dia 31 cai
              no último dia dos meses mais curtos.
            </p>
          )}
        </div>

        <div className="px-5 py-3 border-t border-lumine-lavender-pale flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            size="sm"
            disabled={!pode || criar.isPending}
            onClick={() =>
              criar.mutate(
                {
                  description: description.trim(),
                  amount: amount ?? 0,
                  dueDate,
                  repeatMonths,
                  ...(category.trim() && { category: category.trim() }),
                  ...(notes.trim() && { notes: notes.trim() }),
                },
                { onSuccess: onClose }
              )
            }
          >
            {criar.isPending && <Loader2 size={14} className="animate-spin mr-2" />}
            Cadastrar
          </Button>
        </div>
      </div>
    </div>
  );
}

function FinanceContent() {
  const hoje = new Date();
  const [year, setYear] = useState(hoje.getFullYear());
  const [month, setMonth] = useState(hoje.getMonth() + 1);
  const [diaAberto, setDiaAberto] = useState<string | null>(dayKey(hoje));
  const [novaConta, setNovaConta] = useState(false);

  const { data, isLoading } = useCalendar(year, month);
  const pagar = usePayPayable();
  const cancelar = useCancelPayable();

  const porDia = useMemo(() => {
    const m = new Map<string, CalendarDay>();
    for (const d of data?.days ?? []) m.set(d.date, d);
    return m;
  }, [data]);

  const grade = useMemo(() => buildGrid(year, month), [year, month]);

  function andarMes(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    setDiaAberto(null);
  }

  const detalhe = diaAberto ? porDia.get(diaAberto) : undefined;
  const totals = data?.totals;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl text-lumine-sage-dark">Calendário financeiro</h1>
          <p className="text-sm text-lumine-warm-gray mt-1">
            O que entra do crediário e o que sai em contas, dia a dia
          </p>
        </div>
        <Button size="sm" onClick={() => setNovaConta(true)}>
          <Plus size={14} className="mr-2" /> Nova conta a pagar
        </Button>
      </div>

      {/* Resumo do mês */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi
          label="A receber no mês"
          value={formatCurrency(totals?.receivable ?? 0)}
          hint={
            (totals?.overdueReceivable ?? 0) > 0
              ? `${formatCurrency(totals?.overdueReceivable ?? 0)} vencido`
              : undefined
          }
          icon={ArrowUpCircle}
          tone="success"
        />
        <Kpi
          label="A pagar no mês"
          value={formatCurrency(totals?.payable ?? 0)}
          hint={
            (totals?.overduePayable ?? 0) > 0
              ? `${formatCurrency(totals?.overduePayable ?? 0)} vencido`
              : undefined
          }
          icon={ArrowDownCircle}
          tone="danger"
        />
        <Kpi
          label="Saldo previsto"
          value={formatCurrency(totals?.net ?? 0)}
          hint="entra menos sai"
          icon={Wallet}
          tone={(totals?.net ?? 0) < 0 ? 'danger' : 'success'}
        />
      </div>

      {/* Grade do mês */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {MESES[month - 1]} de {year}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => andarMes(-1)}>
                <ChevronLeft size={15} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setYear(hoje.getFullYear());
                  setMonth(hoje.getMonth() + 1);
                  setDiaAberto(dayKey(hoje));
                }}
              >
                Hoje
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => andarMes(1)}>
                <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-lumine-warm-gray py-8 justify-center">
              <Loader2 size={14} className="animate-spin" /> Carregando...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DIAS_SEMANA.map((d) => (
                  <div key={d} className="text-center text-xs text-lumine-warm-gray py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {grade.map((data_, idx) => {
                  if (!data_) return <div key={`vazio-${idx}`} />;
                  const key = dayKey(data_);
                  const dia = porDia.get(key);
                  const ehHoje = key === dayKey(hoje);
                  const selecionado = key === diaAberto;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDiaAberto(selecionado ? null : key)}
                      className={`min-h-[4.5rem] rounded-xl border p-1.5 text-left transition-all ${
                        selecionado
                          ? 'border-lumine-lavender ring-1 ring-lumine-lavender bg-lumine-lavender-pale/40'
                          : ehHoje
                            ? 'border-lumine-lavender bg-white'
                            : 'border-lumine-lavender-pale bg-white hover:border-lumine-lavender'
                      }`}
                    >
                      <span
                        className={`text-xs ${
                          ehHoje ? 'font-semibold text-lumine-lavender' : 'text-lumine-warm-gray'
                        }`}
                      >
                        {data_.getDate()}
                      </span>
                      {dia && (
                        <div className="mt-1 space-y-0.5">
                          {dia.receivable > 0 && (
                            <p className="text-[11px] leading-tight text-lumine-success tabular-nums truncate">
                              +{formatCurrency(dia.receivable)}
                            </p>
                          )}
                          {dia.payable > 0 && (
                            <p className="text-[11px] leading-tight text-lumine-danger tabular-nums truncate">
                              −{formatCurrency(dia.payable)}
                            </p>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detalhe do dia escolhido */}
      {diaAberto && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays size={15} className="text-lumine-lavender" />
              {formatDate(`${diaAberto}T12:00:00`)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!detalhe || detalhe.entries.length === 0 ? (
              <p className="text-sm text-lumine-warm-gray text-center py-8">
                Nada entra nem sai neste dia.
              </p>
            ) : (
              <div className="divide-y divide-lumine-lavender-pale">
                {detalhe.entries.map((e) => (
                  <div key={`${e.kind}-${e.id}`} className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-lumine-charcoal truncate">
                        {e.description}
                      </p>
                      <p className="text-xs text-lumine-warm-gray">
                        {e.kind === 'RECEIVABLE' ? 'A receber' : 'A pagar'}
                        {e.party && ` · ${e.party}`}
                        {e.overdue && ' · vencido'}
                      </p>
                    </div>
                    <span
                      className={`font-semibold shrink-0 ${
                        e.kind === 'RECEIVABLE' ? 'text-lumine-success' : 'text-lumine-danger'
                      }`}
                    >
                      {e.kind === 'RECEIVABLE' ? '+' : '−'}{formatCurrency(e.amount)}
                    </span>
                    {e.link?.type === 'payable' && (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pagar.isPending}
                          onClick={() => pagar.mutate({ id: e.link!.id })}
                        >
                          <Check size={13} className="mr-1" /> Paguei
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 hover:text-lumine-danger"
                          title="Cancelar conta"
                          onClick={() => {
                            if (confirm(`Cancelar "${e.description}"?`)) {
                              cancelar.mutate(e.link!.id);
                            }
                          }}
                        >
                          <Ban size={13} />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex justify-between px-4 sm:px-6 py-3 bg-lumine-cream/50 text-sm">
                  <span className="text-lumine-warm-gray">Saldo do dia</span>
                  <span
                    className={`font-semibold ${
                      detalhe.net < 0 ? 'text-lumine-danger' : 'text-lumine-success'
                    }`}
                  >
                    {formatCurrency(detalhe.net)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {novaConta && <NovaContaDialog onClose={() => setNovaConta(false)} />}
    </motion.div>
  );
}

export default function FinancePage() {
  return (
    <PermissionGuard ownerOnly>
      <FinanceContent />
    </PermissionGuard>
  );
}
