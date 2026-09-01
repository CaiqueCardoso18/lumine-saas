'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface Props {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  /** Texto quando nada está selecionado */
  placeholder?: string;
  /** Mostra caixa de busca dentro do dropdown (útil para listas longas) */
  searchable?: boolean;
  className?: string;
}

/**
 * Dropdown de filtro na paleta da Lumine, com contagem por opção.
 *
 * Substitui o <select> nativo, que não permite estilizar as opções nem mostrar
 * a contagem. Fecha ao clicar fora ou apertar Esc.
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Todos',
  searchable = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou com Esc
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 h-9 px-3 rounded-xl border bg-white text-sm transition-all whitespace-nowrap',
          value
            ? 'border-lumine-lavender text-lumine-charcoal ring-1 ring-lumine-lavender'
            : 'border-lumine-lavender-pale text-lumine-warm-gray hover:border-lumine-lavender'
        )}
      >
        <span className="text-lumine-warm-gray">{label}:</span>
        <span className={cn('font-medium', value ? 'text-lumine-charcoal' : 'text-lumine-warm-gray')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={cn('text-lumine-warm-gray transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 min-w-[15rem] max-w-[20rem] bg-white border border-lumine-lavender-pale rounded-xl shadow-lg overflow-hidden">
          {searchable && (
            <div className="relative border-b border-lumine-lavender-pale">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-lumine-warm-gray" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Buscar ${label.toLowerCase()}...`}
                className="w-full pl-8 pr-3 py-2 text-sm outline-none placeholder:text-lumine-warm-gray/70"
              />
            </div>
          )}

          <div className="max-h-64 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-lumine-lavender-pale/40 transition-colors"
            >
              <span className="w-4 shrink-0">
                {!value && <Check size={14} className="text-lumine-lavender" />}
              </span>
              <span className={cn(!value && 'font-medium text-lumine-charcoal')}>{placeholder}</span>
            </button>

            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-lumine-warm-gray text-center">
                Nenhuma opção
              </p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-lumine-lavender-pale/40 transition-colors"
                >
                  <span className="w-4 shrink-0">
                    {value === o.value && <Check size={14} className="text-lumine-lavender" />}
                  </span>
                  <span
                    className={cn(
                      'flex-1 truncate',
                      value === o.value ? 'font-medium text-lumine-charcoal' : 'text-lumine-charcoal/80'
                    )}
                  >
                    {o.label}
                  </span>
                  {o.count !== undefined && (
                    <span className="text-xs text-lumine-warm-gray tabular-nums shrink-0">
                      {o.count}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Chip de filtro ativo, com botão de remover. */
export function FilterChip({
  label,
  value,
  onRemove,
}: {
  label: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full bg-lumine-lavender-pale border border-lumine-lavender/40 text-xs text-lumine-sage-dark">
      <span className="text-lumine-warm-gray">{label}:</span>
      <span className="font-medium">{value}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover filtro ${label}`}
        className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-lumine-lavender/40 transition-colors"
      >
        <X size={11} />
      </button>
    </span>
  );
}
