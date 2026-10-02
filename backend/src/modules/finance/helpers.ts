/**
 * Agregação do calendário financeiro.
 *
 * Separado do serviço para ser testável sem banco — é aqui que entra e sai
 * dinheiro do planejamento da loja, e um dia agrupado errado faria a dona
 * achar que tem caixa quando não tem.
 */

export type EntryKind = 'RECEIVABLE' | 'PAYABLE';

export interface CalendarEntry {
  id: string;
  kind: EntryKind;
  description: string;
  amount: number;
  dueDate: Date;
  /** Já venceu e continua em aberto */
  overdue: boolean;
  /** Cliente (a receber) ou fornecedor/categoria (a pagar) */
  party?: string | null;
  link?: { type: 'installment' | 'payable'; id: string };
}

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  receivable: number;
  payable: number;
  /** receivable - payable: o que sobra (ou falta) no dia */
  net: number;
  entries: CalendarEntry[];
}

/** YYYY-MM-DD no fuso local — a chave que o calendário usa por dia. */
export function dayKey(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Agrupa os lançamentos por dia, somando entradas e saídas.
 *
 * Dias sem lançamento ficam de fora de propósito: a tela desenha o mês
 * inteiro e preenche as lacunas com zero, e trafegar 30 dias vazios a cada
 * requisição seria desperdício.
 */
export function groupByDay(entries: CalendarEntry[]): CalendarDay[] {
  const mapa = new Map<string, CalendarDay>();

  for (const e of entries) {
    const key = dayKey(e.dueDate);
    const dia = mapa.get(key) ?? { date: key, receivable: 0, payable: 0, net: 0, entries: [] };

    if (e.kind === 'RECEIVABLE') dia.receivable = round2(dia.receivable + e.amount);
    else dia.payable = round2(dia.payable + e.amount);

    dia.net = round2(dia.receivable - dia.payable);
    dia.entries.push(e);
    mapa.set(key, dia);
  }

  // Ordena por data e, dentro do dia, deixa o que vence mais cedo primeiro
  return Array.from(mapa.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      ...d,
      entries: d.entries.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
    }));
}

export interface CalendarTotals {
  receivable: number;
  payable: number;
  net: number;
  overdueReceivable: number;
  overduePayable: number;
}

/** Totais do período, com o que já está vencido destacado. */
export function summarize(entries: CalendarEntry[]): CalendarTotals {
  let receivable = 0;
  let payable = 0;
  let overdueReceivable = 0;
  let overduePayable = 0;

  for (const e of entries) {
    if (e.kind === 'RECEIVABLE') {
      receivable += e.amount;
      if (e.overdue) overdueReceivable += e.amount;
    } else {
      payable += e.amount;
      if (e.overdue) overduePayable += e.amount;
    }
  }

  return {
    receivable: round2(receivable),
    payable: round2(payable),
    net: round2(receivable - payable),
    overdueReceivable: round2(overdueReceivable),
    overduePayable: round2(overduePayable),
  };
}

/**
 * Primeiro e último instante do mês, no fuso local.
 *
 * `new Date(ano, mes, 0)` devolve o último dia do mês anterior, que é o truque
 * para não precisar saber se o mês tem 28, 30 ou 31 dias.
 */
export function monthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}
