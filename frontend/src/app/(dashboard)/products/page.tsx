'use client';

import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Download, Edit, Trash2, AlertTriangle, Package,
  CheckSquare, Square, X, Tag, BarChart2, SlidersHorizontal, FileDown,
  ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import { downloadTemplate } from '@/lib/downloadTemplate';
import { exportProducts } from '@/lib/exportProducts';
import { Product } from '@/types';
import { toast } from '@/hooks/use-toast';
import { ProductFormDialog } from '@/components/products/ProductFormDialog';
import { FilterSelect, MultiFilterSelect, FilterChip, FilterOption } from '@/components/ui/filter-select';
import { PriceFilter, PriceBucket, PriceRange, describePriceRange } from '@/components/ui/price-filter';
import { BulkEditPanel } from '@/components/products/BulkEditPanel';
import { SortControl, SortState } from '@/components/ui/sort-control';
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
  priceBuckets: PriceBucket[];
  lowStockCount: number;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  DISCONTINUED: 'Descontinuado',
};

/** Dimensões que aceitam mais de um valor ao mesmo tempo. */
const MULTI_KEYS = ['categoryId', 'brand', 'size', 'color', 'audience', 'status'] as const;
type MultiKey = (typeof MULTI_KEYS)[number];

type SortKey =
  | 'name' | 'sku' | 'salePrice' | 'costPrice' | 'quantity' | 'size' | 'category' | 'createdAt';
/** Direção inicial de cada campo: texto sobe (A→Z), número e data descem. */
const DEFAULT_ORDER: Record<SortKey, 'asc' | 'desc'> = {
  name: 'asc', sku: 'asc', size: 'asc', category: 'asc',
  salePrice: 'desc', costPrice: 'desc', quantity: 'desc', createdAt: 'desc',
};

const SORT_LABELS: Record<SortKey, string> = {
  createdAt: 'Cadastro', name: 'Nome', sku: 'SKU', category: 'Categoria',
  size: 'Tamanho', quantity: 'Estoque', salePrice: 'Preço de venda',
  costPrice: 'Preço de custo',
};

/**
 * Cabeçalho clicável que ordena a coluna.
 *
 * A seta só aparece na coluna ativa; nas outras fica o ícone neutro em opacidade
 * baixa, para ficar claro que dá para clicar sem poluir a linha.
 */
function SortHeader({
  by, label, sort, onSort, className,
}: {
  by: SortKey;
  label: string;
  sort: SortState<SortKey>;
  onSort: (by: SortKey) => void;
  className?: string;
}) {
  const ativo = sort.by === by;
  const Icon = !ativo ? ArrowUpDown : sort.order === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(by)}
      title={`Ordenar por ${label.toLowerCase()}`}
      className={`inline-flex items-center gap-1 text-xs uppercase tracking-wide transition-colors ${
        ativo ? 'text-lumine-lavender font-medium' : 'text-lumine-warm-gray hover:text-lumine-sage'
      } ${className ?? ''}`}
    >
      {label}
      <Icon size={12} className={ativo ? '' : 'opacity-40'} />
    </button>
  );
}

