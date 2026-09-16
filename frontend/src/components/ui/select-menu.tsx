'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  /**
   * @deprecated A direção agora é decidida sozinha pelo espaço disponível.
   * Mantido só para não quebrar quem já passa a prop.
   */
  dropUp?: boolean;
}

/**
 * Dropdown de largura cheia na paleta da Lumine.
 *
 * A lista é renderizada num portal com `position: fixed`. Isso é essencial:
 * dentro do rodapé do PDV — que tem `overflow-y-auto` — uma lista posicionada
 * com `absolute` era RECORTADA pelo container e ficava inalcançável, dando a
 * impressão de campo travado. Em portal, nenhum overflow de ancestral atinge
 * o menu.
 */
export function SelectMenu({
  value,
  options,
  onChange,
  placeholder = 'Selecionar...',
  disabled = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, dropUp: false });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const alturaMenu = Math.min(240, options.length * 40 + 16);
    const espacoAbaixo = window.innerHeight - r.bottom;
    // Só sobe se não couber embaixo E couber em cima
    const dropUp = espacoAbaixo < alturaMenu + 12 && r.top > alturaMenu + 12;

    setCoords({
      top: dropUp ? r.top - 4 : r.bottom + 4,
      left: r.left,
      width: r.width,
      dropUp,
    });
  }, [options.length]);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;

    function onDown(e: MouseEvent | TouchEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    // Acompanha scroll e resize — inclusive o teclado do celular abrindo
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);

    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, reposition]);

  const selected = options.find((o) => o.value === value);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center justify-between gap-2 w-full h-9 px-3 rounded-xl border bg-white text-sm transition-all text-left',
          disabled
            ? 'border-lumine-lavender-pale text-lumine-warm-gray/60 cursor-not-allowed'
            : open
              ? 'border-lumine-lavender ring-2 ring-lumine-lavender/40 text-lumine-charcoal'
              : 'border-lumine-lavender-pale text-lumine-charcoal hover:border-lumine-lavender',
          className
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

      {mounted && open && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            width: coords.width,
            transform: coords.dropUp ? 'translateY(-100%)' : undefined,
            zIndex: 80,
          }}
          className="bg-white border border-lumine-lavender-pale rounded-xl shadow-lg overflow-hidden"
        >
          <div className="max-h-56 overflow-y-auto py-1 overscroll-contain">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                disabled={o.disabled}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors',
                  o.disabled
                    ? 'text-lumine-warm-gray/50 cursor-not-allowed'
                    : 'hover:bg-lumine-lavender-pale/40 active:bg-lumine-lavender-pale/60'
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
        </div>,
        document.body
      )}
    </>
  );
}
