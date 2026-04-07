'use client';

import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Download, Edit, Trash2, AlertTriangle, Package,
  CheckSquare, Square, X, Tag, BarChart2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import { Product } from '@/types';
import { toast } from '@/hooks/use-toast';
import { ProductFormDialog } from '@/components/products/ProductFormDialog';
import { usePermission } from '@/hooks/usePermission';

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  ACTIVE: 'success',
  INACTIVE: 'warning',
  DISCONTINUED: 'danger',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  DISCONTINUED: 'Descontinuado',
};

function ProductsPageContent() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();

  const { can } = usePermission();
  const canManage = can('manage_products');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkStock, setBulkStock] = useState('');

  // Abrir dialog ao vir do dashboard via ?new=true
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setEditProduct(null);
      setDialogOpen(true);
    }
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      return api.paginated<Product>(`/api/products?${params}`);
    },
    placeholderData: (prev) => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Produto removido', variant: 'default' });
    },
    onError: () => toast({ title: 'Erro ao remover produto', variant: 'destructive' }),
  });

  const bulkMutation = useMutation({
    mutationFn: (updates: { salePrice?: number; quantity?: number }) =>
      api.patch('/api/products/bulk', { productIds: Array.from(selectedIds), updates }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setSelectedIds(new Set());
      setBulkOpen(false);
      setBulkPrice('');
      setBulkStock('');
      toast({ title: `${selectedIds.size} produto(s) atualizados!` });
    },
    onError: () => toast({ title: 'Erro ao atualizar produtos', variant: 'destructive' }),
  });

  const products = data?.data ?? [];
  const meta = data?.meta;
  const allSelected = products.length > 0 && products.every((p) => selectedIds.has(p.id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyBulk() {
    const updates: { salePrice?: number; quantity?: number } = {};
    if (bulkPrice) updates.salePrice = parseFloat(bulkPrice);
    if (bulkStock) updates.quantity = parseInt(bulkStock);
    if (!updates.salePrice && !updates.quantity) {
      toast({ title: 'Informe preço ou estoque para atualizar', variant: 'destructive' });
      return;
    }
    bulkMutation.mutate(updates);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-lumine-warm-gray" />
          <Input
            placeholder="Buscar por nome, SKU..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/products/template`, '_blank')}
          >
            <Download size={14} className="mr-2" />
            Template
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => { setEditProduct(null); setDialogOpen(true); }}>
              <Plus size={14} className="mr-2" />
              Novo Produto
            </Button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && canManage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-wrap items-center gap-3 p-4 bg-lumine-lavender-pale rounded-xl border border-lumine-lavender"
          >
            <span className="text-sm font-medium text-lumine-sage-dark">
              {selectedIds.size} produto(s) selecionado(s)
            </span>
            <div className="flex gap-2 ml-auto flex-wrap">
              {bulkOpen ? (
                <>
                  <Input
                    placeholder="Novo preço (R$)"
                    className="w-36 h-8 text-sm"
                    type="number"
                    step="0.01"
                    value={bulkPrice}
                    onChange={(e) => setBulkPrice(e.target.value)}
                  />
                  <Input
                    placeholder="Nova qtd"
                    className="w-28 h-8 text-sm"
                    type="number"
                    value={bulkStock}
                    onChange={(e) => setBulkStock(e.target.value)}
                  />
                  <Button size="sm" onClick={applyBulk} disabled={bulkMutation.isPending}>
                    Aplicar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setBulkOpen(false)}>
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
                    <Tag size={14} className="mr-2" />
                    Alterar Preço/Estoque
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    <X size={14} className="mr-1" />
                    Limpar seleção
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between text-sm text-lumine-warm-gray">
            <span>{meta?.total ?? 0} produtos encontrados</span>
            {meta && meta.totalPages > 1 && (
              <span>Página {meta.page} de {meta.totalPages}</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Header row */}
          {products.length > 0 && (
            <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 border-b border-lumine-lavender-pale bg-lumine-cream/50">
              {canManage && (
                <button onClick={toggleAll} className="text-lumine-warm-gray hover:text-lumine-lavender transition-colors shrink-0">
                  {allSelected
                    ? <CheckSquare size={16} className="text-lumine-lavender" />
                    : <Square size={16} />
                  }
                </button>
              )}
              <span className="text-xs text-lumine-warm-gray uppercase tracking-wide flex-1">Produto</span>
              <span className="text-xs text-lumine-warm-gray uppercase tracking-wide hidden sm:block w-16 text-center">Estoque</span>
              <span className="text-xs text-lumine-warm-gray uppercase tracking-wide hidden md:block w-28 text-right">Preço</span>
              <span className="w-16" />
            </div>
          )}

          {isLoading ? (
            <div className="divide-y divide-lumine-lavender-pale">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                  <div className="w-4 h-4 bg-lumine-lavender-pale rounded" />
                  <div className="w-10 h-10 bg-lumine-lavender-pale rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-lumine-lavender-pale rounded w-1/3" />
                    <div className="h-3 bg-lumine-lavender-pale rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-lumine-warm-gray">
              <Package size={40} strokeWidth={1} className="mb-3 opacity-40" />
              <p className="text-sm">Nenhum produto encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-lumine-lavender-pale">
              {products.map((product) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-4 transition-colors group ${
                    selectedIds.has(product.id)
                      ? 'bg-lumine-lavender-pale/40'
                      : 'hover:bg-lumine-lavender-pale/20'
                  }`}
                >
                  {/* Checkbox */}
                  {canManage && (
                    <button
                      onClick={() => toggleOne(product.id)}
                      className="text-lumine-warm-gray hover:text-lumine-lavender transition-colors shrink-0"
                    >
                      {selectedIds.has(product.id)
                        ? <CheckSquare size={16} className="text-lumine-lavender" />
                        : <Square size={16} />
                      }
                    </button>
                  )}

                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-lumine-lavender-pale flex items-center justify-center shrink-0">
                    <Package size={18} strokeWidth={1.5} className="text-lumine-lavender" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-lumine-charcoal truncate">{product.name}</p>
                      <Badge variant={STATUS_BADGE[product.status]}>
                        {STATUS_LABELS[product.status]}
                      </Badge>
                      {product.quantity <= product.minStock && (
                        <AlertTriangle size={14} className="text-lumine-danger shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-lumine-warm-gray mt-0.5">
                      {product.sku} · {product.category.name}
                      {product.size && ` · ${product.size}`}
                      {product.color && ` · ${product.color}`}
                    </p>
                  </div>

                  {/* Stock */}
                  <div className="text-center hidden sm:block w-16">
                    <p className={`font-semibold text-sm ${product.quantity <= product.minStock ? 'text-lumine-danger' : 'text-lumine-charcoal'}`}>
                      {product.quantity}
                    </p>
                    <p className="text-xs text-lumine-warm-gray">estoque</p>
                  </div>

                  {/* Price */}
                  <div className="text-right hidden md:block w-28">
                    <p className="font-heading font-semibold text-lumine-gold">
                      {formatCurrency(product.salePrice)}
                    </p>
                    {can('view_cost_price') && (
                      <p className="text-xs text-lumine-warm-gray">
                        Custo: {formatCurrency(product.costPrice)}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {canManage && (
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity w-16 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setEditProduct(product); setDialogOpen(true); }}
                        className="h-8 w-8"
                      >
                        <Edit size={14} strokeWidth={1.5} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Remover "${product.name}"?`)) deleteMutation.mutate(product.id);
                        }}
                        className="h-8 w-8 hover:text-lumine-danger"
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                      </Button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <div className="flex justify-center gap-2 p-4 border-t border-lumine-lavender-pale">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Anterior</Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page === meta.totalPages}>Próxima</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ProductFormDialog open={dialogOpen} onOpenChange={setDialogOpen} product={editProduct} />
    </motion.div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsPageContent />
    </Suspense>
  );
}
