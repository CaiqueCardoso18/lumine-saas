'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Minus, Trash2, Loader2, ShoppingCart, Pencil, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { usePermission } from '@/hooks/usePermission';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import { Product } from '@/types';
import { toast } from '@/hooks/use-toast';
import { CustomerPicker, CustomerOption } from './CustomerPicker';
import {
  PaymentPanel, PaymentMethod, SplitPayment, DiscountMode,
} from './PaymentPanel';

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Data de hoje + 30 dias, no formato aceito pelo input date. */
function defaultFirstDue(): string {
  const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export function NewSaleDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { isOwner } = usePermission();

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [installments, setInstallments] = useState(1);
  const [payments, setPayments] = useState<SplitPayment[]>([]);
  const [discountMode, setDiscountMode] = useState<DiscountMode>('value');
  const [discountValue, setDiscountValue] = useState<number | null>(null);
  const [crediarioCount, setCrediarioCount] = useState(1);
  const [crediarioFirstDue, setCrediarioFirstDue] = useState(defaultFirstDue);
  const [notes, setNotes] = useState('');
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  // No celular a tela não cabe lado a lado, então alterna entre buscar e fechar
  const [mobileView, setMobileView] = useState<'products' | 'cart'>('products');

  const { data: searchResult } = useQuery({
    queryKey: ['products', 'search', search],
    queryFn: () =>
      api.paginated<Product>(
        `/api/products?search=${encodeURIComponent(search)}&status=ACTIVE&limit=20`
      ),
    enabled: search.length >= 2,
    staleTime: 30 * 1000,
  });

  const searchProducts = searchResult?.data ?? [];

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        { product, quantity: 1, unitPrice: Number(product.salePrice), discount: 0 },
      ];
    });
    setSearch('');
  }, []);

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }

  function setUnitPrice(productId: string, price: number | null) {
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === productId ? { ...i, unitPrice: Math.max(0, price ?? 0) } : i
      )
    );
  }

  // ─── Totais ────────────────────────────────────────────────

  const subtotal = cart.reduce((acc, i) => acc + i.unitPrice * i.quantity - i.discount, 0);

  const discountAmount = useMemo(() => {
    const v = discountValue ?? 0;
    if (v <= 0) return 0;
    if (discountMode === 'percent') {
      return Math.round(subtotal * (Math.min(v, 100) / 100) * 100) / 100;
    }
    return Math.min(v, subtotal);
  }, [discountValue, discountMode, subtotal]);

  const total = Math.max(0, subtotal - discountAmount);

  // Quanto vai para o crediário: venda inteira ou só a parte do misto
  const crediarioAmount = useMemo(() => {
    if (paymentMethod === 'CREDIARIO') return total;
    if (paymentMethod === 'MIXED') {
      return payments
        .filter((p) => p.method === 'CREDIARIO')
        .reduce((acc, p) => acc + (p.amount ?? 0), 0);
    }
    return 0;
  }, [paymentMethod, payments, total]);

  const precisaCliente = crediarioAmount > 0;

  const splitSum = payments.reduce((acc, p) => acc + (p.amount ?? 0), 0);
  const splitOk =
    paymentMethod !== 'MIXED' ||
    (payments.length >= 2 && Math.abs(splitSum - total) < 0.005);

  const podeFinalizar =
    cart.length > 0 && splitOk && (!precisaCliente || !!customer) && total >= 0;

  // ─── Envio ─────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/api/sales', {
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount,
        })),
        paymentMethod,
        installments: paymentMethod === 'CREDIT_CARD' ? installments : 1,
        ...(paymentMethod === 'MIXED' && {
          payments: payments.map((p) => ({
            method: p.method,
            amount: p.amount ?? 0,
            ...(p.installments && { installments: p.installments }),
          })),
        }),
        ...(discountMode === 'percent'
          ? { discountPercent: discountValue ?? 0, discountAmount: 0 }
          : { discountAmount }),
        ...(customer && { customerId: customer.id }),
        ...(crediarioAmount > 0 && {
          crediarioCount,
          crediarioFirstDueDate: crediarioFirstDue,
        }),
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['crediario'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Venda registrada com sucesso!' });
      resetForm();
      onOpenChange(false);
    },
    onError: (err) => {
      toast({
        title: 'Erro ao registrar venda',
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      });
    },
  });

  function resetForm() {
    setCart([]);
    setCustomer(null);
    setDiscountValue(null);
    setDiscountMode('value');
    setNotes('');
    setPaymentMethod('PIX');
    setInstallments(1);
    setPayments([]);
    setCrediarioCount(1);
    setCrediarioFirstDue(defaultFirstDue());
    setMobileView('products');
  }

  if (!open) return null;

  const cartCount = cart.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Full-screen no celular; card centralizado no desktop */}
      <div className="relative bg-white w-full sm:max-w-4xl sm:rounded-2xl shadow-xl flex flex-col h-full sm:h-[90vh] overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-lumine-lavender-pale shrink-0">
          <h2 className="font-heading text-lg sm:text-xl text-lumine-sage-dark">Nova Venda</h2>
          <button
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            className="text-lumine-warm-gray hover:text-lumine-danger transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Alternador mobile */}
        <div className="flex sm:hidden border-b border-lumine-lavender-pale shrink-0">
          <button
            onClick={() => setMobileView('products')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              mobileView === 'products'
                ? 'text-lumine-sage-dark border-b-2 border-lumine-lavender'
                : 'text-lumine-warm-gray'
            }`}
          >
            Produtos
          </button>
          <button
            onClick={() => setMobileView('cart')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              mobileView === 'cart'
                ? 'text-lumine-sage-dark border-b-2 border-lumine-lavender'
                : 'text-lumine-warm-gray'
            }`}
          >
            Carrinho{cartCount > 0 && ` (${cartCount})`}
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Busca de produtos */}
          <div
            className={`flex-1 flex-col border-r border-lumine-lavender-pale overflow-hidden ${
              mobileView === 'products' ? 'flex' : 'hidden'
            } sm:flex`}
          >
            <div className="p-3 sm:p-4 border-b border-lumine-lavender-pale shrink-0">
              <div className="relative">
                <Search
                  size={16}
                  strokeWidth={1.5}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-lumine-warm-gray"
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome, SKU, cor, tamanho..."
                  className="pl-9"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {search.length >= 2 && searchProducts.length > 0 && (
                <div className="space-y-1">
                  {searchProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-lumine-lavender-pale/50 transition-colors text-left group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-lumine-lavender-pale flex items-center justify-center shrink-0">
                        <ShoppingCart size={15} strokeWidth={1.5} className="text-lumine-lavender" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-lumine-charcoal truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-lumine-warm-gray truncate">
                          {product.sku}
                          {product.size && ` · ${product.size}`}
                          {product.color && ` · ${product.color}`}
                          {product.audience === 'INFANTIL' && ' · Infantil'}
                          {' · '}
                          <span className={product.quantity <= 0 ? 'text-lumine-danger font-medium' : ''}>
                            {product.quantity <= 0 ? 'Sem estoque' : `Estoque: ${product.quantity}`}
                          </span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-lumine-gold">
                          {formatCurrency(product.salePrice)}
                        </p>
                        <Plus
                          size={14}
                          className="text-lumine-lavender ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {search.length >= 2 && searchProducts.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-lumine-warm-gray">Nenhum produto encontrado</p>
                  <p className="text-xs text-lumine-warm-gray mt-1">
                    Tente menos termos, ou confira se o produto está ativo
                  </p>
                </div>
              )}

              {search.length < 2 && (
                <div className="text-center py-8 opacity-70">
                  <p className="text-sm text-lumine-warm-gray">Digite para buscar produtos...</p>
                  <p className="text-xs text-lumine-warm-gray mt-1">
                    Pode combinar termos: &quot;sapatilha rosa 38&quot;
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Carrinho e pagamento */}
          <div
            className={`w-full sm:w-96 flex-col overflow-hidden ${
              mobileView === 'cart' ? 'flex' : 'hidden'
            } sm:flex`}
          >
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-lumine-warm-gray py-10">
                  <ShoppingCart size={28} strokeWidth={1} className="mb-2 opacity-50" />
                  <p className="text-sm">Carrinho vazio</p>
                </div>
              ) : (
                <AnimatePresence>
                  {cart.map((item) => (
                    <motion.div
                      key={item.product.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="bg-lumine-lavender-pale/30 rounded-xl p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-lumine-charcoal leading-tight flex-1">
                          {item.product.name}
                        </p>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          aria-label="Remover item"
                          className="text-lumine-warm-gray hover:text-lumine-danger transition-colors shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.product.id, -1)}
                            aria-label="Diminuir"
                            className="w-7 h-7 rounded-full border border-lumine-lavender-pale bg-white flex items-center justify-center hover:bg-lumine-lavender-pale transition-colors"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product.id, 1)}
                            disabled={item.quantity >= item.product.quantity}
                            aria-label="Aumentar"
                            className="w-7 h-7 rounded-full border border-lumine-lavender-pale bg-white flex items-center justify-center hover:bg-lumine-lavender-pale transition-colors disabled:opacity-40"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                        <span className="text-sm font-semibold text-lumine-gold">
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </span>
                      </div>

                      {/* Preço unitário — editável apenas para OWNER */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-lumine-lavender/30">
                        {isOwner && editingPrice === item.product.id ? (
                          <div className="flex items-center gap-1.5 w-full">
                            <span className="text-xs text-lumine-warm-gray">R$</span>
                            <MoneyInput
                              autoFocus
                              value={item.unitPrice}
                              onValueChange={(v) => setUnitPrice(item.product.id, v)}
                              onBlur={() => setEditingPrice(null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === 'Escape') setEditingPrice(null);
                              }}
                              className="h-7 text-xs flex-1"
                            />
                          </div>
                        ) : (
                          <>
                            <span className="text-xs text-lumine-warm-gray">
                              {formatCurrency(item.unitPrice)} un.
                              {item.unitPrice !== Number(item.product.salePrice) && (
                                <span className="text-lumine-danger ml-1.5">
                                  (tabela: {formatCurrency(Number(item.product.salePrice))})
                                </span>
                              )}
                            </span>
                            {isOwner && (
                              <button
                                onClick={() => setEditingPrice(item.product.id)}
                                className="text-xs text-lumine-lavender hover:text-lumine-sage transition-colors inline-flex items-center gap-1"
                              >
                                <Pencil size={11} />
                                Alterar
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Rodapé: cliente, pagamento e total */}
            <div className="p-3 sm:p-4 border-t border-lumine-lavender-pale space-y-3 shrink-0 max-h-[55vh] overflow-y-auto">
              <CustomerPicker value={customer} onChange={setCustomer} required={precisaCliente} />

              <PaymentPanel
                paymentMethod={paymentMethod}
                onPaymentMethodChange={(m) => {
                  setPaymentMethod(m);
                  // Ao entrar no misto já sugere duas linhas, que é o mínimo aceito
                  if (m === 'MIXED' && payments.length === 0) {
                    setPayments([
                      { method: 'PIX', amount: null },
                      { method: 'CASH', amount: null },
                    ]);
                  }
                }}
                installments={installments}
                onInstallmentsChange={setInstallments}
                payments={payments}
                onPaymentsChange={setPayments}
                discountMode={discountMode}
                onDiscountModeChange={(m) => { setDiscountMode(m); setDiscountValue(null); }}
                discountValue={discountValue}
                onDiscountValueChange={setDiscountValue}
                crediarioCount={crediarioCount}
                onCrediarioCountChange={setCrediarioCount}
                crediarioFirstDue={crediarioFirstDue}
                onCrediarioFirstDueChange={setCrediarioFirstDue}
                subtotal={subtotal}
                discountAmount={discountAmount}
                total={total}
                crediarioAmount={crediarioAmount}
                notes={notes}
                onNotesChange={setNotes}
              />

              <div className="pt-1 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-lumine-warm-gray">Subtotal</span>
                  <span className="text-sm">{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-lumine-danger">
                    <span className="text-sm">
                      Desconto{discountMode === 'percent' && discountValue ? ` (${discountValue}%)` : ''}
                    </span>
                    <span className="text-sm">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-lumine-sage-dark">Total</span>
                  <span className="font-heading font-bold text-xl text-lumine-gold">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={!podeFinalizar || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending && <Loader2 size={16} className="animate-spin mr-2" />}
                Finalizar Venda
              </Button>

              {!podeFinalizar && cart.length > 0 && (
                <p className="text-xs text-lumine-danger text-center">
                  {precisaCliente && !customer
                    ? 'Escolha o cliente para vender no crediário'
                    : !splitOk
                      ? 'A soma das formas de pagamento precisa fechar com o total'
                      : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
