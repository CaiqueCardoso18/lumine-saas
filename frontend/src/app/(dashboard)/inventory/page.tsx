'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, ClipboardCheck, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, XCircle, Clock, Package, AlertTriangle, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  useInventorySessions, useCreateSession, useApplySession, useCancelSession,
  useStockMovements, useCreateMovement, useInventorySession, useAddCounts,
} from '@/hooks/useInventory';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/formatters';
import { InventorySession, StockMovement, Product, MovementType } from '@/types';

// ─── Constants ──────────────────────────────────────────────

const SESSION_STATUS_ICON = {
  IN_PROGRESS: Clock,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
};

const SESSION_STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: 'Em Andamento',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
};

const SESSION_STATUS_BADGE: Record<string, 'warning' | 'success' | 'danger'> = {
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  ADJUSTMENT: 'Ajuste',
  LOSS: 'Perda',
  DAMAGE: 'Avaria',
  RETURN: 'Devolução',
  TRANSFER_IN: 'Entrada Transferência',
  TRANSFER_OUT: 'Saída Transferência',
  INVENTORY_ADJUSTMENT: 'Ajuste de Inventário',
  OTHER: 'Outro',
};

const MOVEMENT_TYPES: MovementType[] = [
  'ADJUSTMENT', 'LOSS', 'DAMAGE', 'RETURN', 'TRANSFER_IN', 'TRANSFER_OUT', 'OTHER',
];

// ─── Tab: Sessões de Contagem ───────────────────────────────

