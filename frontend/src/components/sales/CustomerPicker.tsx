'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, X, UserPlus, Loader2, User, ArrowLeft } from 'lucide-react';
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
 * Abre como folha em tela cheia (portal) em vez de dropdown ancorado. O motivo
 * é concreto: o rodapé do PDV tem `overflow-y-auto`, e um dropdown `absolute`
 * era recortado pelo container — no celular o campo parecia travado, sem deixar
 * digitar. Em tela cheia também sobra espaço para o teclado, que é o que faltava
 * quando o crediário empurrava o formulário para baixo.
 */
export function CustomerPicker({ value, onChange, required = false }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  useEffect(() => setMounted(true), []);

  // Trava o scroll do fundo enquanto a folha está aberta
  useEffect(() => {
    if (!open) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = anterior; };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setCreating(false);
      setSearch('');
      setNewName('');
      setNewPhone('');
    }
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ['customers', 'picker', search],
    queryFn: () =>
      api.paginated<CustomerOption>(
        `/api/customers?limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`
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
      if (res.data) onChange(res.data);
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Cliente cadastrado!' });
      setOpen(false);
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
    <>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs">
            Cliente {required ? <span className="text-lumine-danger">*</span> : (
              <span className="text-lumine-warm-gray font-normal">(opcional)</span>
            )}
          </Label>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs text-lumine-warm-gray hover:text-lumine-danger transition-colors"
            >
              Remover
            </button>
          )}
        </div>

        {value ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full flex items-center gap-2 h-10 px-3 rounded-xl border border-lumine-lavender bg-white text-sm text-left"
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
            type="button"
            onClick={() => setOpen(true)}
            className={`w-full flex items-center gap-2 h-10 px-3 rounded-xl border bg-white text-sm text-left transition-colors ${
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
      </div>

      {mounted && open && createPortal(
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-xl flex flex-col max-h-[85dvh] sm:max-h-[70dvh] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-lumine-lavender-pale shrink-0">
              {creating && (
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  aria-label="Voltar"
                  className="text-lumine-warm-gray hover:text-lumine-sage transition-colors"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <p className="font-heading text-lg text-lumine-sage-dark flex-1">
                {creating ? 'Novo cliente' : 'Escolher cliente'}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="text-lumine-warm-gray hover:text-lumine-danger transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {creating ? (
              <div className="p-4 space-y-3 overflow-y-auto">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome *</Label>
                  <Input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nome do cliente"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefone</Label>
                  <Input
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="(11) 98765-4321"
                    inputMode="tel"
                  />
                </div>
                <p className="text-xs text-lumine-warm-gray">
                  Os demais dados podem ser preenchidos depois em Clientes.
                </p>
                <Button
                  className="w-full"
                  disabled={!newName.trim() || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  {createMutation.isPending && <Loader2 size={14} className="animate-spin mr-2" />}
                  Salvar e usar nesta venda
                </Button>
              </div>
            ) : (
              <>
                <div className="p-3 border-b border-lumine-lavender-pale shrink-0">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-lumine-warm-gray" />
                    <Input
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Nome, telefone ou CPF..."
                      className="pl-9 pr-9"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        aria-label="Limpar"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-lumine-warm-gray"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain">
                  {isFetching && customers.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-lumine-warm-gray text-center">
                      Buscando...
                    </p>
                  ) : customers.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-lumine-warm-gray text-center">
                      Nenhum cliente encontrado
                    </p>
                  ) : (
                    <div className="divide-y divide-lumine-lavender-pale">
                      {customers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { onChange(c); setOpen(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                            value?.id === c.id
                              ? 'bg-lumine-lavender-pale/50'
                              : 'hover:bg-lumine-lavender-pale/30 active:bg-lumine-lavender-pale/50'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-full bg-lumine-lavender-pale flex items-center justify-center shrink-0">
                            <User size={14} className="text-lumine-lavender" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-lumine-charcoal truncate">{c.name}</p>
                            {c.phone && (
                              <p className="text-xs text-lumine-warm-gray">{c.phone}</p>
                            )}
                          </div>
                          {!!c.openAmount && c.openAmount > 0 && (
                            <span
                              className={`text-xs shrink-0 text-right ${
                                c.overdueCount ? 'text-lumine-danger' : 'text-lumine-warm-gray'
                              }`}
                            >
                              {formatCurrency(c.openAmount)}
                              {!!c.overdueCount && c.overdueCount > 0 && (
                                <span className="block">em atraso</span>
                              )}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3 border-t border-lumine-lavender-pale shrink-0 pb-safe">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => { setCreating(true); setNewName(search); }}
                  >
                    <UserPlus size={15} className="mr-2" />
                    Cadastrar novo cliente
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
