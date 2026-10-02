/**
 * Montagem das linhas de pagamento de uma venda.
 *
 * Separado do serviço para ser testável sem banco: é aqui que a soma das
 * formas precisa fechar com o total da venda, e um centavo fora já quebra o
 * fechamento de caixa.
 */

export type PaymentMethodValue =
  | 'CASH' | 'PIX' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'CREDIARIO' | 'MIXED';

export interface PaymentLine {
  method: PaymentMethodValue;
  amount: number;
  installments: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Aplica a entrada do crediário: tira o valor da linha de crediário e cria
 * uma linha à vista na forma escolhida.
 *
 * A entrada não vira parcela porque o dinheiro entrou HOJE — precisa aparecer
 * no caixa do dia, e não só quando a primeira parcela vencer. Linhas que
 * zeram são descartadas (entrada igual ao crediário inteiro não deixa uma
 * linha de R$ 0,00 pendurada).
 */
export function applyDownPayment(
  linhas: PaymentLine[],
  downPayment: number,
  downPaymentMethod: PaymentMethodValue
): PaymentLine[] {
  if (downPayment <= 0) return linhas;

  // Desconta de UMA linha só. Um payload misto com duas linhas de crediário
  // perderia a entrada duas vezes se o map descontasse de todas.
  let jaDescontou = false;

  return [
    ...linhas.map((l) => {
      if (l.method !== 'CREDIARIO' || jaDescontou) return l;
      jaDescontou = true;
      return { ...l, amount: round2(l.amount - downPayment) };
    }),
    { method: downPaymentMethod, amount: downPayment, installments: 1 },
  ].filter((l) => l.amount > 0);
}

/** Soma das linhas, arredondada ao centavo. */
export function sumPaymentLines(linhas: PaymentLine[]): number {
  return round2(linhas.reduce((acc, l) => acc + l.amount, 0));
}

export interface FeeRow {
  method: 'DEBIT_CARD' | 'CREDIT_CARD';
  installments: number;
  feePercent: number;
}

/**
 * Taxa de uma forma, em %. Procura a linha exata da parcela e, não achando,
 * cai na de 1x. Sem tabela cadastrada a taxa é zero: a loja começa vazia e a
 * venda não pode travar por isso.
 */
export function resolveFeePercent(
  fees: FeeRow[],
  method: PaymentMethodValue,
  installments: number
): number {
  if (method !== 'DEBIT_CARD' && method !== 'CREDIT_CARD') return 0;
  const exata = fees.find((f) => f.method === method && f.installments === installments);
  if (exata) return exata.feePercent;
  return fees.find((f) => f.method === method && f.installments === 1)?.feePercent ?? 0;
}

/** Quanto a maquininha fica, arredondado ao centavo. */
export function calcFee(amount: number, feePercent: number): number {
  if (feePercent <= 0) return 0;
  return round2(amount * (feePercent / 100));
}

export interface PaymentLineWithFee extends PaymentLine {
  feePercent: number;
  feeAmount: number;
  netAmount: number;
}

/** Aplica a tabela de taxas a cada linha de pagamento. */
export function applyFees(linhas: PaymentLine[], fees: FeeRow[]): PaymentLineWithFee[] {
  return linhas.map((l) => {
    const feePercent = resolveFeePercent(fees, l.method, l.installments);
    const feeAmount = calcFee(l.amount, feePercent);
    return { ...l, feePercent, feeAmount, netAmount: round2(l.amount - feeAmount) };
  });
}

// ─── Edição de venda ────────────────────────────────────────

export interface SaleItemSnapshot {
  productId: string;
  quantity: number;
}

export interface StockDelta {
  productId: string;
  /** Positivo devolve ao estoque, negativo tira. */
  delta: number;
}

/**
 * Diferença de estoque entre a venda como está e como vai ficar.
 *
 * Editar uma venda não é cancelar e refazer: se a cliente trocou 2 peças por
 * 3, o estoque precisa de -1, não de +2 seguido de -3 (o que daria negativo no
 * meio do caminho e poderia barrar a edição por falta de estoque).
 *
 * Positivo = volta para a prateleira (item removido ou quantidade reduzida).
 * Negativo = sai da prateleira (item novo ou quantidade aumentada).
 */
export function diffStock(
  antes: SaleItemSnapshot[],
  depois: SaleItemSnapshot[]
): StockDelta[] {
  const mapa = new Map<string, number>();

  // Itens que saíram da venda voltam para o estoque
  for (const item of antes) {
    mapa.set(item.productId, (mapa.get(item.productId) ?? 0) + item.quantity);
  }
  // Itens que ficaram na venda saem do estoque
  for (const item of depois) {
    mapa.set(item.productId, (mapa.get(item.productId) ?? 0) - item.quantity);
  }

  return Array.from(mapa.entries())
    .filter(([, delta]) => delta !== 0)
    .map(([productId, delta]) => ({ productId, delta }));
}

/**
 * Agrupa itens repetidos do mesmo produto somando a quantidade.
 *
 * A tela deixa adicionar o mesmo produto duas vezes sem querer; sem agrupar,
 * o diff de estoque contaria só a última linha.
 */
export function mergeSaleItems<T extends SaleItemSnapshot>(itens: T[]): T[] {
  const mapa = new Map<string, T>();
  for (const item of itens) {
    const existente = mapa.get(item.productId);
    if (existente) {
      mapa.set(item.productId, {
        ...existente,
        quantity: existente.quantity + item.quantity,
      });
    } else {
      mapa.set(item.productId, { ...item });
    }
  }
  return Array.from(mapa.values());
}
