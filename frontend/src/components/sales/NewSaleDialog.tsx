'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Minus, Trash2, Loader2, ShoppingCart, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectMenu } from '@/components/ui/select-menu';
import { usePermission } from '@/hooks/usePermission';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatCurrency, PAYMENT_METHOD_LABELS } from '@/lib/formatters';
import { Product } from '@/types';
import { toast } from '@/hooks/use-toast';

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
}

type PaymentMethod = 'CASH' | 'PIX' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'MIXED';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewSaleDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { isOwner } = usePermission();
  const [search, setSearch] = useState('');
  // Só OWNER pode vender por valor diferente do cadastrado — o backend
  // rejeita a venda se um EMPLOYEE mandar unitPrice divergente.
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [installments, setInstallments] = useState(1);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState('');

  const { data: searchResult } = useQuery({
    queryKey: ['products', 'search', search],
    queryFn: () => api.paginated<Product>(`/api/products?search=${encodeURIComponent(search)}&status=ACTIVE&limit=20`),
    enabled: search.length >= 2,
    staleTime: 30 * 1000,
  });

  const searchProducts = searchResult?.data ?? [];

  function setUnitPrice(productId: string, price: number) {
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === productId ? { ...i, unitPrice: Math.max(0, price) } : i
      )
    );
  }

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { product, quantity: 1, unitPrice: Number(product.salePrice), discount: 0 }];
    });
    setSearch('');
  }, []);

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => i.product.id === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)
        .filter((i) => i.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const subtotal = cart.reduce((acc, i) => acc + i.unitPrice * i.quantity - i.discount, 0);
  const total = Math.max(0, subtotal - discountAmount);

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
        discountAmount,
        notes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      toast({ title: 'Venda registrada com sucesso!' });
      setCart([]);
      setDiscountAmount(0);
      setNotes('');
      setPaymentMethod('PIX');
      setInstallments(1);
      onOpenChange(false);
    },
    onError: (err) => {
      toast({ title: 'Erro ao registrar venda', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-lumine-lavender-pale shrink-0">
          <h2 className="font-heading text-xl text-lumine-sage-dark">Nova Venda</h2>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Product search */}
          <div className="flex-1 flex flex-col border-r border-lumine-lavender-pale overflow-hidden">
            <div className="p-4 border-b border-lumine-lavender-pale">
              <div className="relative">
                <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-lumine-warm-gray" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome, SKU, cor, tamanho, marca..."
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
                        <p className="text-sm font-medium text-lumine-charcoal truncate">{product.name}</p>
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
                        <p className="text-sm font-semibold text-lumine-gold">{formatCurrency(product.salePrice)}</p>
                        <Plus size={14} className="text-lumine-lavender ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
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

          {/* Right: Cart */}
          <div className="w-80 flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-lumine-warm-gray">
                  <ShoppingCart size={32} strokeWidth={1} className="opacity-30 mb-2" />
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
                        <button onClick={() => removeFromCart(item.product.id)} className="text-lumine-warm-gray hover:text-lumine-danger transition-colors shrink-0">
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="w-6 h-6 rounded-full border border-lumine-lavender-pale bg-white flex items-center justify-center hover:bg-lumine-lavender-pale transition-colors"
                          >
                            <Minus size={10} />
                          </button>
                          <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product.id, 1)}
                            disabled={item.quantity >= item.product.quantity}
                            className="w-6 h-6 rounded-full border border-lumine-lavender-pale bg-white flex items-center justify-center hover:bg-lumine-lavender-pale transition-colors disabled:opacity-40"
                          >
                            <Plus size={10} />
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
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              autoFocus
                              value={item.unitPrice}
                              onChange={(e) => setUnitPrice(item.product.id, Number(e.target.value))}
                              onBlur={() => setEditingPrice(null)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingPrice(null); }}
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

            {/* Footer */}
            <div className="p-4 border-t border-lumine-lavender-pale space-y-3 shrink-0">
              <div className="space-y-1.5">
                <Label className="text-xs">Forma de pagamento</Label>
                <SelectMenu
                  value={paymentMethod}
                  onChange={(v) => setPaymentMethod(v as PaymentMethod)}
                  dropUp
                  options={Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </div>

              {paymentMethod === 'CREDIT_CARD' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Parcelas</Label>
                  <SelectMenu
                    value={String(installments)}
                    onChange={(v) => setInstallments(Number(v))}
                    dropUp
                    options={Array.from({ length: 12 }, (_, i) => i + 1).map((n) => ({
                      value: String(n),
                      label: n > 1 ? `${n}x` : '1x (à vista)',
                      hint: n > 1 ? `de ${formatCurrency(total / n)}` : undefined,
                    }))}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Desconto (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discountAmount || ''}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  placeholder="0,00"
                  className="h-9 text-sm"
                />
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-sm text-lumine-warm-gray">Subtotal</span>
                <span className="text-sm">{formatCurrency(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between items-center text-lumine-danger">
                  <span className="text-sm">Desconto</span>
                  <span className="text-sm">-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="font-semibold text-lumine-sage-dark">Total</span>
                <span className="font-heading font-bold text-xl text-lumine-gold">{formatCurrency(total)}</span>
              </div>

              <Button
                className="w-full"
                disabled={cart.length === 0 || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                Finalizar Venda
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
