import {
  applyDownPayment,
  sumPaymentLines,
  resolveFeePercent,
  calcFee,
  applyFees,
  diffStock,
  mergeSaleItems,
  type PaymentLine,
  type FeeRow,
} from '../helpers';

const TAXAS: FeeRow[] = [
  { method: 'DEBIT_CARD', installments: 1, feePercent: 1.99 },
  { method: 'CREDIT_CARD', installments: 1, feePercent: 3.49 },
  { method: 'CREDIT_CARD', installments: 3, feePercent: 5.99 },
];

describe('resolveFeePercent', () => {
  it('dinheiro, PIX e crediário nunca têm taxa', () => {
    expect(resolveFeePercent(TAXAS, 'CASH', 1)).toBe(0);
    expect(resolveFeePercent(TAXAS, 'PIX', 1)).toBe(0);
    expect(resolveFeePercent(TAXAS, 'CREDIARIO', 1)).toBe(0);
  });

  it('acha a linha exata da parcela', () => {
    expect(resolveFeePercent(TAXAS, 'DEBIT_CARD', 1)).toBe(1.99);
    expect(resolveFeePercent(TAXAS, 'CREDIT_CARD', 3)).toBe(5.99);
  });

  it('parcela sem linha cadastrada cai na de 1x', () => {
    expect(resolveFeePercent(TAXAS, 'CREDIT_CARD', 7)).toBe(3.49);
  });

  it('sem tabela nenhuma a taxa é zero — a venda não pode travar', () => {
    expect(resolveFeePercent([], 'CREDIT_CARD', 3)).toBe(0);
  });
});

describe('calcFee', () => {
  it('arredonda ao centavo', () => {
    expect(calcFee(33.33, 3.49)).toBe(1.16);
    expect(calcFee(100, 1.99)).toBe(1.99);
  });

  it('taxa zero não desconta nada', () => {
    expect(calcFee(250, 0)).toBe(0);
  });
});

describe('applyDownPayment', () => {
  const crediario = (amount: number): PaymentLine[] => [
    { method: 'CREDIARIO', amount, installments: 1 },
  ];

  it('sem entrada as linhas ficam intactas', () => {
    const linhas = crediario(300);
    expect(applyDownPayment(linhas, 0, 'CASH')).toEqual(linhas);
  });

  it('a entrada sai do crediário e vira linha à vista', () => {
    const r = applyDownPayment(crediario(300), 100, 'PIX');
    expect(r).toEqual([
      { method: 'CREDIARIO', amount: 200, installments: 1 },
      { method: 'PIX', amount: 100, installments: 1 },
    ]);
  });

  it('a soma continua fechando com o total da venda', () => {
    expect(sumPaymentLines(applyDownPayment(crediario(300), 100, 'CASH'))).toBe(300);
    expect(sumPaymentLines(applyDownPayment(crediario(99.99), 33.33, 'PIX'))).toBe(99.99);
  });

  it('não deixa linha de R$ 0,00 pendurada', () => {
    const r = applyDownPayment(crediario(100), 100, 'CASH');
    expect(r).toHaveLength(1);
    expect(r[0].method).toBe('CASH');
  });

  it('no misto só a linha de crediário perde a entrada', () => {
    const misto: PaymentLine[] = [
      { method: 'PIX', amount: 50, installments: 1 },
      { method: 'CREDIARIO', amount: 150, installments: 1 },
    ];
    const r = applyDownPayment(misto, 50, 'CASH');
    expect(r).toEqual([
      { method: 'PIX', amount: 50, installments: 1 },
      { method: 'CREDIARIO', amount: 100, installments: 1 },
      { method: 'CASH', amount: 50, installments: 1 },
    ]);
    expect(sumPaymentLines(r)).toBe(200);
  });

  it('duas linhas de crediário: a entrada sai de uma só', () => {
    const duas: PaymentLine[] = [
      { method: 'CREDIARIO', amount: 100, installments: 1 },
      { method: 'CREDIARIO', amount: 100, installments: 1 },
    ];
    const r = applyDownPayment(duas, 40, 'CASH');
    // 60 + 100 + 40 = 200, o total original
    expect(sumPaymentLines(r)).toBe(200);
    expect(r.filter((l) => l.method === 'CREDIARIO').map((l) => l.amount)).toEqual([60, 100]);
  });

  it('entrada com centavos não desalinha a soma', () => {
    const r = applyDownPayment(crediario(233.37), 77.79, 'PIX');
    expect(sumPaymentLines(r)).toBe(233.37);
  });
});

