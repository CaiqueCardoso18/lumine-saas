'use client';

import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Download, Edit, Trash2, AlertTriangle, Package,
  CheckSquare, Square, X, Tag, BarChart2, SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import { downloadTemplate } from '@/lib/downloadTemplate';
import { Product } from '@/types';
import { toast } from '@/hooks/use-toast';
import { ProductFormDialog } from '@/components/products/ProductFormDialog';
import { FilterSelect, FilterChip, FilterOption } from '@/components/ui/filter-select';
import { BulkEditPanel } from '@/components/products/BulkEditPanel';
import { usePermission } from '@/hooks/usePermission';

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  ACTIVE: 'success',
  INACTIVE: 'warning',
  DISCONTINUED: 'danger',
};

const AUDIENCE_LABELS: Record<string, string> = {
  ADULTO: 'Adulto',
  INFANTIL: 'Infantil',
};

interface Facets {
  total: number;
  categories: Array<{ value: string; label: string; count: number }>;
  brands: Array<{ value: string; count: number }>;
  sizes: Array<{ value: string; count: number }>;
  colors: Array<{ value: string; count: number }>;
  audiences: Array<{ value: string; count: number }>;
  statuses: Array<{ value: string; count: number }>;
  priceRange: { min: number; max: number };
  lowStockCount: number;
}

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
  const [filters, setFilters] = useState({
    categoryId: '', brand: '', size: '', color: '',
    audience: '', status: '', lowStock: '',
  });
  const [page, setPage] = useState(1);

  function setFilter(key: keyof typeof filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters({ categoryId: '', brand: '', size: '', color: '', audience: '', status: '', lowStock: '' });
    setSearch('');
    setPage(1);
  }

  // Params compartilhados entre a listagem e os facets
  const filterParams = new URLSearchParams();
  if (search) filterParams.set('search', search);
  Object.entries(filters).forEach(([k, v]) => { if (v) filterParams.set(k, v); });
  const filterKey = filterParams.toString();

  const activeCount = Object.values(filters).filter(Boolean).length;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  // Abrir dialog ao vir do dashboard via ?new=true
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setEditProduct(null);
      setDialogOpen(true);
    }
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, filterKey],
    queryFn: () => {
      const params = new URLSearchParams(filterKey);
      params.set('page', String(page));
      params.set('limit', '20');
      return api.paginated<Product>(`/api/products?${params}`);
    },
    placeholderData: (prev) => prev,
  });

  // Facets: contagens por dimensão, recalculadas conforme os filtros ativos
  const { data: facetsData } = useQuery({
    queryKey: ['product-facets', filterKey],
    queryFn: () => api.get<Facets>(`/api/products/facets?${filterKey}`),
    placeholderData: (prev) => prev,
  });

  const facets = facetsData?.data;

  const asOptions = (
    rows: Array<{ value: string; count: number }> | undefined,
    labelMap?: Record<string, string>
  ): FilterOption[] =>
    (rows ?? []).map((r) => ({
      value: r.value,
      label: labelMap?.[r.value] ?? r.value,
      count: r.count,
    }));

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Produto removido', variant: 'default' });
    },
    onError: () => toast({ title: 'Erro ao remover produto', variant: 'destructive' }),
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Barra de busca e ações */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-lumine-warm-gray" />
          <Input
            placeholder="Buscar por nome, SKU, cor, tamanho, marca..."
            className="pl-9 pr-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setPage(1); }}
              aria-label="Limpar busca"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-lumine-warm-gray hover:text-lumine-sage transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
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

      {/* Filtros */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-lumine-warm-gray mr-1">
            <SlidersHorizontal size={13} />
            Filtros
          </span>

          <FilterSelect
            label="Categoria"
            placeholder="Todas"
            value={filters.categoryId}
            onChange={(v) => setFilter('categoryId', v)}
            options={(facets?.categories ?? []).map((c) => ({
              value: c.value, label: c.label, count: c.count,
            }))}
            searchable
          />
          <FilterSelect
            label="Marca"
            placeholder="Todas"
            value={filters.brand}
            onChange={(v) => setFilter('brand', v)}
            options={asOptions(facets?.brands)}
            searchable
          />
          <FilterSelect
            label="Tamanho"
            placeholder="Todos"
            value={filters.size}
            onChange={(v) => setFilter('size', v)}
            options={asOptions(facets?.sizes)}
            searchable
          />
          <FilterSelect
            label="Cor"
            placeholder="Todas"
            value={filters.color}
            onChange={(v) => setFilter('color', v)}
            options={asOptions(facets?.colors)}
            searchable
          />
          <FilterSelect
            label="Público"
            placeholder="Todos"
            value={filters.audience}
            onChange={(v) => setFilter('audience', v)}
            options={asOptions(facets?.audiences, AUDIENCE_LABELS)}
          />
          <FilterSelect
            label="Status"
            placeholder="Todos"
            value={filters.status}
            onChange={(v) => setFilter('status', v)}
            options={asOptions(facets?.statuses, STATUS_LABELS)}
          />

          <button
            type="button"
            onClick={() => setFilter('lowStock', filters.lowStock ? '' : 'true')}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-xl border text-sm transition-all whitespace-nowrap ${
              filters.lowStock
                ? 'border-lumine-danger bg-lumine-danger/10 text-lumine-danger ring-1 ring-lumine-danger/40'
                : 'border-lumine-lavender-pale bg-white text-lumine-warm-gray hover:border-lumine-lavender'
            }`}
          >
            <AlertTriangle size={13} />
            Estoque baixo
            {facets?.lowStockCount !== undefined && (
              <span className="text-xs tabular-nums opacity-70">{facets.lowStockCount}</span>
            )}
          </button>
        </div>

        {/* Chips dos filtros ativos */}
        {(activeCount > 0 || search) && (
          <div className="flex flex-wrap items-center gap-2">
            {search && (
              <FilterChip label="Busca" value={search} onRemove={() => { setSearch(''); setPage(1); }} />
            )}
            {filters.categoryId && (
              <FilterChip
                label="Categoria"
                value={facets?.categories.find((c) => c.value === filters.categoryId)?.label ?? '—'}
                onRemove={() => setFilter('categoryId', '')}
              />
            )}
            {filters.brand && (
              <FilterChip label="Marca" value={filters.brand} onRemove={() => setFilter('brand', '')} />
            )}
            {filters.size && (
              <FilterChip label="Tamanho" value={filters.size} onRemove={() => setFilter('size', '')} />
            )}
            {filters.color && (
              <FilterChip label="Cor" value={filters.color} onRemove={() => setFilter('color', '')} />
            )}
            {filters.audience && (
              <FilterChip
                label="Público"
                value={AUDIENCE_LABELS[filters.audience] ?? filters.audience}
                onRemove={() => setFilter('audience', '')}
              />
            )}
            {filters.status && (
              <FilterChip
                label="Status"
                value={STATUS_LABELS[filters.status] ?? filters.status}
                onRemove={() => setFilter('status', '')}
              />
            )}
            {filters.lowStock && (
              <FilterChip label="Estoque" value="Baixo" onRemove={() => setFilter('lowStock', '')} />
            )}

            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-lumine-warm-gray hover:text-lumine-danger underline underline-offset-2 transition-colors ml-1"
            >
              Limpar tudo
            </button>
          </div>
        )}
      </div>

      {/* Barra de seleção + painel de edição em massa */}
      <AnimatePresence>
        {selectedIds.size > 0 && canManage && !bulkOpen && (
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
              <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
                <Tag size={14} className="mr-2" />
                Editar em massa
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                <X size={14} className="mr-1" />
                Limpar seleção
              </Button>
            </div>
          </motion.div>
        )}

        {selectedIds.size > 0 && canManage && bulkOpen && (
          <BulkEditPanel
            key="bulk-panel"
            productIds={Array.from(selectedIds)}
            onClose={() => setBulkOpen(false)}
            onDone={() => { setBulkOpen(false); setSelectedIds(new Set()); }}
          />
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
                      {product.audience && (
                        <Badge variant="default">{AUDIENCE_LABELS[product.audience]}</Badge>
                      )}
                      {product.quantity <= product.minStock && (
                        <span
                          className="inline-flex items-center gap-1 shrink-0 text-lumine-danger"
                          title={
                            product.quantity === 0
                              ? 'Sem estoque'
                              : `Estoque baixo: ${product.quantity} em estoque, mínimo definido é ${product.minStock}`
                          }
                        >
                          <AlertTriangle size={14} />
                          <span className="text-xs whitespace-nowrap hidden sm:inline">
                            {product.quantity === 0 ? 'Sem estoque' : 'Estoque baixo'}
                          </span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-lumine-warm-gray mt-0.5">
                      {product.sku} · {product.category.name}
                      {product.size && ` · ${product.size}`}
                      {product.color && ` · ${product.color}`}
                      {product.audience && ` · ${AUDIENCE_LABELS[product.audience]}`}
                    </p>
                    {product.shortDescription && (
                      <p className="text-xs text-lumine-warm-gray/80 mt-0.5 truncate italic">
                        {product.shortDescription}
                      </p>
                    )}
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
