'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Minus, Plus, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { SelectMenu } from '@/components/ui/select-menu';
import { api } from '@/lib/api';
import { formatCurrency, PAYMENT_METHOD_LABELS } from '@/lib/formatters';
import { Product, Sale } from '@/types';
import { toast } from '@/hooks/use-toast';

/** Formas aceitas na edição — crediário fica de fora (ver aviso abaixo). */
type EditMethod = 'CASH' | 'PIX' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'MIXED';
const EDIT_METHODS: EditMethod[] = ['CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'MIXED'];
const SPLIT_METHODS = ['CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD'] as const;

interface Linha {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  /** Estoque atual do produto, para não deixar passar do que existe */
  estoqueAtual?: number;
  /** Quanto desta linha já estava na venda — o que já saiu do estoque */
  quantidadeOriginal: number;
}

interface SplitLinha {
  method: (typeof SPLIT_METHODS)[number];
  amount: number | null;
  installments?: number;
}

/**
 * Edita uma venda já registrada.
 *
 * O estoque é ajustado pela DIFERENÇA no servidor, então o limite de cada
 * linha é "o que tem na prateleira + o que esta venda já tinha tirado" —
 * senão trocar 2 por 3 pareceria impossível numa peça com estoque zerado.
 */
export function EditSaleDialog({
  sale, onClose,
}: {
  sale: Sale | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [method, setMethod] = useState<EditMethod>('PIX');
  const [installments, setInstallments] = useState(1);
  const [splits, setSplits] = useState<SplitLinha[]>([]);
  const [discount, setDiscount] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');

  // Semeia o formulário quando a venda abre
  useEffect(() => {
    if (!sale) return;
    setLinhas(
      sale.items.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        productSku: i.productSku,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        discount: Number(i.discount),
        quantidadeOriginal: i.quantity,
      }))
    );
    setMethod((sale.paymentMethod === 'CREDIARIO' ? 'PIX' : sale.paymentMethod) as EditMethod);
    setInstallments(sale.payments[0]?.installments ?? 1);
    setSplits(
      sale.paymentMethod === 'MIXED'
        ? sale.payments
            .filter((p) => p.method !== 'CREDIARIO' && p.method !== 'MIXED')
            .map((p) => ({
              method: p.method as SplitLinha['method'],
              amount: Number(p.amount),
              installments: p.installments,
            }))
        : []
    );
    setDiscount(Number(sale.discountAmount) || null);
    setNotes(sale.notes ?? '');
    setReason('');
    setSearch('');
  }, [sale]);

  // Estoque atual de cada produto da venda, para limitar o "+"
  const estoques = useQueries({
    queries: (sale?.items ?? []).map((i) => ({
      queryKey: ['product', i.productId],
      queryFn: async () => (await api.get<Product>(`/api/products/${i.productId}`)).data,
      enabled: !!sale,
      staleTime: 60 * 1000,
    })),
  });

  useEffect(() => {
    const porId = new Map<string, number>();
    for (const q of estoques) {
      if (q.data) porId.set(q.data.id, q.data.quantity);
    }
    if (porId.size === 0) return;
    setLinhas((prev) =>
      prev.map((l) =>
        porId.has(l.productId) ? { ...l, estoqueAtual: porId.get(l.productId) } : l
      )
    );
    // Inclui o id da venda: duas vendas com os MESMOS produtos geravam a
    // mesma string e o efeito não rodava na segunda, deixando estoqueAtual
    // indefinido e o "+" sem limite
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sale?.id, estoques.map((q) => q.data?.id).join(',')]);

  // Busca para adicionar item novo
  const { data: busca } = useQuery({
    queryKey: ['products', 'search', search],
    queryFn: () =>
      api.paginated<Product>(
        `/api/products?search=${encodeURIComponent(search)}&status=ACTIVE&inStock=true&limit=10`
      ),
    enabled: search.length >= 2,
    staleTime: 30 * 1000,
  });

  const subtotal = useMemo(
    () => linhas.reduce((acc, l) => acc + Math.max(0, l.unitPrice * l.quantity - l.discount), 0),
    [linhas]
  );
  const descontoAplicado = Math.min(discount ?? 0, subtotal);
  const total = Math.round(Math.max(0, subtotal - descontoAplicado) * 100) / 100;

  const somaSplit = splits.reduce((acc, s) => acc + (s.amount ?? 0), 0);
  const splitOk = method !== 'MIXED' || (splits.length >= 2 && Math.abs(somaSplit - total) < 0.005);

  /** Teto de cada linha: prateleira + o que esta venda já tinha tirado. */
  function maximo(l: Linha): number {
    if (l.estoqueAtual === undefined) return Infinity;
    return l.estoqueAtual + l.quantidadeOriginal;
  }

  function mudarQuantidade(productId: string, delta: number) {
    setLinhas((prev) =>
      prev
        .map((l) => {
          if (l.productId !== productId) return l;
          const alvo = l.quantity + delta;
          if (delta > 0 && alvo > maximo(l)) {
            toast({
              title: 'Estoque insuficiente',
              description: `Só dá para vender ${maximo(l)} de ${l.productName}.`,
              variant: 'destructive',
            });
            return l;
          }
          return { ...l, quantity: Math.max(0, alvo) };
        })
        .filter((l) => l.quantity > 0)
    );
  }

  function adicionar(p: Product) {
    setLinhas((prev) => {
      const existente = prev.find((l) => l.productId === p.id);
      if (existente) {
        // Mesmo teto do botão "+": prateleira + o que esta venda já tinha tirado
        const teto = maximo(existente);
        if (existente.quantity >= teto) {
          toast({
            title: 'Estoque insuficiente',
            description: `Só dá para vender ${teto} de ${p.name}.`,
            variant: 'destructive',
          });
          return prev;
        }
        return prev.map((l) =>
          l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          productName: p.name,
          productSku: p.sku,
          quantity: 1,
          unitPrice: Number(p.salePrice),
          discount: 0,
          estoqueAtual: p.quantity,
          quantidadeOriginal: 0,
        },
      ];
    });
    setSearch('');
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.put(`/api/sales/${sale!.id}`, {
        items: linhas.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
        })),
        paymentMethod: method,
        ...(method === 'MIXED' && {
          payments: splits.map((s) => ({
            method: s.method,
            amount: s.amount ?? 0,
            ...(s.installments && { installments: s.installments }),
          })),
        }),
        installments,
        discountAmount: descontoAplicado,
        notes: notes.trim() || undefined,
        customerId: sale?.customerId ?? null,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['audit'] });
      toast({ title: 'Venda atualizada e estoque ajustado' });
      onClose();
    },
    onError: (err) =>
      toast({
        title: 'Erro ao editar venda',
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      }),
  });

  if (!sale) return null;

  const temCrediario = sale.paymentMethod === 'CREDIARIO';
  const podeSalvar =
    linhas.length > 0 && splitOk && reason.trim().length > 0 && !temCrediario;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3 border-b border-lumine-lavender-pale flex items-center justify-between shrink-0">
          <div>
            <p className="font-heading text-lg text-lumine-sage-dark">
              Editar venda #{sale.saleNumber}
            </p>
            <p className="text-xs text-lumine-warm-gray mt-0.5">
              O estoque é ajustado pela diferença, e a alteração fica na auditoria
            </p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="text-lumine-warm-gray">
            <X size={18} />
          </button>
        </div>

        {temCrediario ? (
          <div className="p-6 text-sm text-lumine-warm-gray space-y-2">
            <p className="text-lumine-danger font-medium">
              Esta venda tem crediário e não pode ser editada por aqui.
            </p>
            <p>
              Mexer no total depois de as parcelas existirem exigiria refazer o plano
              e possivelmente desfazer baixas já dadas. Para corrigir, estorne a venda
              e registre de novo.
            </p>
          </div>
        ) : (
          <div className="p-5 space-y-4 overflow-y-auto">
            {/* Itens */}
            <div className="space-y-1.5">
              <p className="text-xs text-lumine-warm-gray uppercase tracking-wide">Itens</p>
              <div className="rounded-xl border border-lumine-lavender-pale divide-y divide-lumine-lavender-pale">
                {linhas.map((l) => (
                  <div key={l.productId} className="flex items-center gap-2 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{l.productName}</p>
                      <p className="text-xs text-lumine-warm-gray">
                        {l.productSku} · {formatCurrency(l.unitPrice)}
                        {l.estoqueAtual !== undefined && ` · disponível ${maximo(l)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => mudarQuantidade(l.productId, -1)}
                      >
                        <Minus size={13} />
                      </Button>
                      <span className="w-7 text-center text-sm tabular-nums">{l.quantity}</span>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => mudarQuantidade(l.productId, 1)}
                      >
                        <Plus size={13} />
                      </Button>
                    </div>
                    <span className="w-20 text-right text-sm font-medium shrink-0">
                      {formatCurrency(l.unitPrice * l.quantity - l.discount)}
                    </span>
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 hover:text-lumine-danger shrink-0"
                      onClick={() =>
                        setLinhas((prev) => prev.filter((x) => x.productId !== l.productId))
                      }
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                ))}
                {linhas.length === 0 && (
                  <p className="px-3 py-4 text-sm text-lumine-danger text-center">
                    A venda precisa ter ao menos um item.
                  </p>
                )}
              </div>
            </div>

            {/* Adicionar item */}
            <div className="space-y-1.5">
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-lumine-warm-gray"
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Adicionar produto à venda..."
                  className="pl-9 h-9 text-sm"
                />
              </div>
              {search.length >= 2 && (busca?.data ?? []).length > 0 && (
                <div className="rounded-xl border border-lumine-lavender-pale divide-y divide-lumine-lavender-pale max-h-40 overflow-y-auto">
                  {(busca?.data ?? []).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => adicionar(p)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-lumine-lavender-pale/40 transition-colors"
                    >
                      <span className="flex-1 text-sm truncate">
                        {p.name}
                        <span className="text-xs text-lumine-warm-gray ml-2">
                          {p.sku} · estoque {p.quantity}
                        </span>
                      </span>
                      <span className="text-sm text-lumine-gold shrink-0">
                        {formatCurrency(p.salePrice)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pagamento */}
            <div className="flex gap-2">
              <div className="flex-1 space-y-1.5">
                <label className="text-xs text-lumine-warm-gray">Forma de pagamento</label>
                <SelectMenu
                  value={method}
                  onChange={(v) => {
                    const m = v as EditMethod;
                    setMethod(m);
                    if (m === 'MIXED' && splits.length === 0) {
                      setSplits([
                        { method: 'PIX', amount: null },
                        { method: 'CASH', amount: null },
                      ]);
                    }
                  }}
                  options={EDIT_METHODS.map((m) => ({
                    value: m,
                    label: PAYMENT_METHOD_LABELS[m],
                  }))}
                />
              </div>
              {method === 'CREDIT_CARD' && (
                <div className="flex-1 space-y-1.5">
                  <label className="text-xs text-lumine-warm-gray">Parcelas</label>
                  <SelectMenu
                    value={String(installments)}
                    onChange={(v) => setInstallments(Number(v))}
                    options={Array.from({ length: 12 }, (_, i) => i + 1).map((n) => ({
                      value: String(n),
                      label: `${n}x`,
                    }))}
                  />
                </div>
              )}
            </div>

            {method === 'MIXED' && (
              <div className="space-y-2 rounded-xl border border-lumine-lavender-pale p-3">
                {splits.map((s, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <SelectMenu
                        value={s.method}
                        onChange={(v) =>
                          setSplits((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, method: v as SplitLinha['method'] } : x
                            )
                          )
                        }
                        options={SPLIT_METHODS.map((m) => ({
                          value: m,
                          label: PAYMENT_METHOD_LABELS[m],
                        }))}
                      />
                    </div>
                    <div className="w-28">
                      <MoneyInput
                        value={s.amount}
                        onValueChange={(v) =>
                          setSplits((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, amount: v } : x))
                          )
                        }
                        placeholder="0,00"
                        className="h-9 text-sm"
                      />
                    </div>
                    <Button
                      size="icon" variant="ghost"
                      className="h-9 w-9 hover:text-lumine-danger"
                      onClick={() => setSplits((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm" variant="outline"
                  onClick={() =>
                    setSplits((prev) => [
                      ...prev,
                      { method: 'CASH', amount: Math.max(0, Math.round((total - somaSplit) * 100) / 100) || null },
                    ])
                  }
                >
                  <Plus size={13} className="mr-1" /> Adicionar forma
                </Button>
                {!splitOk && (
                  <p className="text-xs text-lumine-danger">
                    A soma das formas ({formatCurrency(somaSplit)}) precisa fechar com o
                    total ({formatCurrency(total)}).
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <div className="flex-1 space-y-1.5">
                <label className="text-xs text-lumine-warm-gray">Desconto (R$)</label>
                <MoneyInput
                  value={discount}
                  onValueChange={setDiscount}
                  placeholder="0,00"
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-xs text-lumine-warm-gray">Observação</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Motivo — vai para a auditoria */}
            <div className="space-y-1.5">
              <label className="text-xs text-lumine-warm-gray">
                Motivo da alteração <span className="text-lumine-danger">*</span>
              </label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: cliente trocou o tamanho 38 pelo 40"
                className="h-9 text-sm"
              />
            </div>

            <div className="rounded-xl bg-lumine-lavender-pale/40 p-3 space-y-1 text-sm">
              <div className="flex justify-between text-lumine-warm-gray">
                <span>Total antes</span>
                <span>{formatCurrency(Number(sale.total))}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-lumine-sage-dark">Total depois</span>
                <span className="text-lumine-gold">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="px-5 py-3 border-t border-lumine-lavender-pale flex gap-2 justify-end shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          {!temCrediario && (
            <Button
              size="sm"
              onClick={() => mutation.mutate()}
              disabled={!podeSalvar || mutation.isPending}
            >
              {mutation.isPending && <Loader2 size={14} className="animate-spin mr-2" />}
              Salvar alteração
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
