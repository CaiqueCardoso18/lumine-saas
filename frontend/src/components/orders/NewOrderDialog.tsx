'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Trash2, Printer, Loader2, X, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import { Product, Supplier } from '@/types';
import { toast } from '@/hooks/use-toast';

interface OrderItem {
  product: Product;
  quantityOrdered: number;
  unitCost: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewOrderDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [savedOrderId, setSavedOrderId] = useState<string | null>(null);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get<Supplier[]>('/api/settings/suppliers'),
    enabled: open,
  });

  const { data: productsData } = useQuery({
    queryKey: ['product-search', search],
    queryFn: () => api.paginated<Product>(`/api/products?search=${search}&limit=8`),
    enabled: open && search.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<{ id: string; orderNumber: number }>('/api/orders', {
        supplierId: supplierId || null,
        notes: notes || null,
        items: items.map((i) => ({
          productId: i.product.id,
          quantityOrdered: i.quantityOrdered,
          unitCost: i.unitCost,
        })),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      setSavedOrderId(res.data.id);
      toast({ title: `Pedido #${res.data.orderNumber} criado!` });
    },
    onError: (err) => {
      toast({ title: 'Erro ao criar pedido', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    },
  });

  const createSupplierMutation = useMutation({
    mutationFn: () =>
      api.post<Supplier>('/api/settings/suppliers', {
        name: newSupplierName,
        phone: newSupplierPhone || null,
        email: newSupplierEmail || null,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      setSupplierId(res.data.id);
      setShowNewSupplier(false);
      setNewSupplierName('');
      setNewSupplierPhone('');
      setNewSupplierEmail('');
      toast({ title: `Fornecedor "${res.data.name}" criado!` });
    },
    onError: (err) => {
      toast({ title: 'Erro ao criar fornecedor', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    },
  });

  const suppliers = suppliersData?.data ?? [];
  const searchResults = productsData?.data ?? [];
  const total = items.reduce((sum, i) => sum + i.quantityOrdered * i.unitCost, 0);

  function addProduct(product: Product) {
    setItems((prev) => {
      const exists = prev.find((i) => i.product.id === product.id);
      if (exists) return prev;
      return [...prev, { product, quantityOrdered: 1, unitCost: Number(product.costPrice) || 0 }];
    });
    setSearch('');
  }

  function updateItem(productId: string, field: 'quantityOrdered' | 'unitCost', value: number) {
    setItems((prev) => prev.map((i) =>
      i.product.id === productId ? { ...i, [field]: value } : i
    ));
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }

  function handleClose() {
    setItems([]);
    setSupplierId('');
    setNotes('');
    setSearch('');
    setSavedOrderId(null);
    setShowNewSupplier(false);
    setNewSupplierName('');
    setNewSupplierPhone('');
    setNewSupplierEmail('');
    onOpenChange(false);
  }

  function printOrder() {
    const supplier = suppliers.find((s) => s.id === supplierId);
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Pedido de Reposição — Lumine</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #3D3935; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
          .brand { font-size: 24px; font-weight: 700; color: #B8A9C9; letter-spacing: 1px; }
          .brand span { display: block; font-size: 11px; font-weight: 400; color: #8B8680; margin-top: 2px; letter-spacing: 0; }
          .meta { text-align: right; font-size: 12px; color: #8B8680; line-height: 1.8; }
          .meta strong { color: #3D3935; }
          h2 { font-size: 16px; color: #4A5750; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #EDE7F4; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
          .info-box { background: #FAF8F5; border: 1px solid #EDE7F4; border-radius: 8px; padding: 16px; }
          .info-box label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #8B8680; display: block; margin-bottom: 4px; }
          .info-box p { font-size: 14px; color: #3D3935; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background: #EDE7F4; padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #5C6B63; }
          td { padding: 12px 14px; border-bottom: 1px solid #EDE7F4; font-size: 13px; }
          tr:last-child td { border-bottom: none; }
          .text-right { text-align: right; }
          .total-row { background: #FAF8F5; font-weight: 600; }
          .total-row td { font-size: 14px; color: #3D3935; padding: 14px; }
          .notes { background: #FAF8F5; border: 1px solid #EDE7F4; border-radius: 8px; padding: 16px; margin-bottom: 32px; }
          .footer { text-align: center; font-size: 11px; color: #8B8680; border-top: 1px solid #EDE7F4; padding-top: 20px; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin: 32px 0; }
          .sig-line { border-top: 1px solid #3D3935; padding-top: 8px; font-size: 12px; text-align: center; color: #8B8680; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">Lumine<span>Sistema de Gestão — Pedido de Reposição</span></div>
          <div class="meta">
            <strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}<br/>
            <strong>Hora:</strong> ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}<br/>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <label>Fornecedor</label>
            <p>${supplier?.name ?? 'Não informado'}</p>
            ${supplier?.phone ? `<p style="font-size:12px;color:#8B8680;margin-top:4px;">${supplier.phone}</p>` : ''}
            ${supplier?.email ? `<p style="font-size:12px;color:#8B8680;">${supplier.email}</p>` : ''}
          </div>
          <div class="info-box">
            <label>Status do Pedido</label>
            <p>Rascunho (DRAFT)</p>
          </div>
        </div>

        <h2>Itens do Pedido</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Produto</th>
              <th>SKU</th>
              <th class="text-right">Qtd. Pedida</th>
              <th class="text-right">Custo Unit.</th>
              <th class="text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${item.product.name}</td>
                <td style="color:#8B8680;font-size:12px;">${item.product.sku}</td>
                <td class="text-right">${item.quantityOrdered}</td>
                <td class="text-right">${formatCurrency(item.unitCost)}</td>
                <td class="text-right">${formatCurrency(item.quantityOrdered * item.unitCost)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="5" class="text-right">Total do Pedido</td>
              <td class="text-right">${formatCurrency(total)}</td>
            </tr>
          </tbody>
        </table>

        ${notes ? `
        <div class="notes">
          <label style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#8B8680;display:block;margin-bottom:6px;">Observações</label>
          <p style="font-size:13px;">${notes}</p>
        </div>` : ''}

        <div class="signatures">
          <div class="sig-line">Solicitante</div>
          <div class="sig-line">Fornecedor / Responsável</div>
        </div>

        <div class="footer">
          Lumine — Sistema de Gestão · Gerado em ${new Date().toLocaleString('pt-BR')}
        </div>

        <script>window.onload = () => { window.print(); }</script>
      </body>
      </html>
    `);
    win.document.close();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={handleClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-lumine-lavender-pale shrink-0">
          <h2 className="font-heading text-xl text-lumine-sage-dark">Novo Pedido de Reposição</h2>
          <button onClick={handleClose} className="text-lumine-warm-gray hover:text-lumine-charcoal">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Fornecedor + Obs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Fornecedor</Label>
                <button
                  type="button"
                  onClick={() => setShowNewSupplier((v) => !v)}
                  className="flex items-center gap-1 text-xs text-lumine-lavender hover:text-lumine-sage transition-colors"
                >
                  <UserPlus size={13} />
                  {showNewSupplier ? 'Cancelar' : 'Novo fornecedor'}
                </button>
              </div>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-lumine-lavender-pale bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumine-lavender"
              >
                <option value="">Sem fornecedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              {/* Mini-form inline de novo fornecedor */}
              <AnimatePresence>
                {showNewSupplier && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border border-lumine-lavender rounded-xl p-3 space-y-2 bg-lumine-lavender-pale/20 mt-1">
                      <p className="text-xs font-medium text-lumine-sage">Cadastrar novo fornecedor</p>
                      <Input
                        placeholder="Nome *"
                        value={newSupplierName}
                        onChange={(e) => setNewSupplierName(e.target.value)}
                        className="h-8 text-sm"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Telefone"
                          value={newSupplierPhone}
                          onChange={(e) => setNewSupplierPhone(e.target.value)}
                          className="h-8 text-sm"
                        />
                        <Input
                          placeholder="Email"
                          type="email"
                          value={newSupplierEmail}
                          onChange={(e) => setNewSupplierEmail(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <Button
                        size="sm"
                        className="w-full h-8 text-xs"
                        disabled={!newSupplierName.trim() || createSupplierMutation.isPending}
                        onClick={() => createSupplierMutation.mutate()}
                      >
                        {createSupplierMutation.isPending
                          ? <Loader2 size={12} className="mr-1 animate-spin" />
                          : <Plus size={12} className="mr-1" />
                        }
                        Salvar Fornecedor
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Input
                placeholder="Observações do pedido..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Busca de produto */}
          <div className="space-y-1.5">
            <Label>Adicionar Produto</Label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-lumine-warm-gray" />
              <Input
                placeholder="Digite o nome ou SKU do produto..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <AnimatePresence>
              {searchResults.length > 0 && search.length >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="border border-lumine-lavender-pale rounded-xl overflow-hidden shadow-md bg-white"
                >
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addProduct(p)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-lumine-lavender-pale/40 transition-colors text-left border-b border-lumine-lavender-pale last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-lumine-charcoal truncate">{p.name}</p>
                        <p className="text-xs text-lumine-warm-gray">{p.sku} · Estoque: {p.quantity}</p>
                      </div>
                      <Plus size={14} className="text-lumine-lavender shrink-0" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Itens do pedido */}
          {items.length > 0 && (
            <div className="space-y-2">
              <Label>Itens do Pedido ({items.length})</Label>
              <div className="border border-lumine-lavender-pale rounded-xl overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-lumine-cream/70 text-xs text-lumine-warm-gray uppercase tracking-wide border-b border-lumine-lavender-pale">
                  <span className="col-span-5">Produto</span>
                  <span className="col-span-3 text-center">Quantidade</span>
                  <span className="col-span-3 text-center">Custo Unit.</span>
                  <span className="col-span-1" />
                </div>
                {items.map((item) => (
                  <div key={item.product.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-lumine-lavender-pale last:border-0">
                    <div className="col-span-5 min-w-0">
                      <p className="text-sm font-medium text-lumine-charcoal truncate">{item.product.name}</p>
                      <p className="text-xs text-lumine-warm-gray">{item.product.sku}</p>
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantityOrdered}
                        onChange={(e) => updateItem(item.product.id, 'quantityOrdered', Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-8 text-sm text-center"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitCost}
                        onChange={(e) => updateItem(item.product.id, 'unitCost', parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm text-center"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={() => removeItem(item.product.id)}
                        className="text-lumine-warm-gray hover:text-lumine-danger transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {/* Total */}
                <div className="flex items-center justify-between px-4 py-3 bg-lumine-lavender-pale/30">
                  <span className="text-sm font-medium text-lumine-sage">Total do Pedido</span>
                  <span className="font-heading font-semibold text-lumine-gold">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          )}

          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-lumine-warm-gray border-2 border-dashed border-lumine-lavender-pale rounded-xl">
              <p className="text-sm">Nenhum produto adicionado</p>
              <p className="text-xs mt-1">Busque acima para adicionar itens ao pedido</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-lumine-lavender-pale shrink-0 gap-3">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <div className="flex gap-2">
            {(savedOrderId || items.length > 0) && (
              <Button variant="outline" onClick={printOrder}>
                <Printer size={15} className="mr-2" />
                Gerar PDF
              </Button>
            )}
            <Button
              onClick={() => createMutation.mutate()}
              disabled={items.length === 0 || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 size={15} className="mr-2 animate-spin" />}
              {savedOrderId ? 'Pedido Salvo ✓' : 'Salvar Pedido'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
