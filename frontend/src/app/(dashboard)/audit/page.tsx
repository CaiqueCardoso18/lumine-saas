'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, SlidersHorizontal, ChevronDown, ShieldCheck,
  Package, ShoppingCart, Upload, Warehouse, ClipboardList, User as UserIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { FilterSelect, FilterChip } from '@/components/ui/filter-select';
import { PermissionGuard } from '@/components/layout/PermissionGuard';
import { formatDateTime } from '@/lib/formatters';
import { useAuditLogs, useAuditFacets, AuditLog } from '@/hooks/useAudit';

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Criação',
  UPDATE: 'Alteração',
  DELETE: 'Exclusão',
  STOCK_CHANGE: 'Estoque',
  PRICE_CHANGE: 'Preço',
  BULK_UPDATE: 'Edição em massa',
  IMPORT: 'Importação',
  SALE: 'Venda',
  SALE_CANCEL: 'Venda cancelada',
  ORDER_STATUS_CHANGE: 'Status de pedido',
  INVENTORY_ADJUST: 'Ajuste de inventário',
  STOCK_MOVEMENT: 'Movimentação',
};

const ACTION_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  CREATE: 'success',
  UPDATE: 'default',
  DELETE: 'danger',
  SALE_CANCEL: 'danger',
  PRICE_CHANGE: 'warning',
  STOCK_CHANGE: 'warning',
  BULK_UPDATE: 'warning',
  INVENTORY_ADJUST: 'warning',
};

const ENTITY_LABELS: Record<string, string> = {
  product: 'Produto',
  sale: 'Venda',
  order: 'Pedido',
  import: 'Importação',
  inventory_session: 'Inventário',
  stock_movement: 'Movimentação',
  user: 'Usuário',
};

const ENTITY_ICONS: Record<string, typeof Package> = {
  product: Package,
  sale: ShoppingCart,
  order: ClipboardList,
  import: Upload,
  inventory_session: Warehouse,
  stock_movement: Warehouse,
  user: UserIcon,
};

/** Campos que não interessam no diff — ruído técnico. */
const IGNORED_FIELDS = new Set([
  'id', 'createdAt', 'updatedAt', 'searchText', 'deletedAt', 'categoryId', 'subcategoryId',
]);

