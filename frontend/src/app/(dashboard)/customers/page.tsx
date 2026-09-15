'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, X, Plus, User, Phone, Mail, MapPin, Loader2, ArrowLeft,
  ShoppingBag, Wallet, AlertCircle, Pencil, Trash2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, PAYMENT_METHOD_LABELS } from '@/lib/formatters';
import { toast } from '@/hooks/use-toast';

interface CustomerListItem {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  salesCount: number;
  openAmount: number;
  openCount: number;
  overdueCount: number;
}

interface CustomerDetail {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  document?: string | null;
  address?: string | null;
  notes?: string | null;
  sales: Array<{
    id: string; saleNumber: number; total: number;
    paymentMethod: string; status: string; createdAt: string;
  }>;
  installments: Array<{
    id: string; number: number; totalCount: number; amount: number;
    dueDate: string; status: string; sale: { saleNumber: number };
  }>;
  summary: {
    salesCount: number;
    totalPurchased: number;
    openAmount: number;
    openCount: number;
    overdueCount: number;
    overdueAmount: number;
  };
}

const EMPTY_FORM = {
  name: '', phone: '', email: '', document: '', address: '', notes: '',
};

/** Formulário de cliente — serve para criar e editar. */
function CustomerForm({
  customerId, initial, onClose,
}: {
  customerId?: string;
  initial?: typeof EMPTY_FORM;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(initial ?? EMPTY_FORM);
  const isEdit = !!customerId;

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        document: form.document.trim() || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      return isEdit
        ? api.put(`/api/customers/${customerId}`, body)
        : api.post('/api/customers', body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: isEdit ? 'Cliente atualizado!' : 'Cliente cadastrado!' });
      onClose();
    },
    onError: (err) =>
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      }),
  });

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-3 border-b border-lumine-lavender-pale">
          <p className="font-heading text-lg text-lumine-sage-dark">
            {isEdit ? 'Editar cliente' : 'Novo cliente'}
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome *</Label>
            <Input value={form.name} onChange={set('name')} placeholder="Nome completo" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone</Label>
              <Input value={form.phone} onChange={set('phone')} placeholder="(11) 98765-4321" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CPF</Label>
              <Input value={form.document} onChange={set('document')} placeholder="000.000.000-00" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input value={form.email} onChange={set('email')} placeholder="email@exemplo.com" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Endereço</Label>
            <Input value={form.address} onChange={set('address')} placeholder="Rua, número, bairro" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Input value={form.notes} onChange={set('notes')} placeholder="Preferências, tamanho..." />
          </div>
        </div>

        <div className="flex gap-2 px-5 py-3 border-t border-lumine-lavender-pale bg-lumine-cream/50">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={!form.name.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 size={14} className="animate-spin mr-2" />}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Ficha do cliente com histórico de compras e parcelas. */
function CustomerDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', id],
    queryFn: async () => (await api.get<CustomerDetail>(`/api/customers/${id}`)).data,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Cliente removido' });
      onBack();
    },
    onError: (err) =>
      toast({
        title: 'Não foi possível remover',
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      }),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={14} className="mr-1" /> Voltar
        </Button>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-lumine-lavender-pale rounded w-1/3" />
          <div className="h-32 bg-lumine-lavender-pale rounded-xl" />
        </div>
      </div>
    );
  }

  const s = data.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack} className="mb-2 -ml-2">
            <ArrowLeft size={14} className="mr-1" /> Voltar
          </Button>
          <h2 className="font-heading text-xl text-lumine-sage-dark">{data.name}</h2>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-lumine-warm-gray">
            {data.phone && (
              <span className="inline-flex items-center gap-1"><Phone size={11} />{data.phone}</span>
            )}
            {data.email && (
              <span className="inline-flex items-center gap-1"><Mail size={11} />{data.email}</span>
            )}
            {data.document && <span>CPF {data.document}</span>}
            {data.address && (
              <span className="inline-flex items-center gap-1"><MapPin size={11} />{data.address}</span>
            )}
          </div>
          {data.notes && (
            <p className="text-xs text-lumine-warm-gray italic mt-1">{data.notes}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil size={13} className="mr-1" /> Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm(`Remover "${data.name}"?`)) deleteMutation.mutate();
            }}
            className="hover:text-lumine-danger"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-4 text-center">
          <p className="text-xl font-heading font-semibold">{s.salesCount}</p>
          <p className="text-xs text-lumine-warm-gray">Compras</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <p className="text-xl font-heading font-semibold text-lumine-gold">
            {formatCurrency(s.totalPurchased)}
          </p>
          <p className="text-xs text-lumine-warm-gray">Total comprado</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <p className="text-xl font-heading font-semibold text-lumine-charcoal">
            {formatCurrency(s.openAmount)}
          </p>
          <p className="text-xs text-lumine-warm-gray">{s.openCount} parcela(s) em aberto</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <p className={`text-xl font-heading font-semibold ${
            s.overdueCount ? 'text-lumine-danger' : 'text-lumine-success'
          }`}>
            {formatCurrency(s.overdueAmount)}
          </p>
          <p className="text-xs text-lumine-warm-gray">
            {s.overdueCount ? `${s.overdueCount} em atraso` : 'Em dia'}
          </p>
        </CardContent></Card>
      </div>

      {/* Parcelas */}
      {data.installments.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Parcelas</CardTitle></CardHeader>
          <CardContent className="p-0 mt-2">
            <div className="divide-y divide-lumine-lavender-pale">
              {data.installments.map((i) => {
                const atrasada = i.status === 'PENDING' && new Date(i.dueDate) < new Date();
                return (
                  <div key={i.id} className="flex items-center gap-3 px-4 sm:px-6 py-2.5 text-sm">
                    <div className="flex-1 min-w-0">
                      <span className="text-lumine-charcoal">
                        {i.number}/{i.totalCount}
                      </span>
                      <span className="text-xs text-lumine-warm-gray ml-2">
                        venda #{i.sale.saleNumber} · vence {formatDate(i.dueDate)}
                      </span>
                    </div>
                    <Badge variant={
                      i.status === 'PAID' ? 'success' : atrasada ? 'danger' : 'warning'
                    }>
                      {i.status === 'PAID' ? 'Paga' : atrasada ? 'Atrasada' : 'Em aberto'}
                    </Badge>
                    <span className="w-24 text-right font-medium">
                      {formatCurrency(Number(i.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compras */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Compras</CardTitle></CardHeader>
        <CardContent className="p-0 mt-2">
          {data.sales.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-lumine-warm-gray">
              <ShoppingBag size={32} strokeWidth={1} className="mb-2 opacity-40" />
              <p className="text-sm">Nenhuma compra registrada</p>
            </div>
          ) : (
            <div className="divide-y divide-lumine-lavender-pale">
              {data.sales.map((sale) => (
                <div key={sale.id} className="flex items-center gap-3 px-4 sm:px-6 py-2.5 text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="text-lumine-charcoal">#{sale.saleNumber}</span>
                    <span className="text-xs text-lumine-warm-gray ml-2">
                      {formatDate(sale.createdAt)} ·{' '}
                      {PAYMENT_METHOD_LABELS[sale.paymentMethod] ?? sale.paymentMethod}
                    </span>
                  </div>
                  {sale.status === 'CANCELLED' && <Badge variant="danger">Cancelada</Badge>}
                  <span className="w-24 text-right font-medium text-lumine-gold">
                    {formatCurrency(Number(sale.total))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <CustomerForm
          customerId={data.id}
          initial={{
            name: data.name,
            phone: data.phone ?? '',
            email: data.email ?? '',
            document: data.document ?? '',
            address: data.address ?? '',
            notes: data.notes ?? '',
          }}
          onClose={() => { setEditing(false); qc.invalidateQueries({ queryKey: ['customers', id] }); }}
        />
      )}
    </div>
  );
}

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [withDebt, setWithDebt] = useState(false);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, withDebt, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (withDebt) params.set('withDebt', 'true');
      return api.paginated<CustomerListItem>(`/api/customers?${params}`);
    },
    placeholderData: (prev) => prev,
  });

  const customers = data?.data ?? [];
  const meta = data?.meta;

  if (selectedId) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <CustomerDetailView id={selectedId} onBack={() => setSelectedId(null)} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl text-lumine-sage-dark">Clientes</h1>
          <p className="text-sm text-lumine-warm-gray mt-1">
            Cadastro, histórico de compras e saldo devedor
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus size={14} className="mr-2" /> Novo Cliente
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[12rem] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-lumine-warm-gray" />
          <Input
            placeholder="Nome, telefone ou CPF..."
            className="pl-9 pr-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Limpar"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-lumine-warm-gray"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => { setWithDebt((v) => !v); setPage(1); }}
          className={`flex items-center gap-1.5 h-9 px-3 rounded-xl border text-sm transition-all ${
            withDebt
              ? 'border-lumine-danger bg-lumine-danger/10 text-lumine-danger ring-1 ring-lumine-danger/40'
              : 'border-lumine-lavender-pale bg-white text-lumine-warm-gray hover:border-lumine-lavender'
          }`}
        >
          <Wallet size={13} />
          Só devedores
        </button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="px-4 sm:px-6 py-3 border-b border-lumine-lavender-pale text-sm text-lumine-warm-gray">
            {meta?.total ?? 0} cliente(s)
          </div>

          {isLoading ? (
            <div className="divide-y divide-lumine-lavender-pale">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
                  <div className="w-9 h-9 bg-lumine-lavender-pale rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-lumine-lavender-pale rounded w-1/3" />
                    <div className="h-3 bg-lumine-lavender-pale rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-lumine-warm-gray">
              <User size={36} strokeWidth={1} className="mb-2 opacity-40" />
              <p className="text-sm">Nenhum cliente encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-lumine-lavender-pale">
              {customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className="w-full flex items-center gap-3 px-4 sm:px-6 py-3 text-left hover:bg-lumine-lavender-pale/20 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-lumine-lavender-pale flex items-center justify-center shrink-0">
                    <User size={16} strokeWidth={1.5} className="text-lumine-lavender" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-lumine-charcoal truncate">{c.name}</p>
                      {c.overdueCount > 0 && (
                        <Badge variant="danger">
                          <AlertCircle size={10} className="mr-1" />
                          {c.overdueCount} em atraso
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-lumine-warm-gray mt-0.5">
                      {c.phone ?? 'sem telefone'} · {c.salesCount} compra(s)
                    </p>
                  </div>
                  {c.openAmount > 0 && (
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-medium ${
                        c.overdueCount ? 'text-lumine-danger' : 'text-lumine-charcoal'
                      }`}>
                        {formatCurrency(c.openAmount)}
                      </p>
                      <p className="text-xs text-lumine-warm-gray">em aberto</p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <div className="flex justify-center gap-2 p-4 border-t border-lumine-lavender-pale">
              <Button
                variant="outline" size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page === meta.totalPages}
              >
                Próxima
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {creating && <CustomerForm onClose={() => setCreating(false)} />}
    </motion.div>
  );
}
