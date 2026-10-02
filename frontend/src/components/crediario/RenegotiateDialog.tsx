'use client';

import { useMemo, useState } from 'react';
import { CheckSquare, Loader2, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { SelectMenu } from '@/components/ui/select-menu';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  CrediarioFrequency, Installment, useInstallments, useRenegotiate,
} from '@/hooks/useCrediario';

const FREQUENCY_LABELS: Record<CrediarioFrequency, string> = {
  MONTHLY: 'Mensal',
  BIWEEKLY: 'Quinzenal (15 dias)',
  WEEKLY: 'Semanal (7 dias)',
};

/** Data de hoje + N dias, no formato do <input type="date">. */
function emDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Junta as parcelas em aberto de um cliente num plano novo.
 *
 * É o "quero juntar tudo da Monique e fazer de 15 em 15": soma o que está em
 * aberto, permite desconto ou acréscimo, e recria em N parcelas. As antigas
 * não somem — ficam marcadas como renegociadas, apontando para o plano novo.
 */
export function RenegotiateDialog({
  customerId, customerName, onClose,
}: {
  customerId: string;
  customerName: string;
  onClose: () => void;
}) {
  const renegotiate = useRenegotiate();

  // Só as parcelas em aberto do cliente entram na renegociação
  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set('customerId', customerId);
    p.set('status', 'PENDING');
    return p.toString();
  }, [customerId]);

  // 100 = teto do backend. Acima disso o aviso abaixo aparece.
  const { data, isLoading } = useInstallments(query, 1, 100);
  const abertas: Installment[] = data?.data ?? [];
  // Cliente com mais parcelas do que cabe na página: avisa em vez de
  // renegociar um pedaço em silêncio
  const faltamParcelas = (data?.meta?.total ?? 0) > abertas.length;

  const [selecionadas, setSelecionadas] = useState<Set<string> | null>(null);
  const [count, setCount] = useState(3);
  const [frequency, setFrequency] = useState<CrediarioFrequency>('MONTHLY');
  const [firstDueDate, setFirstDueDate] = useState(emDias(30));
  // Valor sempre positivo + sinal separado: o teclado decimal do iPhone não
  // tem tecla de menos, então digitar "-10" era impossível no celular
  const [ajusteModo, setAjusteModo] = useState<'desconto' | 'juros'>('desconto');
  const [ajusteValor, setAjusteValor] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  // Começa com tudo marcado: juntar a dívida inteira é o caso comum
  const marcadas = selecionadas ?? new Set(abertas.map((i) => i.id));

  function toggle(id: string) {
    const next = new Set(marcadas);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelecionadas(next);
  }

  const somaAntiga = round2(
    abertas.filter((i) => marcadas.has(i.id)).reduce((acc, i) => acc + Number(i.amount), 0)
  );
  const ajuste = round2((ajusteModo === 'desconto' ? -1 : 1) * Math.abs(ajusteValor ?? 0));
  const novoTotal = round2(somaAntiga + ajuste);
  const podeSalvar = marcadas.size > 0 && novoTotal > 0 && !!firstDueDate;

  function salvar() {
    renegotiate.mutate(
      {
        installmentIds: Array.from(marcadas),
        count,
        firstDueDate,
        frequency,
        adjustment: ajuste,
        ...(notes.trim() && { notes: notes.trim() }),
      },
      { onSuccess: onClose }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3 border-b border-lumine-lavender-pale shrink-0">
          <p className="font-heading text-lg text-lumine-sage-dark">Renegociar dívida</p>
          <p className="text-xs text-lumine-warm-gray mt-0.5">{customerName}</p>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-lumine-warm-gray py-6">
              <Loader2 size={14} className="animate-spin" /> Carregando parcelas...
            </div>
          ) : abertas.length === 0 ? (
            <p className="text-sm text-lumine-warm-gray py-6 text-center">
              Esta cliente não tem parcela em aberto.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <p className="text-xs text-lumine-warm-gray uppercase tracking-wide">
                  Parcelas a juntar
                </p>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-lumine-lavender-pale divide-y divide-lumine-lavender-pale">
                  {abertas.map((i) => {
                    const atrasada = new Date(i.dueDate) < new Date();
                    return (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() => toggle(i.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-lumine-lavender-pale/30 transition-colors"
                      >
                        {marcadas.has(i.id)
                          ? <CheckSquare size={15} className="text-lumine-lavender shrink-0" />
                          : <Square size={15} className="text-lumine-warm-gray shrink-0" />}
                        <span className="flex-1 text-sm">
                          Parcela {i.number}/{i.totalCount}
                          <span className={`ml-2 text-xs ${atrasada ? 'text-lumine-danger' : 'text-lumine-warm-gray'}`}>
                            vence {formatDate(i.dueDate)}{atrasada ? ' · atrasada' : ''}
                          </span>
                        </span>
                        <span className="text-sm font-medium shrink-0">
                          {formatCurrency(Number(i.amount))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 space-y-1.5">
                  <label className="text-xs text-lumine-warm-gray">Novas parcelas</label>
                  <SelectMenu
                    value={String(count)}
                    onChange={(v) => setCount(Number(v))}
                    options={Array.from({ length: 24 }, (_, n) => n + 1).map((n) => ({
                      value: String(n),
                      label: `${n}x`,
                      hint: formatCurrency(novoTotal / n),
                    }))}
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="text-xs text-lumine-warm-gray">Frequência</label>
                  <SelectMenu
                    value={frequency}
                    onChange={(v) => setFrequency(v as CrediarioFrequency)}
                    options={(['MONTHLY', 'BIWEEKLY', 'WEEKLY'] as const).map((f) => ({
                      value: f,
                      label: FREQUENCY_LABELS[f],
                    }))}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 space-y-1.5">
                  <label className="text-xs text-lumine-warm-gray">1º vencimento</label>
                  <Input
                    type="date"
                    value={firstDueDate}
                    onChange={(e) => setFirstDueDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-lumine-warm-gray">Ajuste</label>
                    <div className="flex rounded-lg border border-lumine-lavender-pale overflow-hidden">
                      {(['desconto', 'juros'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setAjusteModo(m)}
                          className={`px-2 py-0.5 text-xs transition-colors ${
                            ajusteModo === m
                              ? 'bg-lumine-lavender text-white'
                              : 'text-lumine-warm-gray hover:bg-lumine-lavender-pale/50'
                          }`}
                        >
                          {m === 'desconto' ? '− Desc.' : '+ Juros'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <MoneyInput
                    value={ajusteValor}
                    onValueChange={setAjusteValor}
                    placeholder="0,00"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-lumine-warm-gray">Observação</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: acordo feito no balcão em 30/09"
                  className="h-9 text-sm"
                />
              </div>

              <div className="rounded-xl bg-lumine-lavender-pale/40 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-lumine-warm-gray">
                    {marcadas.size} parcela(s) selecionada(s)
                  </span>
                  <span>{formatCurrency(somaAntiga)}</span>
                </div>
                {ajuste !== 0 && (
                  <div className={`flex justify-between ${ajuste < 0 ? 'text-lumine-success' : 'text-lumine-danger'}`}>
                    <span>{ajuste < 0 ? 'Desconto' : 'Juros'}</span>
                    <span>{formatCurrency(ajuste)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold pt-1 border-t border-lumine-lavender/40">
                  <span className="text-lumine-sage-dark">Novo total</span>
                  <span className="text-lumine-gold">{formatCurrency(novoTotal)}</span>
                </div>
                <p className="text-xs text-lumine-warm-gray pt-1">
                  {count}x de {formatCurrency(novoTotal / count)},{' '}
                  {frequency === 'MONTHLY'
                    ? 'todo mês'
                    : frequency === 'BIWEEKLY'
                      ? 'a cada 15 dias'
                      : 'toda semana'}{' '}
                  a partir do 1º vencimento.
                </p>
              </div>

              {faltamParcelas && (
                <p className="text-xs text-lumine-danger">
                  Esta cliente tem {data?.meta?.total} parcelas em aberto e só as{' '}
                  {abertas.length} primeiras aparecem aqui. Renegocie em duas etapas.
                </p>
              )}

              <p className="text-xs text-lumine-warm-gray">
                As parcelas antigas ficam marcadas como renegociadas — elas somem do
                saldo em aberto, mas continuam no histórico do cliente.
              </p>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-lumine-lavender-pale flex gap-2 justify-end shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={salvar} disabled={!podeSalvar || renegotiate.isPending}>
            {renegotiate.isPending && <Loader2 size={14} className="animate-spin mr-2" />}
            Renegociar
          </Button>
        </div>
      </div>
    </div>
  );
}