const FIELD_LABELS: Record<string, string> = {
  sku: 'SKU',
  name: 'Nome',
  salePrice: 'Preço de venda',
  costPrice: 'Preço de custo',
  quantity: 'Estoque',
  minStock: 'Estoque mínimo',
  brand: 'Marca',
  size: 'Tamanho',
  color: 'Cor',
  audience: 'Público',
  status: 'Status',
  shortDescription: 'Descrição curta',
  description: 'Descrição',
  barcode: 'Código de barras',
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Compara oldValue/newValue e devolve só os campos que realmente mudaram. */
function computeDiff(log: AuditLog) {
  const before = (log.oldValue ?? {}) as Record<string, unknown>;
  const after = (log.newValue ?? {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  return keys
    .filter((k) => !IGNORED_FIELDS.has(k))
    .map((k) => ({ field: k, from: before[k], to: after[k] }))
    .filter((d) => formatValue(d.from) !== formatValue(d.to));
}

function LogRow({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  const diff = computeDiff(log);
  const Icon = ENTITY_ICONS[log.entityType] ?? ShieldCheck;
  const meta = log.metadata as Record<string, unknown> | null;
  const hasDetail = diff.length > 0 || (meta && Object.keys(meta).length > 0);

  return (
    <div className="border-b border-lumine-lavender-pale last:border-0">
      <button
        onClick={() => hasDetail && setOpen((v) => !v)}
        className={`w-full flex items-start gap-3 px-4 sm:px-6 py-3 text-left transition-colors ${
          hasDetail ? 'hover:bg-lumine-lavender-pale/20 cursor-pointer' : 'cursor-default'
        }`}
      >
        <div className="w-8 h-8 rounded-lg bg-lumine-lavender-pale flex items-center justify-center shrink-0 mt-0.5">
          <Icon size={15} strokeWidth={1.5} className="text-lumine-lavender" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={ACTION_BADGE[log.action] ?? 'default'}>
              {ACTION_LABELS[log.action] ?? log.action}
            </Badge>
            <span className="text-sm text-lumine-charcoal">
              {ENTITY_LABELS[log.entityType] ?? log.entityType}
            </span>
            {log.product && (
              <span className="text-sm text-lumine-charcoal font-medium truncate">
                {log.product.name}
                <span className="text-lumine-warm-gray font-normal ml-1.5">
                  {log.product.sku}
                </span>
              </span>
            )}
          </div>
          <p className="text-xs text-lumine-warm-gray mt-1">
            {log.user?.name ?? 'Sistema'}
            {log.user?.role === 'OWNER' && ' (admin)'}
            {' · '}
            {formatDateTime(log.createdAt)}
            {diff.length > 0 && ` · ${diff.length} campo(s) alterado(s)`}
          </p>
        </div>

        {hasDetail && (
          <ChevronDown
            size={15}
            className={`text-lumine-warm-gray shrink-0 mt-1 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-6 pb-4 pl-14 sm:pl-16 space-y-3">
              {diff.length > 0 && (
                <div className="rounded-xl border border-lumine-lavender-pale overflow-hidden">
                  <div className="grid grid-cols-3 gap-2 px-3 py-1.5 bg-lumine-cream/60 text-xs uppercase tracking-wide text-lumine-warm-gray">
                    <span>Campo</span>
                    <span>Antes</span>
                    <span>Depois</span>
                  </div>
                  {diff.map((d) => (
                    <div
                      key={d.field}
                      className="grid grid-cols-3 gap-2 px-3 py-2 text-xs border-t border-lumine-lavender-pale"
                    >
                      <span className="text-lumine-charcoal">
                        {FIELD_LABELS[d.field] ?? d.field}
                      </span>
                      <span className="text-lumine-warm-gray line-through break-words">
                        {formatValue(d.from)}
                      </span>
                      <span className="text-lumine-charcoal font-medium break-words">
                        {formatValue(d.to)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {meta && Object.keys(meta).length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-lumine-warm-gray mb-1">
                    Detalhes
                  </p>
                  <pre className="text-xs bg-lumine-cream/60 rounded-xl p-3 overflow-x-auto text-lumine-charcoal/80 whitespace-pre-wrap break-words">
                    {JSON.stringify(meta, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AuditPage() {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    action: '', entityType: '', userId: '', startDate: '', endDate: '',
  });
  const [page, setPage] = useState(1);

  function setFilter(key: keyof typeof filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function clearAll() {
    setFilters({ action: '', entityType: '', userId: '', startDate: '', endDate: '' });
    setSearch('');
    setPage(1);
  }

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  const query = params.toString();

  const { data, isLoading } = useAuditLogs(query, page);
  const facets = useAuditFacets(query).data;

  const logs = data?.data ?? [];
  const meta = data?.meta;
  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <PermissionGuard permission="view_audit">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl text-lumine-sage-dark">Auditoria</h1>
          <p className="text-sm text-lumine-warm-gray mt-1">
            Tudo que foi alterado no sistema, por quem e quando
          </p>
        </div>

        {/* Busca */}
        <div className="relative max-w-md">
          <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-lumine-warm-gray" />
          <Input
            placeholder="Buscar por produto, SKU ou ID..."
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

        {/* Filtros */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-lumine-warm-gray mr-1">
              <SlidersHorizontal size={13} />
              Filtros
            </span>

            <FilterSelect
              label="Ação"
              placeholder="Todas"
              value={filters.action}
              onChange={(v) => setFilter('action', v)}
              options={(facets?.actions ?? []).map((a) => ({
                value: a.value,
                label: ACTION_LABELS[a.value] ?? a.value,
                count: a.count,
              }))}
            />
            <FilterSelect
              label="Tipo"
              placeholder="Todos"
              value={filters.entityType}
              onChange={(v) => setFilter('entityType', v)}
              options={(facets?.entityTypes ?? []).map((e) => ({
                value: e.value,
                label: ENTITY_LABELS[e.value] ?? e.value,
                count: e.count,
              }))}
            />
            <FilterSelect
              label="Usuário"
              placeholder="Todos"
              value={filters.userId}
              onChange={(v) => setFilter('userId', v)}
              options={(facets?.users ?? []).map((u) => ({
                value: u.value, label: u.label, count: u.count,
              }))}
            />

            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilter('startDate', e.target.value)}
                className="h-9 w-auto text-sm"
                aria-label="Data inicial"
              />
              <span className="text-xs text-lumine-warm-gray">até</span>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilter('endDate', e.target.value)}
                className="h-9 w-auto text-sm"
                aria-label="Data final"
              />
            </div>
          </div>

          {(activeCount > 0 || search) && (
            <div className="flex flex-wrap items-center gap-2">
              {search && <FilterChip label="Busca" value={search} onRemove={() => setSearch('')} />}
              {filters.action && (
                <FilterChip
                  label="Ação"
                  value={ACTION_LABELS[filters.action] ?? filters.action}
                  onRemove={() => setFilter('action', '')}
                />
              )}
              {filters.entityType && (
                <FilterChip
                  label="Tipo"
                  value={ENTITY_LABELS[filters.entityType] ?? filters.entityType}
                  onRemove={() => setFilter('entityType', '')}
                />
              )}
              {filters.userId && (
                <FilterChip
                  label="Usuário"
                  value={facets?.users.find((u) => u.value === filters.userId)?.label ?? '—'}
                  onRemove={() => setFilter('userId', '')}
                />
              )}
              {filters.startDate && (
                <FilterChip label="De" value={filters.startDate} onRemove={() => setFilter('startDate', '')} />
              )}
              {filters.endDate && (
                <FilterChip label="Até" value={filters.endDate} onRemove={() => setFilter('endDate', '')} />
              )}
              <button
                onClick={clearAll}
                className="text-xs text-lumine-warm-gray hover:text-lumine-danger underline underline-offset-2 transition-colors ml-1"
              >
                Limpar tudo
              </button>
            </div>
          )}
        </div>

        {/* Lista */}
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-lumine-lavender-pale text-sm text-lumine-warm-gray">
              <span>{meta?.total ?? 0} registro(s)</span>
              {meta && meta.totalPages > 1 && (
                <span>Página {meta.page} de {meta.totalPages}</span>
              )}
            </div>

            {isLoading ? (
              <div className="divide-y divide-lumine-lavender-pale">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
                    <div className="w-8 h-8 bg-lumine-lavender-pale rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-lumine-lavender-pale rounded w-1/3" />
                      <div className="h-3 bg-lumine-lavender-pale rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-lumine-warm-gray">
                <ShieldCheck size={40} strokeWidth={1} className="mb-3 opacity-40" />
                <p className="text-sm">Nenhum registro encontrado</p>
                <p className="text-xs mt-1">Ajuste os filtros ou o período</p>
              </div>
            ) : (
              <div>
                {logs.map((log) => (
                  <LogRow key={log.id} log={log} />
                ))}
              </div>
            )}

            {meta && meta.totalPages > 1 && (
              <div className="flex justify-center gap-2 p-4 border-t border-lumine-lavender-pale">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-9 px-4 rounded-xl border border-lumine-lavender-pale bg-white text-sm hover:border-lumine-lavender disabled:opacity-40 transition-colors"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page === meta.totalPages}
                  className="h-9 px-4 rounded-xl border border-lumine-lavender-pale bg-white text-sm hover:border-lumine-lavender disabled:opacity-40 transition-colors"
                >
                  Próxima
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </PermissionGuard>
  );
}
