'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectMenu } from '@/components/ui/select-menu';
import { api } from '@/lib/api';
import { Category } from '@/types';
import { toast } from '@/hooks/use-toast';

/**
 * Painel de edição em massa.
 *
 * Regra central: só os campos MARCADOS são enviados. Um campo desmarcado não
 * entra no payload, então não sobrescreve o valor de cada produto — o que
 * evita apagar a marca de 50 produtos sem querer só por ter deixado o campo
 * em branco.
 */

type FieldKey =
  | 'salePrice' | 'costPrice' | 'quantity' | 'minStock'
  | 'categoryId' | 'status' | 'audience'
  | 'brand' | 'size' | 'color' | 'shortDescription';

const FIELD_LABELS: Record<FieldKey, string> = {
  salePrice: 'Preço de venda (R$)',
  costPrice: 'Preço de custo (R$)',
  quantity: 'Estoque',
  minStock: 'Estoque mínimo',
  categoryId: 'Categoria',
  status: 'Status',
  audience: 'Público',
  brand: 'Marca',
  size: 'Tamanho',
  color: 'Cor',
  shortDescription: 'Descrição curta',
};

const GROUPS: Array<{ title: string; fields: FieldKey[] }> = [
  { title: 'Preços e estoque', fields: ['salePrice', 'costPrice', 'quantity', 'minStock'] },
  { title: 'Classificação', fields: ['categoryId', 'status', 'audience'] },
  { title: 'Atributos', fields: ['brand', 'size', 'color', 'shortDescription'] },
];

interface Props {
  productIds: string[];
  onClose: () => void;
  onDone: () => void;
}

export function BulkEditPanel({ productIds, onClose, onDone }: Props) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState<Set<FieldKey>>(new Set());
  const [values, setValues] = useState<Record<string, string>>({});

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/api/settings/categories'),
  });
  const categories = categoriesData?.data ?? [];

  function toggleField(field: FieldKey) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  const mutation = useMutation({
    mutationFn: (updates: Record<string, unknown>) =>
      api.patch('/api/products/bulk', { productIds, updates }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product-facets'] });
      toast({ title: `${productIds.length} produto(s) atualizados!` });
      onDone();
    },
    onError: (err) => {
      toast({
        title: 'Erro ao atualizar',
        description: err instanceof Error ? err.message : 'Tente novamente',
        variant: 'destructive',
      });
    },
  });

  function apply() {
    if (enabled.size === 0) {
      toast({ title: 'Marque ao menos um campo para alterar', variant: 'destructive' });
      return;
    }

    const updates: Record<string, unknown> = {};
    for (const field of Array.from(enabled)) {
      const raw = values[field as string] ?? '';
      // Numéricos vazios não fazem sentido; texto vazio significa "limpar"
      if (['salePrice', 'costPrice', 'quantity', 'minStock'].includes(field)) {
        if (raw === '') {
          toast({ title: `Informe um valor para ${FIELD_LABELS[field]}`, variant: 'destructive' });
          return;
        }
        updates[field] = Number(raw);
      } else {
        updates[field] = raw;
      }
    }

    mutation.mutate(updates);
  }

  function renderInput(field: FieldKey) {
    const value = values[field] ?? '';
    const set = (v: string) => setValues((prev) => ({ ...prev, [field]: v }));
    const isOn = enabled.has(field);

    if (field === 'categoryId') {
      return (
        <SelectMenu
          value={value}
          onChange={set}
          disabled={!isOn}
          placeholder="Selecionar..."
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
      );
    }
    if (field === 'status') {
      return (
        <SelectMenu
          value={value}
          onChange={set}
          disabled={!isOn}
          placeholder="Selecionar..."
          options={[
            { value: 'ACTIVE', label: 'Ativo' },
            { value: 'INACTIVE', label: 'Inativo' },
            { value: 'DISCONTINUED', label: 'Descontinuado' },
          ]}
        />
      );
    }
    if (field === 'audience') {
      return (
        <SelectMenu
          value={value}
          onChange={set}
          disabled={!isOn}
          placeholder="Selecionar..."
          options={[
            { value: '', label: '— (limpar)' },
            { value: 'ADULTO', label: 'Adulto' },
            { value: 'INFANTIL', label: 'Infantil' },
          ]}
        />
      );
    }

    const isNumeric = ['salePrice', 'costPrice', 'quantity', 'minStock'].includes(field);
    return (
      <Input
        value={value}
        onChange={(e) => set(e.target.value)}
        disabled={!isOn}
        type={isNumeric ? 'number' : 'text'}
        step={field === 'salePrice' || field === 'costPrice' ? '0.01' : undefined}
        min={isNumeric ? '0' : undefined}
        placeholder={isNumeric ? '0' : 'Deixe vazio para limpar'}
        className="h-9 text-sm"
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-white border border-lumine-lavender rounded-2xl shadow-sm overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-lumine-lavender-pale bg-lumine-lavender-pale/40">
        <div>
          <p className="text-sm font-medium text-lumine-sage-dark">
            Editar {productIds.length} produto(s) em massa
          </p>
          <p className="text-xs text-lumine-warm-gray mt-0.5">
            Marque só os campos que quer alterar — o resto fica como está
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="text-lumine-warm-gray hover:text-lumine-danger transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <p className="text-xs uppercase tracking-wide text-lumine-warm-gray mb-2">
              {group.title}
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {group.fields.map((field) => (
                <div key={field} className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={enabled.has(field)}
                      onChange={() => toggleField(field)}
                      className="w-3.5 h-3.5 rounded border-lumine-lavender-pale text-lumine-lavender focus:ring-lumine-lavender accent-lumine-lavender"
                    />
                    <Label
                      className={`text-xs cursor-pointer ${
                        enabled.has(field) ? 'text-lumine-charcoal' : 'text-lumine-warm-gray'
                      }`}
                    >
                      {FIELD_LABELS[field]}
                    </Label>
                  </label>
                  {renderInput(field)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-lumine-lavender-pale bg-lumine-cream/50">
        <p className="text-xs text-lumine-warm-gray">
          {enabled.size === 0
            ? 'Nenhum campo marcado'
            : `${enabled.size} campo(s) serão alterados em ${productIds.length} produto(s)`}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={apply} disabled={mutation.isPending || enabled.size === 0}>
            {mutation.isPending && <Loader2 size={14} className="animate-spin mr-2" />}
            Aplicar alterações
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