describe('applyFees', () => {
  it('calcula taxa e líquido por linha', () => {
    const r = applyFees([{ method: 'CREDIT_CARD', amount: 100, installments: 3 }], TAXAS);
    expect(r[0]).toMatchObject({ feePercent: 5.99, feeAmount: 5.99, netAmount: 94.01 });
  });

  it('no misto cada forma leva a sua taxa', () => {
    const r = applyFees(
      [
        { method: 'CREDIT_CARD', amount: 60, installments: 3 },
        { method: 'PIX', amount: 40, installments: 1 },
      ],
      TAXAS
    );
    expect(r[0].feeAmount).toBe(3.59);
    expect(r[1].feeAmount).toBe(0);
    const totalTaxa = Math.round((r[0].feeAmount + r[1].feeAmount) * 100) / 100;
    expect(totalTaxa).toBe(3.59);
    expect(Math.round((100 - totalTaxa) * 100) / 100).toBe(96.41);
  });

  it('crediário com entrada no cartão: só a entrada paga taxa', () => {
    const linhas = applyDownPayment(
      [{ method: 'CREDIARIO', amount: 300, installments: 1 }],
      100,
      'DEBIT_CARD'
    );
    const r = applyFees(linhas, TAXAS);
    const crediarioLinha = r.find((l) => l.method === 'CREDIARIO')!;
    const entradaLinha = r.find((l) => l.method === 'DEBIT_CARD')!;
    expect(crediarioLinha.feeAmount).toBe(0);
    expect(entradaLinha.feeAmount).toBe(1.99);
    expect(sumPaymentLines(r)).toBe(300);
  });
});

describe('diffStock', () => {
  it('venda sem mudança de itens não mexe no estoque', () => {
    const itens = [{ productId: 'a', quantity: 2 }];
    expect(diffStock(itens, itens)).toEqual([]);
  });

  it('remover um item devolve tudo ao estoque', () => {
    expect(diffStock([{ productId: 'a', quantity: 3 }], [])).toEqual([
      { productId: 'a', delta: 3 },
    ]);
  });

  it('adicionar um item tira do estoque', () => {
    expect(diffStock([], [{ productId: 'b', quantity: 2 }])).toEqual([
      { productId: 'b', delta: -2 },
    ]);
  });

  it('aumentar a quantidade tira só a diferença, não o total', () => {
    // 2 viram 3: o estoque precisa de -1, não de +2 e depois -3
    expect(diffStock([{ productId: 'a', quantity: 2 }], [{ productId: 'a', quantity: 3 }]))
      .toEqual([{ productId: 'a', delta: -1 }]);
  });

  it('reduzir a quantidade devolve só a diferença', () => {
    expect(diffStock([{ productId: 'a', quantity: 5 }], [{ productId: 'a', quantity: 2 }]))
      .toEqual([{ productId: 'a', delta: 3 }]);
  });

  it('troca de produto: um volta, o outro sai', () => {
    const r = diffStock(
      [{ productId: 'a', quantity: 1 }],
      [{ productId: 'b', quantity: 1 }]
    );
    expect(r).toEqual(
      expect.arrayContaining([
        { productId: 'a', delta: 1 },
        { productId: 'b', delta: -1 },
      ])
    );
    expect(r).toHaveLength(2);
  });

  it('edição complexa: um sai, um entra, um muda, um fica igual', () => {
    const antes = [
      { productId: 'sai', quantity: 2 },
      { productId: 'muda', quantity: 4 },
      { productId: 'igual', quantity: 1 },
    ];
    const depois = [
      { productId: 'muda', quantity: 1 },
      { productId: 'igual', quantity: 1 },
      { productId: 'entra', quantity: 3 },
    ];
    const r = diffStock(antes, depois);
    expect(r).toEqual(
      expect.arrayContaining([
        { productId: 'sai', delta: 2 },
        { productId: 'muda', delta: 3 },
        { productId: 'entra', delta: -3 },
      ])
    );
    // 'igual' não aparece — nada a ajustar
    expect(r.find((d) => d.productId === 'igual')).toBeUndefined();
    expect(r).toHaveLength(3);
  });

  it('o saldo total de unidades bate com a diferença da venda', () => {
    const antes = [{ productId: 'a', quantity: 3 }, { productId: 'b', quantity: 2 }];
    const depois = [{ productId: 'a', quantity: 1 }, { productId: 'c', quantity: 4 }];
    const totalAntes = antes.reduce((s, i) => s + i.quantity, 0); // 5
    const totalDepois = depois.reduce((s, i) => s + i.quantity, 0); // 5
    const somaDeltas = diffStock(antes, depois).reduce((s, d) => s + d.delta, 0);
    expect(somaDeltas).toBe(totalAntes - totalDepois);
  });
});

describe('mergeSaleItems', () => {
  it('soma linhas repetidas do mesmo produto', () => {
    expect(
      mergeSaleItems([
        { productId: 'a', quantity: 1 },
        { productId: 'b', quantity: 2 },
        { productId: 'a', quantity: 3 },
      ])
    ).toEqual([
      { productId: 'a', quantity: 4 },
      { productId: 'b', quantity: 2 },
    ]);
  });

  it('sem repetição devolve a mesma lista', () => {
    const itens = [{ productId: 'a', quantity: 1 }, { productId: 'b', quantity: 2 }];
    expect(mergeSaleItems(itens)).toEqual(itens);
  });

  it('agrupar antes do diff evita contar só a última linha', () => {
    const depoisDuplicado = [
      { productId: 'a', quantity: 1 },
      { productId: 'a', quantity: 1 },
    ];
    // Sem agrupar, o Map do diff sobrescreveria e daria -1 em vez de -2
    expect(diffStock([], mergeSaleItems(depoisDuplicado))).toEqual([
      { productId: 'a', delta: -2 },
    ]);
  });
});
