import {
  dayKey, groupByDay, summarize, monthRange, type CalendarEntry,
} from '../helpers';

function entry(over: Partial<CalendarEntry> & { amount: number; dueDate: Date }): CalendarEntry {
  return {
    id: Math.random().toString(36).slice(2),
    kind: 'RECEIVABLE',
    description: 'teste',
    overdue: false,
    ...over,
  };
}

describe('dayKey', () => {
  it('usa o fuso local, sem voltar um dia', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31');
  });

  it('preenche mês e dia com zero à esquerda', () => {
    expect(dayKey(new Date(2026, 2, 7, 12))).toBe('2026-03-07');
  });
});

describe('monthRange', () => {
  it('cobre o mês inteiro de fevereiro', () => {
    const { start, end } = monthRange(2026, 2);
    expect(dayKey(start)).toBe('2026-02-01');
    expect(dayKey(end)).toBe('2026-02-28');
  });

  it('acerta fevereiro de ano bissexto', () => {
    expect(dayKey(monthRange(2028, 2).end)).toBe('2028-02-29');
  });

  it('acerta meses de 30 e 31 dias', () => {
    expect(dayKey(monthRange(2026, 4).end)).toBe('2026-04-30');
    expect(dayKey(monthRange(2026, 12).end)).toBe('2026-12-31');
  });

  it('o fim do mês inclui o último instante do dia', () => {
    const { end } = monthRange(2026, 6);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });
});

describe('groupByDay', () => {
  it('soma entradas e saídas do mesmo dia', () => {
    const dias = groupByDay([
      entry({ amount: 100, dueDate: new Date(2026, 0, 10, 12) }),
      entry({ amount: 50, dueDate: new Date(2026, 0, 10, 12) }),
      entry({ kind: 'PAYABLE', amount: 30, dueDate: new Date(2026, 0, 10, 12) }),
    ]);
    expect(dias).toHaveLength(1);
    expect(dias[0]).toMatchObject({
      date: '2026-01-10', receivable: 150, payable: 30, net: 120,
    });
  });

  it('separa dias diferentes e devolve em ordem', () => {
    const dias = groupByDay([
      entry({ amount: 10, dueDate: new Date(2026, 0, 20, 12) }),
      entry({ amount: 20, dueDate: new Date(2026, 0, 5, 12) }),
      entry({ amount: 30, dueDate: new Date(2026, 1, 1, 12) }),
    ]);
    expect(dias.map((d) => d.date)).toEqual(['2026-01-05', '2026-01-20', '2026-02-01']);
  });

  it('dia só com conta a pagar tem saldo negativo', () => {
    const dias = groupByDay([
      entry({ kind: 'PAYABLE', amount: 1200, dueDate: new Date(2026, 0, 5, 12) }),
    ]);
    expect(dias[0].net).toBe(-1200);
  });

  it('não inventa dias vazios', () => {
    const dias = groupByDay([
      entry({ amount: 10, dueDate: new Date(2026, 0, 1, 12) }),
      entry({ amount: 10, dueDate: new Date(2026, 0, 31, 12) }),
    ]);
    expect(dias).toHaveLength(2);
  });

  it('centavos não acumulam erro de ponto flutuante', () => {
    const dias = groupByDay([
      entry({ amount: 0.1, dueDate: new Date(2026, 0, 10, 12) }),
      entry({ amount: 0.2, dueDate: new Date(2026, 0, 10, 12) }),
    ]);
    expect(dias[0].receivable).toBe(0.3);
  });

  it('lista vazia devolve lista vazia', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('summarize', () => {
  it('separa a receber, a pagar e o saldo', () => {
    const t = summarize([
      entry({ amount: 500, dueDate: new Date(2026, 0, 10, 12) }),
      entry({ kind: 'PAYABLE', amount: 1200, dueDate: new Date(2026, 0, 5, 12) }),
    ]);
    expect(t).toEqual({
      receivable: 500, payable: 1200, net: -700,
      overdueReceivable: 0, overduePayable: 0,
    });
  });

  it('destaca o que já venceu', () => {
    const t = summarize([
      entry({ amount: 300, dueDate: new Date(2026, 0, 1, 12), overdue: true }),
      entry({ amount: 200, dueDate: new Date(2026, 0, 20, 12) }),
      entry({ kind: 'PAYABLE', amount: 150, dueDate: new Date(2026, 0, 2, 12), overdue: true }),
    ]);
    expect(t.overdueReceivable).toBe(300);
    expect(t.overduePayable).toBe(150);
    expect(t.receivable).toBe(500);
  });

  it('mês sem lançamento zera tudo', () => {
    expect(summarize([])).toEqual({
      receivable: 0, payable: 0, net: 0, overdueReceivable: 0, overduePayable: 0,
    });
  });

  it('o total bate com a soma dos dias', () => {
    const entradas = [
      entry({ amount: 33.33, dueDate: new Date(2026, 0, 10, 12) }),
      entry({ amount: 33.33, dueDate: new Date(2026, 1, 10, 12) }),
      entry({ amount: 33.34, dueDate: new Date(2026, 2, 10, 12) }),
    ];
    const totalDias = groupByDay(entradas).reduce((s, d) => s + d.receivable, 0);
    expect(Math.round(totalDias * 100) / 100).toBe(summarize(entradas).receivable);
    expect(summarize(entradas).receivable).toBe(100);
  });
});
