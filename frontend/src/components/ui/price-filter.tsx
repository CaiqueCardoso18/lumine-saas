'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { MoneyInput } from '@/components/ui/money-input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

export interface PriceBucket {
  id: string;
  label: string;
  min?: number;
  max?: number;
  count: number;
}

export interface PriceRange {
  min?: number;
  max?: number;
}

interface Props {
  value: PriceRange;
  onChange: (range: PriceRange) => void;
  buckets: PriceBucket[];
  className?: string;
}

/** Texto curto do filtro ativo, para o botão e para o chip. */
export function describePriceRange(r: PriceRange): string {
  if (r.min === undefined && r.max === undefined) return '';
  if (r.min !== undefined && r.max !== undefined) {
    // min === max significa "valor exato"
    if (Math.abs(r.min - r.max) < 0.005) return formatCurrency(r.min);
    return `${formatCurrency(r.min)} a ${formatCurrency(r.max)}`;
  }
  if (r.max !== undefined) return `até ${formatCurrency(r.max)}`;
  return `acima de ${formatCurrency(r.min!)}`;
}

/**
 * Filtro de preço com três formas de usar:
 * - faixas prontas (Até R$ 25, R$ 25 a R$ 50...) com a contagem de cada uma
 * - intervalo livre (de X até Y)
 * - valor exato (acha só o produto que custa exatamente aquilo)
 */
export function PriceFilter({ value, onChange, buckets, className }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'range' | 'exact'>('range');
  const [min, setMin] = useState<number | null>(value.min ?? null);
  const [max, setMax] = useState<number | null>(value.max ?? null);
  const [exact, setExact] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Reflete mudanças vindas de fora (ex: "Limpar tudo")
  useEffect(() => {
    setMin(value.min ?? null);
    setMax(value.max ?? null);
  }, [value.min, value.max]);

  const ativo = value.min !== undefined || value.max !== undefined;
  const label = ativo ? describePriceRange(value) : 'Todos';

  /** Qual faixa pronta corresponde ao filtro atual, se alguma */
  const bucketAtivo = buckets.find(
    (b) => b.min === value.min && b.max === value.max
  );

  function aplicarIntervalo() {
    onChange({ min: min ?? undefined, max: max ?? undefined });
    setOpen(false);
  }

  function aplicarExato() {
    if (exact === null) return;
    // min e max iguais: o backend filtra gte e lte no mesmo valor
    onChange({ min: exact, max: exact });
    setOpen(false);
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 h-9 px-3 rounded-xl border bg-white text-sm transition-all whitespace-nowrap',
          ativo
            ? 'border-lumine-lavender text-lumine-charcoal ring-1 ring-lumine-lavender'
            : 'border-lumine-lavender-pale text-lumine-warm-gray hover:border-lumine-lavender'
        )}
      >
        <span className="text-lumine-warm-gray">Preço:</span>
        <span className={cn('font-medium', ativo ? 'text-lumine-charcoal' : 'text-lumine-warm-gray')}>
          {label}
        </span>
        <ChevronDown
          size={14}
          className={cn('text-lumine-warm-gray transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-72 bg-white border border-lumine-lavender-pale rounded-xl shadow-lg overflow-hidden">
          {/* Faixas prontas */}
          <div className="max-h-56 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => { onChange({}); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-lumine-lavender-pale/40 transition-colors"
            >
              <span className="w-4 shrink-0">
                {!ativo && <Check size={14} className="text-lumine-lavender" />}
              </span>
              <span className={cn(!ativo && 'font-medium text-lumine-charcoal')}>Todos</span>
            </button>

            {buckets.map((b) => (
              <button
                key={b.id}
                type="button"
                disabled={b.count === 0}
                onClick={() => { onChange({ min: b.min, max: b.max }); setOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                  b.count === 0
                    ? 'text-lumine-warm-gray/50 cursor-not-allowed'
                    : 'hover:bg-lumine-lavender-pale/40'
                )}
              >
                <span className="w-4 shrink-0">
                  {bucketAtivo?.id === b.id && <Check size={14} className="text-lumine-lavender" />}
                </span>
                <span
                  className={cn(
                    'flex-1',
                    bucketAtivo?.id === b.id
                      ? 'font-medium text-lumine-charcoal'
                      : 'text-lumine-charcoal/85'
                  )}
                >
                  {b.label}
                </span>
                <span className="text-xs text-lumine-warm-gray tabular-nums shrink-0">
                  {b.count}
                </span>
              </button>
            ))}
          </div>

          {/* Intervalo livre ou valor exato */}
          <div className="border-t border-lumine-lavender-pale p-3 space-y-2">
            <div className="flex rounded-lg border border-lumine-lavender-pale overflow-hidden w-fit">
              <button
                type="button"
                onClick={() => setMode('range')}
                className={cn(
                  'px-2.5 py-1 text-xs transition-colors',
                  mode === 'range'
                    ? 'bg-lumine-lavender text-white'
                    : 'bg-white text-lumine-warm-gray hover:bg-lumine-lavender-pale/40'
                )}
              >
                Intervalo
              </button>
              <button
                type="button"
                onClick={() => setMode('exact')}
                className={cn(
                  'px-2.5 py-1 text-xs transition-colors',
                  mode === 'exact'
                    ? 'bg-lumine-lavender text-white'
                    : 'bg-white text-lumine-warm-gray hover:bg-lumine-lavender-pale/40'
                )}
              >
                Valor exato
              </button>
            </div>

            {mode === 'range' ? (
              <>
                <div className="flex items-center gap-2">
                  <MoneyInput
                    value={min}
                    onValueChange={setMin}
                    placeholder="mín."
                    className="h-8 text-sm"
                  />
                  <span className="text-xs text-lumine-warm-gray shrink-0">até</span>
                  <MoneyInput
                    value={max}
                    onValueChange={setMax}
                    placeholder="máx."
                    className="h-8 text-sm"
                  />
                </div>
                <p className="text-xs text-lumine-warm-gray">
                  Pode deixar um dos dois vazio.
                </p>
                <Button size="sm" className="w-full h-8" onClick={aplicarIntervalo}>
                  Aplicar
                </Button>
              </>
            ) : (
              <>
                <MoneyInput
                  value={exact}
                  onValueChange={setExact}
                  placeholder="Ex: 2,30"
                  className="h-8 text-sm"
                  onKeyDown={(e) => { if (e.key === 'Enter') aplicarExato(); }}
                />
                <p className="text-xs text-lumine-warm-gray">
                  Mostra só os produtos com exatamente esse preço.
                </p>
                <Button
                  size="sm"
                  className="w-full h-8"
                  onClick={aplicarExato}
                  disabled={exact === null}
                >
                  Aplicar
                </Button>
              </>
            )}
          </div>

          {ativo && (
            <button
              type="button"
              onClick={() => { onChange({}); setMin(null); setMax(null); setExact(null); setOpen(false); }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-lumine-warm-gray hover:text-lumine-danger border-t border-lumine-lavender-pale transition-colors"
            >
              <X size={12} />
              Limpar filtro de preço
            </button>
          )}
        </div>
      )}
    </div>
  );
}
