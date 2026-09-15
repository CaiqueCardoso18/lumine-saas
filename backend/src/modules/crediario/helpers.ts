/**
 * Divisão de parcelas do crediário.
 *
 * O problema clássico: R$ 100 em 3x daria 33,333... por parcela. Se arredondar
 * cada uma, a soma vira 99,99 ou 100,02 e o crediário nunca fecha com a venda.
 * A solução é distribuir os centavos que sobram nas PRIMEIRAS parcelas, que é
 * a convenção usada no comércio (a última parcela nunca é a maior).
 */
export function splitInstallments(total: number, count: number): number[] {
  if (count < 1) throw new Error('Número de parcelas deve ser ao menos 1');

  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;

  return Array.from({ length: count }, (_, i) => {
    const cents = base + (i < remainder ? 1 : 0);
    return cents / 100;
  });
}

/**
 * Datas de vencimento mensais a partir da primeira.
 *
 * Cuidado com fim de mês: vencimento dia 31 em fevereiro precisa cair no último
 * dia do mês, não "escorregar" para março. `new Date(ano, mes+1, 31)` faria isso,
 * então limitamos ao último dia do mês de destino.
 */
export function monthlyDueDates(firstDue: Date, count: number): Date[] {
  const day = firstDue.getDate();

  return Array.from({ length: count }, (_, i) => {
    const d = new Date(firstDue);
    d.setDate(1); // evita o overflow antes de trocar o mês
    d.setMonth(d.getMonth() + i);

    const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDayOfMonth));
    d.setHours(12, 0, 0, 0); // meio-dia evita virada de dia por fuso

    return d;
  });
}

export interface PlannedInstallment {
  number: number;
  totalCount: number;
  amount: number;
  dueDate: Date;
}

/** Monta o plano completo de parcelas de uma venda no crediário. */
export function planInstallments(
  total: number,
  count: number,
  firstDue: Date
): PlannedInstallment[] {
  const amounts = splitInstallments(total, count);
  const dates = monthlyDueDates(firstDue, count);

  return amounts.map((amount, i) => ({
    number: i + 1,
    totalCount: count,
    amount,
    dueDate: dates[i],
  }));
}
