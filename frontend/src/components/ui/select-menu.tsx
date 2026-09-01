'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  /** Texto secundário à direita (ex: valor da parcela) */
  hint?: string;
  disabled?: boolean;
}

interface Props {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Abre a lista para cima — use quando o campo fica no rodapé de um dialog */
  dropUp?: boolean;
}

/**
 * Dropdown de largura cheia na paleta da Lumine.
 *
 * Substitui o <select> nativo, que o navegador renderiza com a aparência do
 * sistema operacional (cantos retos, fonte própria) e não acompanha o resto
 * da interface.
 */
export function SelectMenu({
  value,
  options,
  onChange,
  placeholder = 'Selecionar...',
  disabled = false,
  className,
  dropUp = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center justify-between gap-2 w-full h-9 px-3 rounded-xl border bg-white text-sm transition-all text-left',
          disabled
            ? 'border-lumine-lavender-pale text-lumine-warm-gray/60 cursor-not-allowed'
            : open
              ? 'border-lumine-lavender ring-2 ring-lumine-lavender/40 text-lumine-charcoal'
              : 'border-lumine-lavender-pale text-lumine-charcoal hover:border-lumine-lavender'
        )}
      >
        <span className={cn('truncate', !selected && 'text-lumine-warm-gray')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={cn('shrink-0 text-lumine-warm-gray transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          className={cn(
            'absolute z-40 w-full bg-white border border-lumine-lavender-pale rounded-xl shadow-lg overflow-hidden',
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
          )}
        >
          <div className="max-h-56 overflow-y-auto py-1">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                disabled={o.disabled}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                  o.disabled
                    ? 'text-lumine-warm-gray/50 cursor-not-allowed'
                    : 'hover:bg-lumine-lavender-pale/40'
                )}
              >
                <span className="w-4 shrink-0">
                  {value === o.value && <Check size={14} className="text-lumine-lavender" />}
                </span>
                <span
                  className={cn(
                    'flex-1 truncate',
                    value === o.value ? 'font-medium text-lumine-charcoal' : 'text-lumine-charcoal/85'
                  )}
                >
                  {o.label}
                </span>
                {o.hint && (
                  <span className="text-xs text-lumine-warm-gray shrink-0">{o.hint}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