function ProductsPageContent() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();

  const { can } = usePermission();
  const canManage = can('manage_products');

  const [search, setSearch] = useState('');
  /**
   * Cada dimensão é uma LISTA: dá para marcar Saia e Collant ao mesmo tempo,
   * em vez de ter que escolher um só. Lista vazia = sem filtro naquela dimensão.
   */
  const [filters, setFilters] = useState<Record<MultiKey, string[]>>({
    categoryId: [], brand: [], size: [], color: [], audience: [], status: [],
  });
  const [lowStock, setLowStock] = useState(false);
  const [price, setPrice] = useState<PriceRange>({});
  const [sort, setSort] = useState<SortState<SortKey>>({ by: 'createdAt', order: 'desc' });
  const [page, setPage] = useState(1);

  function setPriceRange(range: PriceRange) {
    setPrice(range);
    setPage(1);
  }

  function setFilter(key: MultiKey, values: string[]) {
    setFilters((prev) => ({ ...prev, [key]: values }));
    setPage(1);
  }

  /** Tira um valor específico de uma dimensão (usado pelos chips). */
  function removeValue(key: MultiKey, value: string) {
    setFilter(key, filters[key].filter((v) => v !== value));
  }

  function clearFilters() {
    setFilters({ categoryId: [], brand: [], size: [], color: [], audience: [], status: [] });
    setLowStock(false);
    setPrice({});
    setSearch('');
    setPage(1);
  }

  /**
   * Clique no cabeçalho: primeira vez ordena, segunda inverte.
   * Texto começa em A→Z, número e data começam do maior, que é o que se espera
   * de "mais caro" ou "mais recente".
   */
  function toggleSort(by: SortKey) {
    setSort((prev) =>
      prev.by === by
        ? { by, order: prev.order === 'asc' ? 'desc' : 'asc' }
        : { by, order: DEFAULT_ORDER[by] }
    );
    setPage(1);
  }

  // Params compartilhados entre a listagem e os facets.
  // Multi-valor vai repetido na URL (?size=P&size=M) — é o formato que o Express
  // entrega como array para o backend.
  const filterParams = new URLSearchParams();
  if (search) filterParams.set('search', search);
  MULTI_KEYS.forEach((k) => filters[k].forEach((v) => filterParams.append(k, v)));
  if (lowStock) filterParams.set('lowStock', 'true');
  if (price.min !== undefined) filterParams.set('minPrice', String(price.min));
  if (price.max !== undefined) filterParams.set('maxPrice', String(price.max));
  const filterKey = filterParams.toString();

  const precoAtivo = price.min !== undefined || price.max !== undefined;
  const activeCount =
    MULTI_KEYS.reduce((acc, k) => acc + filters[k].length, 0) +
    (precoAtivo ? 1 : 0) +
    (lowStock ? 1 : 0);
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
    queryKey: ['products', page, filterKey, sort.by, sort.order],
    queryFn: () => {
      const params = new URLSearchParams(filterKey);
      params.set('page', String(page));
      params.set('limit', '20');
      params.set('sortBy', sort.by);
      params.set('sortOrder', sort.order);
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

  /**
   * Seleciona TODOS os produtos do filtro, não só os 20 da página.
   * A listagem é paginada, então precisa buscar os IDs no servidor.
   */
  const selectAllMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get<{ ids: string[]; total: number }>(
        `/api/products/ids?${filterKey}`
      );
      return res.data?.ids ?? [];
    },
    onSuccess: (ids) => {
      setSelectedIds(new Set(ids));
      toast({ title: `${ids.length} produto(s) selecionados` });
    },
    onError: () =>
      toast({ title: 'Erro ao selecionar todos', variant: 'destructive' }),
  });

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportProducts(filterKey)}
            title="Baixa os produtos que estão na tela, com os filtros aplicados"
          >
            <FileDown size={14} className="mr-2" />
            Exportar
          </Button>
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

          <MultiFilterSelect
            label="Categoria"
            placeholder="Todas"
            values={filters.categoryId}
            onChange={(v) => setFilter('categoryId', v)}
            options={(facets?.categories ?? []).map((c) => ({
              value: c.value, label: c.label, count: c.count,
            }))}
            searchable
          />
          <MultiFilterSelect
            label="Marca"
            placeholder="Todas"
            values={filters.brand}
            onChange={(v) => setFilter('brand', v)}
            options={asOptions(facets?.brands)}
            searchable
          />
          <MultiFilterSelect
            label="Tamanho"
            placeholder="Todos"
            values={filters.size}
            onChange={(v) => setFilter('size', v)}
            options={asOptions(facets?.sizes)}
            searchable
          />
          <MultiFilterSelect
            label="Cor"
            placeholder="Todas"
            values={filters.color}
            onChange={(v) => setFilter('color', v)}
            options={asOptions(facets?.colors)}
            searchable
          />
          <MultiFilterSelect
            label="Público"
            placeholder="Todos"
            values={filters.audience}
            onChange={(v) => setFilter('audience', v)}
            options={asOptions(facets?.audiences, AUDIENCE_LABELS)}
          />
          <MultiFilterSelect
            label="Status"
            placeholder="Todos"
            values={filters.status}
            onChange={(v) => setFilter('status', v)}
            options={asOptions(facets?.statuses, STATUS_LABELS)}
          />

          <PriceFilter
            value={price}
            onChange={setPriceRange}
            buckets={facets?.priceBuckets ?? []}
          />

          <button
            type="button"
            onClick={() => { setLowStock((v) => !v); setPage(1); }}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-xl border text-sm transition-all whitespace-nowrap ${
              lowStock
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
            {/* Um chip por valor: com multi-seleção, "Categoria: 3" não diria quais */}
            {filters.categoryId.map((id) => (
              <FilterChip
                key={`cat-${id}`}
                label="Categoria"
                value={facets?.categories.find((c) => c.value === id)?.label ?? '—'}
                onRemove={() => removeValue('categoryId', id)}
              />
            ))}
            {filters.brand.map((v) => (
              <FilterChip key={`marca-${v}`} label="Marca" value={v} onRemove={() => removeValue('brand', v)} />
            ))}
            {filters.size.map((v) => (
              <FilterChip key={`tam-${v}`} label="Tamanho" value={v} onRemove={() => removeValue('size', v)} />
            ))}
            {filters.color.map((v) => (
              <FilterChip key={`cor-${v}`} label="Cor" value={v} onRemove={() => removeValue('color', v)} />
            ))}
            {filters.audience.map((v) => (
              <FilterChip
                key={`pub-${v}`}
                label="Público"
                value={AUDIENCE_LABELS[v] ?? v}
                onRemove={() => removeValue('audience', v)}
              />
            ))}
            {filters.status.map((v) => (
              <FilterChip
                key={`st-${v}`}
                label="Status"
                value={STATUS_LABELS[v] ?? v}
                onRemove={() => removeValue('status', v)}
              />
            ))}
            {precoAtivo && (
              <FilterChip
                label="Preço"
                value={describePriceRange(price)}
                onRemove={() => setPriceRange({})}
              />
            )}
            {lowStock && (
              <FilterChip label="Estoque" value="Baixo" onRemove={() => { setLowStock(false); setPage(1); }} />
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
            <div className="text-sm">
              <span className="font-medium text-lumine-sage-dark">
                {selectedIds.size} produto(s) selecionado(s)
              </span>
              {/* Só oferece estender quando existe mais coisa fora da página */}
              {meta && selectedIds.size < meta.total && (
                <button
                  onClick={() => selectAllMutation.mutate()}
                  disabled={selectAllMutation.isPending}
                  className="ml-2 text-lumine-lavender hover:text-lumine-sage underline underline-offset-2 transition-colors disabled:opacity-50"
                >
                  {selectAllMutation.isPending
                    ? 'Selecionando...'
                    : `Selecionar todos os ${meta.total}`}
                </button>
              )}
            </div>
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
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-lumine-warm-gray">
            <span>{meta?.total ?? 0} produtos encontrados</span>
            <div className="flex items-center gap-2">
              {/* No celular as colunas somem, então a ordenação precisa existir aqui também */}
              <SortControl
                value={sort}
                onChange={(next) => { setSort(next); setPage(1); }}
                options={(Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({
                  value: k, label: SORT_LABELS[k],
                }))}
                defaultOrder={DEFAULT_ORDER}
              />
              {meta && meta.totalPages > 1 && (
                <span className="whitespace-nowrap">Página {meta.page} de {meta.totalPages}</span>
              )}
            </div>
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
              <span className="flex-1">
                <SortHeader by="name" label="Produto" sort={sort} onSort={toggleSort} />
              </span>
              <span className="hidden sm:flex w-16 justify-center">
                <SortHeader by="quantity" label="Estoque" sort={sort} onSort={toggleSort} />
              </span>
              <span className="hidden md:flex w-28 justify-end">
                <SortHeader by="salePrice" label="Preço" sort={sort} onSort={toggleSort} />
              </span>
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
