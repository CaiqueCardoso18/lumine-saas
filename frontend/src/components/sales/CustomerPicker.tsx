'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, X, UserPlus, Check, Loader2, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';

export interface CustomerOption {
  id: string;
  name: string;
  phone?: string | null;
  openAmount?: number;
  overdueCount?: number;
}

interface Props {
  value: CustomerOption | null;
  onChange: (customer: CustomerOption | null) => void;
  /** Crediário exige cliente — muda o texto e destaca quando vazio */
  required?: boolean;
}

/**
 * Seletor de cliente do PDV.
 *
 * Cliente é opcional na venda de balcão, então o campo começa vazio e não
 * atrapalha o fluxo rápido. Quem vende no crediário precisa escolher — aí o
 * `required` sinaliza. Dá para cadastrar na hora sem sair da venda.
 */
export function CustomerPicker({ value, onChange, required = false }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ['customers', 'picker', search],
    queryFn: () =>
      api.paginated<CustomerOption>(
        `/api/customers?limit=8${search ? `&search=${encodeURIComponent(search)}` : ''}`
      ),
    enabled: open,
    staleTime: 15_000,
  });

  const customers = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<CustomerOption>('/api/customers', {
        name: newName.trim(),
        phone: newPhone.trim() || undefined,
      }),
    onSuccess: (res) => {
      const created = res.data;
      if (created) onChange(created);
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Cliente cadastrado!' });
      setCreating(false);
      setOpen(false);
      setNewName('');
      setNewPhone('');
      setSearch('');
    },
    onError: (err) => {
      toast({
        title: 'Erro ao cadastrar cliente',
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      });
    },
  });

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-xs">
          Cliente {required ? <span className="text-lumine-danger">*</span> : (
            <span className="text-lumine-warm-gray font-normal">(opcional)</span>
          )}
        </Label>
        {value && (
          <button
            onClick={() => onChange(null)}
            className="text-xs text-lumine-warm-gray hover:text-lumine-danger transition-colors"
          >
            Remover
          </button>
        )}
      </div>

      {value ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 h-9 px-3 rounded-xl border border-lumine-lavender bg-white text-sm text-left"
        >
          <User size={14} className="text-lumine-lavender shrink-0" />
          <span className="flex-1 truncate text-lumine-charcoal">{value.name}</span>
          {!!value.openAmount && value.openAmount > 0 && (
            <span className="text-xs text-lumine-danger shrink-0">
              deve {formatCurrency(value.openAmount)}
            </span>
          )}
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className={`w-full flex items-center gap-2 h-9 px-3 rounded-xl border bg-white text-sm text-left transition-colors ${
            required
              ? 'border-lumine-danger text-lumine-danger'
              : 'border-lumine-lavender-pale text-lumine-warm-gray hover:border-lumine-lavender'
          }`}
        >
          <Search size={14} className="shrink-0" />
          <span className="flex-1">
            {required ? 'Escolha o cliente do crediário' : 'Buscar ou cadastrar cliente...'}
          </span>
        </button>
      )}

      {open && (
        <div className="absolute z-50 bottom-full mb-1 w-full bg-white border border-lumine-lavender-pale rounded-xl shadow-lg overflow-hidden">
          {creating ? (
            <div className="p-3 space-y-2">
              <p className="text-xs font-medium text-lumine-sage-dark">Novo cliente</p>
              <Input
                autoFocus
                placeholder="Nome *"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-8 text-sm"
              />
              <Input
                placeholder="Telefone"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="h-8 text-sm"
              />
              <p className="text-xs text-lumine-warm-gray">
                Os demais dados podem ser preenchidos depois em Clientes.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8"
                  onClick={() => setCreating(false)}
                >
                  Voltar
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-8"
                  disabled={!newName.trim() || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  {createMutation.isPending && <Loader2 size={12} className="animate-spin mr-1" />}
                  Salvar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative border-b border-lumine-lavender-pale">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-lumine-warm-gray" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome, telefone ou CPF..."
                  className="w-full pl-8 pr-8 py-2 text-sm outline-none placeholder:text-lumine-warm-gray/70"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-lumine-warm-gray"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="max-h-48 overflow-y-auto py-1">
                {isFetching && customers.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-lumine-warm-gray text-center">Buscando...</p>
                ) : customers.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-lumine-warm-gray text-center">
                    Nenhum cliente encontrado
                  </p>
                ) : (
                  customers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { onChange(c); setOpen(false); setSearch(''); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-lumine-lavender-pale/40 transition-colors"
                    >
                      <span className="w-4 shrink-0">
                        {value && (value as CustomerOption).id === c.id && (
                          <Check size={13} className="text-lumine-lavender" />
                        )}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-lumine-charcoal">{c.name}</span>
                        {c.phone && (
                          <span className="block text-xs text-lumine-warm-gray">{c.phone}</span>
                        )}
                      </span>
                      {!!c.openAmount && c.openAmount > 0 && (
                        <span
                          className={`text-xs shrink-0 ${
                            c.overdueCount ? 'text-lumine-danger' : 'text-lumine-warm-gray'
                          }`}
                        >
                          {formatCurrency(c.openAmount)}
                          {!!c.overdueCount && c.overdueCount > 0 && ' em atraso'}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>

              <button
                onClick={() => { setCreating(true); setNewName(search); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left border-t border-lumine-lavender-pale text-lumine-lavender hover:bg-lumine-lavender-pale/40 transition-colors"
              >
                <UserPlus size={14} />
                Cadastrar novo cliente
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
