'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

type CardMethod = 'DEBIT_CARD' | 'CREDIT_CARD';

interface CardFee {
  method: CardMethod;
  installments: number;
  feePercent: number;
}

const METHOD_LABELS: Record<CardMethod, string> = {
  DEBIT_CARD: 'Débito',
  CREDIT_CARD: 'Crédito',
};

/**
 * Sugestão inicial quando a loja ainda não preencheu nada.
 *
 * São só valores de partida para a tela não abrir vazia — a taxa real vem
 * do extrato da operadora e varia de contrato para contrato.
 */
const SUGESTAO: CardFee[] = [
  { method: 'DEBIT_CARD', installments: 1, feePercent: 1.99 },
  { method: 'CREDIT_CARD', installments: 1, feePercent: 3.49 },
  { method: 'CREDIT_CARD', installments: 2, feePercent: 4.99 },
  { method: 'CREDIT_CARD', installments: 3, feePercent: 5.99 },
];

/** Aceita vírgula: no teclado brasileiro é o que se digita. */
function parsePercent(texto: string): number {
  const limpo = texto.replace(/[^\d,.-]/g, '').replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

export function CardFeesPanel() {
  const qc = useQueryClient();
  const [linhas, setLinhas] = useState<CardFee[]>([]);
  const [carregou, setCarregou] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['card-fees'],
    queryFn: () => api.get<CardFee[]>('/api/card-fees'),
  });

  // Carrega uma vez só: recarregar a cada render apagaria o que está sendo digitado
  useEffect(() => {
    if (carregou || !data) return;
    setLinhas(data.data ?? []);
    setCarregou(true);
  }, [data, carregou]);

  const salvar = useMutation({
    mutationFn: () => api.put('/api/card-fees', { fees: linhas }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card-fees'] });
      qc.invalidateQueries({ queryKey: ['sales'] });
      toast({ title: 'Tabela de taxas salva' });
    },
    onError: (err) =>
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      }),
  });

  function atualizar(idx: number, patch: Partial<CardFee>) {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function adicionar() {
    // Próxima parcela livre no crédito, que é o caso comum de "faltou o 4x"
    const usadas = linhas
      .filter((l) => l.method === 'CREDIT_CARD')
      .map((l) => l.installments);
    let proxima = 1;
    while (usadas.includes(proxima) && proxima < 24) proxima++;
    setLinhas((prev) => [
      ...prev,
      { method: 'CREDIT_CARD', installments: proxima, feePercent: 0 },
    ]);
  }

  // Duas linhas com a mesma (forma, parcela) — o banco recusaria na hora de salvar
  const duplicadas = new Set(
    linhas
      .map((l) => `${l.method}-${l.installments}`)
      .filter((k, i, arr) => arr.indexOf(k) !== i)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Taxas do cartão</CardTitle>
        <p className="text-sm text-lumine-warm-gray mt-1">
          Quanto a maquininha desconta em cada forma. O sistema usa isso para
          mostrar quanto você <strong>realmente recebe</strong> em cada venda.
          Forma sem linha aqui é tratada como taxa zero.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-lumine-warm-gray py-4">
            <Loader2 size={14} className="animate-spin" /> Carregando...
          </div>
        ) : (
          <>
            {linhas.length === 0 && (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-lumine-warm-gray">
                  Nenhuma taxa cadastrada — as vendas no cartão estão entrando pelo valor cheio.
                </p>
                <Button size="sm" variant="outline" onClick={() => setLinhas(SUGESTAO)}>
                  Começar com valores de exemplo
                </Button>
              </div>
            )}

            {linhas.length > 0 && (
              <div className="space-y-2">
                <div className="hidden sm:flex items-center gap-2 px-1 text-xs uppercase tracking-wide text-lumine-warm-gray">
                  <span className="w-32">Forma</span>
                  <span className="w-24">Parcelas</span>
                  <span className="w-28">Taxa (%)</span>
                </div>

                {linhas.map((linha, idx) => {
                  const dup = duplicadas.has(`${linha.method}-${linha.installments}`);
                  return (
                    <div
                      key={idx}
                      className={`flex flex-wrap items-center gap-2 p-2 rounded-xl border ${
                        dup ? 'border-lumine-danger bg-lumine-danger/5' : 'border-lumine-lavender-pale'
                      }`}
                    >
                      <select
                        value={linha.method}
                        onChange={(e) => {
                          const method = e.target.value as CardMethod;
                          // Débito não parcela; forçar 1 evita salvar algo que o servidor recusa
                          atualizar(idx, {
                            method,
                            installments: method === 'DEBIT_CARD' ? 1 : linha.installments,
                          });
                        }}
                        className="w-32 h-9 px-2 rounded-lg border border-lumine-lavender-pale bg-white text-sm"
                      >
                        {(Object.keys(METHOD_LABELS) as CardMethod[]).map((m) => (
                          <option key={m} value={m}>{METHOD_LABELS[m]}</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={linha.installments}
                        disabled={linha.method === 'DEBIT_CARD'}
                        onChange={(e) =>
                          atualizar(idx, { installments: Math.max(1, Number(e.target.value) || 1) })
                        }
                        className="w-24 h-9 px-2 rounded-lg border border-lumine-lavender-pale bg-white text-sm disabled:bg-lumine-cream disabled:text-lumine-warm-gray"
                      />

                      <div className="relative w-28">
                        <input
                          type="text"
                          inputMode="decimal"
                          defaultValue={String(linha.feePercent).replace('.', ',')}
                          onChange={(e) => atualizar(idx, { feePercent: parsePercent(e.target.value) })}
                          className="w-full h-9 pl-2 pr-6 rounded-lg border border-lumine-lavender-pale bg-white text-sm"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-lumine-warm-gray">%</span>
                      </div>

                      <span className="text-xs text-lumine-warm-gray flex-1 min-w-[10rem]">
                        {linha.method === 'CREDIT_CARD'
                          ? `Crédito em ${linha.installments}x`
                          : 'Débito'}
                        {' — em R$ 100,00 você recebe '}
                        <strong className="text-lumine-sage-dark">
                          {(100 - linha.feePercent).toFixed(2).replace('.', ',')}
                        </strong>
                      </span>

                      <button
                        type="button"
                        onClick={() => setLinhas((prev) => prev.filter((_, i) => i !== idx))}
                        aria-label="Remover linha"
                        className="h-9 w-9 flex items-center justify-center rounded-lg text-lumine-warm-gray hover:text-lumine-danger transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {duplicadas.size > 0 && (
              <p className="text-xs text-lumine-danger">
                Há linhas repetidas para a mesma forma e parcela. Remova as duplicadas antes de salvar.
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={adicionar}>
                <Plus size={14} className="mr-2" /> Adicionar linha
              </Button>
              <Button
                size="sm"
                onClick={() => salvar.mutate()}
                disabled={salvar.isPending || duplicadas.size > 0}
              >
                {salvar.isPending
                  ? <Loader2 size={14} className="mr-2 animate-spin" />
                  : <Save size={14} className="mr-2" />}
                Salvar tabela
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
