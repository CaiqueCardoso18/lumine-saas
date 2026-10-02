'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { formatCurrency } from '@/lib/formatters';
import { Installment, useUpdateInstallment } from '@/hooks/useCrediario';

/** Converte a data ISO do servidor para o valor de um <input type="date">. */
export function toDateInput(iso: string): string {
  const d = new Date(iso);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Edita uma parcela já criada: valor, vencimento ou observação.
 *
 * Existe para o caso de "a cliente pediu para adiar" ou "combinamos outro
 * valor", sem precisar cancelar a venda inteira.
 */
export function EditInstallmentDialog({
  installment, onClose,
}: {
  installment: Installment | null;
  onClose: () => void;
}) {
  const update = useUpdateInstallment();
  const [amount, setAmount] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  if (!installment) return null;

  const valorAtual = Number(installment.amount);
  const vencimentoAtual = toDateInput(installment.dueDate);

  const novoValor = amount ?? valorAtual;
  const novoVencimento = dueDate || vencimentoAtual;

  const mudou =
    novoValor !== valorAtual || novoVencimento !== vencimentoAtual || notes.trim() !== '';

  function salvar() {
    if (!installment) return;
    update.mutate(
      {
        id: installment.id,
        ...(novoValor !== valorAtual && { amount: novoValor }),
        ...(novoVencimento !== vencimentoAtual && { dueDate: novoVencimento }),
        ...(notes.trim() && { notes: notes.trim() }),
      },
      { onSuccess: onClose }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-lumine-lavender-pale">
          <p className="font-heading text-lg text-lumine-sage-dark">Editar parcela</p>
          <p className="text-xs text-lumine-warm-gray mt-0.5">
            {installment.customer.name} · parcela {installment.number}/{installment.totalCount}
          </p>
        </div>

        <div className="p-5 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-lumine-warm-gray">
              Valor — hoje {formatCurrency(valorAtual)}
            </label>
            <MoneyInput
              value={amount}
              onValueChange={setAmount}
              placeholder={valorAtual.toFixed(2).replace('.', ',')}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-lumine-warm-gray">Vencimento</label>
            <Input
              type="date"
              value={dueDate || vencimentoAtual}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-lumine-warm-gray">Observação</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: cliente pediu para adiar"
              className="h-9 text-sm"
            />
            {installment.notes && (
              <p className="text-xs text-lumine-warm-gray/80 italic">
                Atual: {installment.notes}
              </p>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-lumine-lavender-pale flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={salvar} disabled={!mudou || update.isPending}>
            {update.isPending && <Loader2 size={14} className="animate-spin mr-2" />}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
