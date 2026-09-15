'use client';

import { forwardRef, useEffect, useState, type InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Converte o que foi digitado em número.
 *
 * `<input type="number">` não aceita vírgula no teclado brasileiro: o navegador
 * simplesmente ignora a tecla e o valor fica errado (digitar "89,90" resultava
 * em 8990 ou em campo vazio). Por isso este componente usa type="text" e faz o
 * parsing na mão.
 */
export function parseMoneyInput(raw: string): number | null {
  if (!raw.trim()) return null;

  // mantém só dígitos, vírgula, ponto e sinal
  let s = raw.trim().replace(/[^\d,.-]/g, '');
  if (!s || s === '-') return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    // o último separador é o decimal, o outro é milhar
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma !== -1) {
    s = s.replace(',', '.');
  } else if (lastDot !== -1) {
    // "1.234" é milhar; "12.34" é decimal
    if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Number -> texto em pt-BR para exibir no campo. */
export function formatMoneyInput(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | null;
  onValueChange: (value: number | null) => void;
  /** Formata para "1.234,56" ao sair do campo */
  formatOnBlur?: boolean;
}

/**
 * Campo de valor em reais que aceita vírgula.
 * Enquanto o usuário digita, o texto é preservado como está; o número só é
 * normalizado no blur, senão o cursor pula ao formatar no meio da digitação.
 */
export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput(
  { value, onValueChange, formatOnBlur = true, className, ...rest },
  ref
) {
  const [text, setText] = useState(() => formatMoneyInput(value));
  const [focused, setFocused] = useState(false);

  // Sincroniza quando o valor muda de fora (ex: limpar o carrinho)
  useEffect(() => {
    if (focused) return;
    const parsed = parseMoneyInput(text);
    if (parsed !== value) setText(formatMoneyInput(value));
  }, [value, focused]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Input
      {...rest}
      ref={ref}
      type="text"
      inputMode="decimal"
      value={text}
      className={cn(className)}
      onFocus={(e) => {
        setFocused(true);
        rest.onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        onValueChange(parseMoneyInput(raw));
      }}
      onBlur={(e) => {
        setFocused(false);
        const parsed = parseMoneyInput(text);
        onValueChange(parsed);
        if (formatOnBlur) setText(formatMoneyInput(parsed));
        rest.onBlur?.(e);
      }}
    />
  );
});
