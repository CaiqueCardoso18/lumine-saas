'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { FilterSelect } from '@/components/ui/filter-select';

export type SortOrder = 'asc' | 'desc';

export interface SortState<K extends string = string> {
  by: K;
  order: SortOrder;
}

interface Props<K extends string> {
  value: SortState<K>;
  onChange: (next: SortState<K>) => void;
  /** Campos ordenáveis, na ordem em que aparecem no dropdown. */
  options: Array<{ value: K; label: string }>;
  /**
   * Direção inicial de cada campo. Texto costuma começar em A→Z e
   * número/data no maior primeiro — sem isso, "ordenar por preço" abriria
   * nos mais baratos, que não é o que se procura.
   */
  defaultOrder?: Partial<Record<K, SortOrder>>;
  label?: string;
}

/**
 * Controle de ordenação: escolhe o campo e inverte a direção.
 *
 * Vive fora da tabela de propósito — no celular as colunas somem e o
 * cabeçalho clicável some junto, então a ordenação precisa de um lugar
 * que apareça em qualquer largura.
 */
export function SortControl<K extends string>({
  value,
  onChange,
  options,
  defaultOrder,
  label = 'Ordenar',
}: Props<K>) {
  const atual = options.find((o) => o.value === value.by);

  return (
    <div className="flex items-center gap-2">
      <FilterSelect
        label={label}
        placeholder={atual?.label ?? '—'}
        value={value.by}
        onChange={(v) => {
          if (!v) return;
          const k = v as K;
          onChange({ by: k, order: defaultOrder?.[k] ?? 'asc' });
        }}
        options={options.map((o) => ({ value: o.value, label: o.label }))}
      />
      <button
        type="button"
        onClick={() => onChange({ ...value, order: value.order === 'asc' ? 'desc' : 'asc' })}
        title={value.order === 'asc' ? 'Crescente' : 'Decrescente'}
        aria-label="Inverter ordem"
        className="h-9 w-9 flex items-center justify-center rounded-xl border border-lumine-lavender-pale bg-white text-lumine-warm-gray hover:border-lumine-lavender hover:text-lumine-sage transition-colors"
      >
        {value.order === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
      </button>
    </div>
  );
}
