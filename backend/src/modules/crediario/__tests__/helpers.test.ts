import {
  splitInstallments,
  monthlyDueDates,
  dueDatesFor,
  planInstallments,
  computeRenegotiationTotal,
} from '../helpers';

/** Formata só a data, para as asserções não dependerem de hora/fuso. */
function ymd(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

const soma = (ns: number[]) => Math.round(ns.reduce((a, b) => a + b, 0) * 100) / 100;

describe('splitInstallments', () => {
  it('fecha exatamente com o total mesmo quando não divide redondo', () => {
    expect(splitInstallments(100, 3)).toEqual([33.34, 33.33, 33.33]);
    expect(soma(splitInstallments(100, 3))).toBe(100);
  });

  it('joga os centavos que sobram nas PRIMEIRAS parcelas', () => {
    const p = splitInstallments(10, 4);
    expect(p).toEqual([2.5, 2.5, 2.5, 2.5]);
    // A última nunca pode ser a maior — é a convenção do comércio
    const p2 = splitInstallments(0.05, 2);
    expect(p2[0]).toBeGreaterThanOrEqual(p2[1]);
  });

  it('parcela única devolve o total inteiro', () => {
    expect(splitInstallments(249.9, 1)).toEqual([249.9]);
  });

  it('valores quebrados continuam fechando', () => {
    for (const total of [0.01, 7.77, 199.99, 1234.56]) {
      for (const n of [1, 2, 3, 5, 6, 7, 12]) {
        expect(soma(splitInstallments(total, n))).toBe(total);
      }
    }
  });

  it('recusa número de parcelas inválido', () => {
    expect(() => splitInstallments(100, 0)).toThrow();
  });
});

describe('monthlyDueDates', () => {
  it('anda de mês em mês mantendo o dia', () => {
    const datas = monthlyDueDates(new Date(2026, 0, 10, 12), 3);
    expect(datas.map(ymd)).toEqual(['2026-01-10', '2026-02-10', '2026-03-10']);
  });

  it('dia 31 em fevereiro cai no último dia, não escorrega para março', () => {
    const datas = monthlyDueDates(new Date(2026, 0, 31, 12), 3);
    expect(datas.map(ymd)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('respeita ano bissexto', () => {
    const datas = monthlyDueDates(new Date(2028, 0, 31, 12), 2);
    expect(datas.map(ymd)).toEqual(['2028-01-31', '2028-02-29']);
  });

  it('vira o ano corretamente', () => {
    const datas = monthlyDueDates(new Date(2026, 10, 15, 12), 4);
    expect(datas.map(ymd)).toEqual(['2026-11-15', '2026-12-15', '2027-01-15', '2027-02-15']);
  });
});

describe('dueDatesFor', () => {
  it('quinzenal soma 15 dias corridos — o caso da Monique', () => {
    const datas = dueDatesFor(new Date(2026, 0, 5, 12), 4, 'BIWEEKLY');
    expect(datas.map(ymd)).toEqual(['2026-01-05', '2026-01-20', '2026-02-04', '2026-02-19']);
  });

  it('semanal soma 7 dias e atravessa o mês', () => {
    const datas = dueDatesFor(new Date(2026, 0, 28, 12), 3, 'WEEKLY');
    expect(datas.map(ymd)).toEqual(['2026-01-28', '2026-02-04', '2026-02-11']);
  });

  it('mensal delega para monthlyDueDates', () => {
    const a = dueDatesFor(new Date(2026, 0, 31, 12), 3, 'MONTHLY').map(ymd);
    const b = monthlyDueDates(new Date(2026, 0, 31, 12), 3).map(ymd);
    expect(a).toEqual(b);
  });

  it('todas as datas caem ao meio-dia, para o fuso não virar o dia', () => {
    for (const f of ['WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const) {
      for (const d of dueDatesFor(new Date(2026, 5, 10, 8), 3, f)) {
        expect(d.getHours()).toBe(12);
      }
    }
  });
});

describe('planInstallments', () => {
  it('numera de 1 a N e guarda o total de parcelas', () => {
    const plano = planInstallments(300, 3, new Date(2026, 0, 10, 12));
    expect(plano.map((p) => p.number)).toEqual([1, 2, 3]);
    expect(plano.every((p) => p.totalCount === 3)).toBe(true);
  });

  it('a soma das parcelas é igual ao valor financiado', () => {
    const plano = planInstallments(100, 3, new Date(2026, 0, 10, 12));
    expect(soma(plano.map((p) => p.amount))).toBe(100);
  });

  it('aceita frequência quinzenal', () => {
    const plano = planInstallments(150, 3, new Date(2026, 0, 5, 12), 'BIWEEKLY');
    expect(plano.map((p) => ymd(p.dueDate))).toEqual(['2026-01-05', '2026-01-20', '2026-02-04']);
  });

  it('sem frequência informada continua mensal (compatibilidade)', () => {
    const plano = planInstallments(150, 2, new Date(2026, 0, 5, 12));
    expect(plano.map((p) => ymd(p.dueDate))).toEqual(['2026-01-05', '2026-02-05']);
  });
});

describe('computeRenegotiationTotal', () => {
  it('soma as parcelas em aberto sem erro de ponto flutuante', () => {
    // 0.1 + 0.2 em float dá 0.30000000000000004
    const { somaAntiga } = computeRenegotiationTotal([0.1, 0.2], 0);
    expect(somaAntiga).toBe(0.3);
  });

  it('soma um crediário típico de 3 parcelas quebradas', () => {
    const { somaAntiga, novoTotal } = computeRenegotiationTotal([33.34, 33.33, 33.33], 0);
    expect(somaAntiga).toBe(100);
    expect(novoTotal).toBe(100);
  });

  it('aplica desconto (ajuste negativo)', () => {
    const { novoTotal } = computeRenegotiationTotal([100, 50], -30);
    expect(novoTotal).toBe(120);
  });

  it('aplica acréscimo (juros de atraso)', () => {
    const { novoTotal } = computeRenegotiationTotal([100, 50], 12.5);
    expect(novoTotal).toBe(162.5);
  });

  it('ajuste com centavos não perde precisão', () => {
    const { novoTotal } = computeRenegotiationTotal([19.99, 19.99, 19.99], -0.97);
    expect(novoTotal).toBe(59);
  });
});

describe('renegociação ponta a ponta (matemática)', () => {
  const soma2 = (ns: number[]) => Math.round(ns.reduce((a, b) => a + b, 0) * 100) / 100;

  it('o novo plano fecha exatamente com o total renegociado', () => {
    const { novoTotal } = computeRenegotiationTotal([33.34, 33.33, 33.33, 89.9], -7);
    const plano = planInstallments(novoTotal, 4, new Date(2026, 2, 10, 12), 'BIWEEKLY');
    expect(soma2(plano.map((p) => p.amount))).toBe(novoTotal);
  });

  it('juntar 5 parcelas em 1 preserva o valor total', () => {
    const antigas = [12.34, 56.78, 90.12, 34.56, 78.9];
    const { somaAntiga, novoTotal } = computeRenegotiationTotal(antigas, 0);
    expect(somaAntiga).toBe(272.7);
    const plano = planInstallments(novoTotal, 1, new Date(2026, 3, 1, 12));
    expect(plano).toHaveLength(1);
    expect(plano[0].amount).toBe(272.7);
  });

  it('quinzenal a partir de 31/01 não cai em data inválida', () => {
    const plano = planInstallments(300, 4, new Date(2026, 0, 31, 12), 'BIWEEKLY');
    const dias = plano.map((p) => p.dueDate.getDate());
    expect(dias).toEqual([31, 15, 2, 17]);
    expect(plano.every((p) => !isNaN(p.dueDate.getTime()))).toBe(true);
  });
});