function SessionsTab() {
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useInventorySessions();
  const createSession = useCreateSession();

  const sessions = data?.data ?? [];

  function handleCreate() {
    if (!name.trim()) return;
    createSession.mutate({ name: name.trim(), notes: notes.trim() || undefined }, {
      onSuccess: () => { setShowNew(false); setName(''); setNotes(''); },
    });
  }

  if (detailId) return <SessionDetail id={detailId} onBack={() => setDetailId(null)} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-lumine-warm-gray">
          {data?.meta?.total ?? 0} sessões encontradas
        </p>
        <Button size="sm" onClick={() => setShowNew(true)}>
          <Plus size={14} className="mr-2" />
          Nova Sessão
        </Button>
      </div>

      {/* New session form */}
      <AnimatePresence>
        {showNew && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label>Nome da sessão</Label>
                  <Input
                    placeholder="Ex: Inventário Agosto 2026"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Observações (opcional)</Label>
                  <Input
                    placeholder="Notas adicionais..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowNew(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleCreate} disabled={createSession.isPending || !name.trim()}>
                    Criar Sessão
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sessions list */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-lumine-lavender-pale">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                  <div className="w-10 h-10 bg-lumine-lavender-pale rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-lumine-lavender-pale rounded w-1/3" />
                    <div className="h-3 bg-lumine-lavender-pale rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-lumine-warm-gray">
              <ClipboardCheck size={40} strokeWidth={1} className="mb-3 opacity-40" />
              <p className="text-sm">Nenhuma sessão de inventário</p>
              <p className="text-xs mt-1">Crie uma nova sessão para começar a contagem</p>
            </div>
          ) : (
            <div className="divide-y divide-lumine-lavender-pale">
              {sessions.map((session) => {
                const StatusIcon = SESSION_STATUS_ICON[session.status];
                return (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-lumine-lavender-pale/20 transition-colors cursor-pointer group"
                    onClick={() => setDetailId(session.id)}
                  >
                    <div className="w-10 h-10 rounded-xl bg-lumine-lavender-pale flex items-center justify-center shrink-0">
                      <StatusIcon size={18} strokeWidth={1.5} className="text-lumine-lavender" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-lumine-charcoal truncate">{session.name}</p>
                        <Badge variant={SESSION_STATUS_BADGE[session.status]}>
                          {SESSION_STATUS_LABEL[session.status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-lumine-warm-gray mt-0.5">
                        {formatDateTime(session.createdAt)} · {session.user?.name ?? 'Usuário'}
                        {session._count?.counts != null && ` · ${session._count.counts} itens contados`}
                      </p>
                    </div>
                    {session.status === 'COMPLETED' && (
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-lumine-charcoal">
                          {session.matchedCount} OK · {session.divergedCount} diverg.
                        </p>
                      </div>
                    )}
                    <Eye size={16} className="text-lumine-warm-gray opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Session Detail ─────────────────────────────────────────

function SessionDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: session, isLoading } = useInventorySession(id);
  const applySession = useApplySession(id);
  const cancelSession = useCancelSession(id);
  const addCounts = useAddCounts(id);

  const [searchProduct, setSearchProduct] = useState('');
  const [countedQty, setCountedQty] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [countNote, setCountNote] = useState('');

  // Product search for adding counts
  const { data: productResults } = useQuery({
    queryKey: ['products-search', searchProduct],
    queryFn: () => api.paginated<Product>(`/api/products?search=${encodeURIComponent(searchProduct)}&limit=5`),
    enabled: searchProduct.length >= 2,
  });

  function handleAddCount() {
    if (!selectedProductId || countedQty === '') return;
    addCounts.mutate({
      counts: [{
        productId: selectedProductId,
        countedQuantity: parseInt(countedQty),
        notes: countNote.trim() || undefined,
      }],
    }, {
      onSuccess: () => {
        setSelectedProductId('');
        setSearchProduct('');
        setCountedQty('');
        setCountNote('');
      },
    });
  }

  if (isLoading || !session) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>← Voltar</Button>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-lumine-lavender-pale rounded w-1/3" />
          <div className="h-40 bg-lumine-lavender-pale rounded-xl" />
        </div>
      </div>
    );
  }

  const isActive = session.status === 'IN_PROGRESS';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">← Voltar</Button>
          <h2 className="font-heading text-xl text-lumine-sage-dark">{session.name}</h2>
          <p className="text-sm text-lumine-warm-gray">
            {formatDateTime(session.createdAt)} · <Badge variant={SESSION_STATUS_BADGE[session.status]}>{SESSION_STATUS_LABEL[session.status]}</Badge>
          </p>
        </div>
        {isActive && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm('Cancelar esta sessão? Nenhum ajuste será aplicado.')) cancelSession.mutate();
              }}
            >
              <XCircle size={14} className="mr-2" />
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (confirm('Aplicar todas as divergências? O estoque será atualizado.')) applySession.mutate();
              }}
              disabled={!session.counts?.length}
            >
              <CheckCircle2 size={14} className="mr-2" />
              Aplicar Ajustes
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-heading font-semibold text-lumine-charcoal">{session.counts?.length ?? 0}</p>
            <p className="text-xs text-lumine-warm-gray">Itens Contados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-heading font-semibold text-lumine-success">{session.matchedCount}</p>
            <p className="text-xs text-lumine-warm-gray">Conferidos OK</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-heading font-semibold text-lumine-danger">{session.divergedCount}</p>
            <p className="text-xs text-lumine-warm-gray">Divergências</p>
          </CardContent>
        </Card>
      </div>

      {/* Add count form */}
      {isActive && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Adicionar Contagem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-lumine-warm-gray" />
              <Input
                placeholder="Buscar produto por nome ou SKU..."
                className="pl-9"
                value={searchProduct}
                onChange={(e) => { setSearchProduct(e.target.value); setSelectedProductId(''); }}
              />
              {/* Search results dropdown */}
              <AnimatePresence>
                {productResults?.data && productResults.data.length > 0 && !selectedProductId && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute z-10 w-full mt-1 bg-white border border-lumine-lavender-pale rounded-xl shadow-lg overflow-hidden"
                  >
                    {productResults.data.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedProductId(p.id);
                          setSearchProduct(`${p.sku} — ${p.name}`);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-lumine-lavender-pale/30 transition-colors flex items-center justify-between"
                      >
                        <span>
                          <span className="font-medium text-lumine-charcoal">{p.name}</span>
                          <span className="text-lumine-warm-gray ml-2">{p.sku}</span>
                        </span>
                        <span className="text-xs text-lumine-warm-gray">Estoque: {p.quantity}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex gap-3">
              <div className="w-32">
                <Input
                  type="number"
                  placeholder="Qtd contada"
                  value={countedQty}
                  onChange={(e) => setCountedQty(e.target.value)}
                  min={0}
                />
              </div>
              <div className="flex-1">
                <Input
                  placeholder="Nota (opcional)"
                  value={countNote}
                  onChange={(e) => setCountNote(e.target.value)}
                />
              </div>
              <Button onClick={handleAddCount} disabled={!selectedProductId || countedQty === '' || addCounts.isPending}>
                Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Counts table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Itens Contados</CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          {!session.counts?.length ? (
            <div className="flex flex-col items-center py-12 text-lumine-warm-gray">
              <Package size={32} strokeWidth={1} className="mb-2 opacity-40" />
              <p className="text-sm">Nenhum item contado ainda</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 px-6 py-2 border-b border-lumine-lavender-pale bg-lumine-cream/50 text-xs text-lumine-warm-gray uppercase tracking-wide">
                <span className="flex-1">Produto</span>
                <span className="w-20 text-center">Sistema</span>
                <span className="w-20 text-center">Contado</span>
                <span className="w-20 text-center">Diferença</span>
              </div>
              <div className="divide-y divide-lumine-lavender-pale">
                {session.counts.map((c) => {
                  const diff = c.difference;
                  return (
                    <div key={c.id} className="flex items-center gap-4 px-6 py-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-lumine-charcoal truncate">{c.product.name}</p>
                        <p className="text-xs text-lumine-warm-gray">{c.product.sku}</p>
                      </div>
                      <span className="w-20 text-center text-lumine-warm-gray">{c.systemQuantity}</span>
                      <span className="w-20 text-center font-medium">{c.countedQuantity}</span>
                      <span className={`w-20 text-center font-semibold ${
                        diff === 0 ? 'text-lumine-success' : diff > 0 ? 'text-blue-500' : 'text-lumine-danger'
                      }`}>
                        {diff > 0 ? `+${diff}` : diff}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Movimentações ─────────────────────────────────────

function MovementsTab() {
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [type, setType] = useState<MovementType>('ADJUSTMENT');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');

  const { data, isLoading } = useStockMovements();
  const createMovement = useCreateMovement();

  const { data: productResults } = useQuery({
    queryKey: ['products-search-mv', search],
    queryFn: () => api.paginated<Product>(`/api/products?search=${encodeURIComponent(search)}&limit=5`),
    enabled: search.length >= 2,
  });

  const movements = data?.data ?? [];

  function handleCreate() {
    if (!selectedProductId || !quantity || !reason.trim()) return;
    createMovement.mutate({
      productId: selectedProductId,
      type,
      quantity: parseInt(quantity),
      reason: reason.trim(),
      reference: reference.trim() || undefined,
    }, {
      onSuccess: () => {
        setShowNew(false);
        setSelectedProductId('');
        setSearch('');
        setType('ADJUSTMENT');
        setQuantity('');
        setReason('');
        setReference('');
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-lumine-warm-gray">
          {data?.meta?.total ?? 0} movimentações
        </p>
        <Button size="sm" onClick={() => setShowNew(true)}>
          <Plus size={14} className="mr-2" />
          Nova Movimentação
        </Button>
      </div>

      {/* New movement form */}
      <AnimatePresence>
        {showNew && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card>
              <CardContent className="pt-6 space-y-4">
                {/* Product search */}
                <div className="space-y-1.5 relative">
                  <Label>Produto</Label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-lumine-warm-gray" />
                    <Input
                      placeholder="Buscar produto..."
                      className="pl-9"
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setSelectedProductId(''); }}
                    />
                  </div>
                  <AnimatePresence>
                    {productResults?.data && productResults.data.length > 0 && !selectedProductId && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute z-10 w-full mt-1 bg-white border border-lumine-lavender-pale rounded-xl shadow-lg overflow-hidden"
                      >
                        {productResults.data.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setSelectedProductId(p.id);
                              setSearch(`${p.sku} — ${p.name}`);
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-lumine-lavender-pale/30 transition-colors flex items-center justify-between"
                          >
                            <span>
                              <span className="font-medium">{p.name}</span>
                              <span className="text-lumine-warm-gray ml-2">{p.sku}</span>
                            </span>
                            <span className="text-xs text-lumine-warm-gray">Estoque: {p.quantity}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <select
                      className="flex h-10 w-full rounded-xl border border-lumine-lavender-pale bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lumine-lavender"
                      value={type}
                      onChange={(e) => setType(e.target.value as MovementType)}
                    >
                      {MOVEMENT_TYPES.map((t) => (
                        <option key={t} value={t}>{MOVEMENT_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 5 ou -3"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Motivo</Label>
                  <Input
                    placeholder="Ex: Produto danificado em transporte"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Referência (opcional)</Label>
                  <Input
                    placeholder="Ex: NF-12345"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowNew(false)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCreate}
                    disabled={createMovement.isPending || !selectedProductId || !quantity || !reason.trim()}
                  >
                    Registrar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Movements list */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-lumine-lavender-pale">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                  <div className="w-10 h-10 bg-lumine-lavender-pale rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-lumine-lavender-pale rounded w-1/3" />
                    <div className="h-3 bg-lumine-lavender-pale rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-lumine-warm-gray">
              <ArrowUpDown size={40} strokeWidth={1} className="mb-3 opacity-40" />
              <p className="text-sm">Nenhuma movimentação registrada</p>
            </div>
          ) : (
            <div className="divide-y divide-lumine-lavender-pale">
              {movements.map((mv) => {
                const isPositive = mv.quantity > 0;
                return (
                  <motion.div
                    key={mv.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-4 px-6 py-4"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isPositive ? 'bg-green-50' : 'bg-red-50'
                    }`}>
                      {isPositive
                        ? <ArrowUp size={18} strokeWidth={1.5} className="text-lumine-success" />
                        : <ArrowDown size={18} strokeWidth={1.5} className="text-lumine-danger" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-lumine-charcoal truncate">
                          {mv.product?.name ?? 'Produto'}
                        </p>
                        <Badge variant="default">
                          {MOVEMENT_TYPE_LABELS[mv.type] ?? mv.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-lumine-warm-gray mt-0.5">
                        {mv.reason} · {mv.user?.name ?? 'Usuário'} · {formatDateTime(mv.createdAt)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-semibold text-sm ${isPositive ? 'text-lumine-success' : 'text-lumine-danger'}`}>
                        {isPositive ? `+${mv.quantity}` : mv.quantity}
                      </p>
                      <p className="text-xs text-lumine-warm-gray">
                        {mv.previousStock} → {mv.newStock}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────

export default function InventoryPage() {
  const [tab, setTab] = useState<'sessions' | 'movements'>('sessions');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl text-lumine-sage-dark">Inventário</h1>
        <p className="text-sm text-lumine-warm-gray mt-1">
          Contagens físicas e movimentações de estoque
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-lumine-lavender-pale/50 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('sessions')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'sessions'
              ? 'bg-white text-lumine-sage-dark shadow-sm'
              : 'text-lumine-warm-gray hover:text-lumine-sage'
          }`}
        >
          <ClipboardCheck size={14} className="inline mr-2" />
          Sessões de Contagem
        </button>
        <button
          onClick={() => setTab('movements')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'movements'
              ? 'bg-white text-lumine-sage-dark shadow-sm'
              : 'text-lumine-warm-gray hover:text-lumine-sage'
          }`}
        >
          <ArrowUpDown size={14} className="inline mr-2" />
          Movimentações
        </button>
      </div>

      {tab === 'sessions' ? <SessionsTab /> : <MovementsTab />}
    </motion.div>
  );
}
