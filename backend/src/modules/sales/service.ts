import { Prisma } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError, NotFoundError } from '../../shared/errors/AppError';
import { createAuditLog } from '../../shared/utils/auditLog';
import { planInstallments } from '../crediario/helpers';
import { listCardFees } from '../cardFees/service';
import {
  applyDownPayment, applyFees, sumPaymentLines, diffStock, mergeSaleItems,
  type PaymentLine, type PaymentMethodValue,
} from './helpers';
import type {
  CreateSaleInput, UpdateSaleInput, CancelSaleInput, ListSalesInput,
} from './validator';


/** Arredonda ao centavo — dinheiro em float acumula resíduo. */
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function listSales(params: ListSalesInput) {
  const { page, limit, startDate, endDate, paymentMethod, status, minTotal, maxTotal, sortBy, sortOrder } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.SaleWhereInput = {
    ...(status && { status }),
    ...(paymentMethod && { paymentMethod }),
    ...(minTotal !== undefined && { total: { gte: minTotal } }),
    ...(maxTotal !== undefined && { total: { lte: maxTotal } }),
    ...((startDate || endDate) && {
      createdAt: {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate + 'T23:59:59.999Z') }),
      },
    }),
  };

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder } as Prisma.SaleOrderByWithRelationInput,
      include: {
        user: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        payments: true,
      },
    }),
    prisma.sale.count({ where }),
  ]);

  return {
    sales,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getSaleById(id: string) {
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true, imageUrl: true } } } },
      payments: true,
    },
  });

  if (!sale) throw new NotFoundError('Venda');
  return sale;
}

export async function getSalesSummary(startDate?: string, endDate?: string) {
  const start = startDate ? new Date(startDate) : new Date(new Date().setHours(0, 0, 0, 0));
  const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date(new Date().setHours(23, 59, 59, 999));

  const [summary] = await prisma.$queryRaw<Array<{
    total_sales: bigint;
    total_revenue: number;
    total_discount: number;
    avg_ticket: number;
    cancelled_count: bigint;
    total_fee: number;
    total_net: number;
  }>>`
    SELECT
      COUNT(*) FILTER (WHERE status = 'COMPLETED') as total_sales,
      COALESCE(SUM(total) FILTER (WHERE status = 'COMPLETED'), 0) as total_revenue,
      COALESCE(SUM(discount_amount) FILTER (WHERE status = 'COMPLETED'), 0) as total_discount,
      COALESCE(AVG(total) FILTER (WHERE status = 'COMPLETED'), 0) as avg_ticket,
      COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled_count,
      -- Taxa da maquininha e o que sobra de fato
      COALESCE(SUM(fee_amount) FILTER (WHERE status = 'COMPLETED'), 0) as total_fee,
      COALESCE(SUM(net_total) FILTER (WHERE status = 'COMPLETED'), 0) as total_net
    FROM sales
    WHERE created_at BETWEEN ${start} AND ${end}
  `;

  return {
    totalSales: Number(summary.total_sales),
    totalRevenue: Number(summary.total_revenue),
    totalDiscount: Number(summary.total_discount),
    avgTicket: Number(summary.avg_ticket),
    cancelledCount: Number(summary.cancelled_count),
    totalFee: Number(summary.total_fee),
    netRevenue: Number(summary.total_net),
    period: { start, end },
  };
}

export async function createSale(
  input: CreateSaleInput,
  userId: string,
  userRole: UserRole = 'EMPLOYEE'
) {
  /**
   * Agrupa linhas repetidas do mesmo produto ANTES de validar.
   *
   * Sem isso, duas linhas de 3 unidades passavam na checagem individual
   * contra um estoque de 4 e a baixa levava o produto para -2. A tela já
   * agrupa no carrinho, mas a validação não pode depender disso.
   */
  const itensVenda = mergeSaleItems(
    input.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
    }))
  );

  // Buscar produtos e validar estoque
  const productIds = itensVenda.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, deletedAt: null, status: 'ACTIVE' },
  });

  if (products.length !== productIds.length) {
    throw new AppError('Um ou mais produtos não encontrados ou inativos', 400);
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Verificar estoque
  for (const item of itensVenda) {
    const product = productMap.get(item.productId)!;
    if (product.quantity < item.quantity) {
      throw new AppError(
        `Estoque insuficiente para "${product.name}". Disponível: ${product.quantity}`,
        400
      );
    }
  }

  // Preço: só OWNER pode vender por valor diferente do cadastrado.
  //
  // Sem esta checagem qualquer usuário poderia mandar unitPrice arbitrário na
  // requisição, porque o valor vem do cliente. Para EMPLOYEE o preço é sempre
  // o do produto; os overrides do OWNER ficam registrados no AuditLog.
  const priceOverrides: Array<{
    sku: string;
    name: string;
    originalPrice: number;
    soldPrice: number;
  }> = [];

  for (const item of itensVenda) {
    const product = productMap.get(item.productId)!;
    const catalogPrice = Number(product.salePrice);
    // tolerância de 1 centavo para não brigar com arredondamento de float
    const differs = Math.abs(item.unitPrice - catalogPrice) > 0.005;

    if (!differs) continue;

    if (userRole !== 'OWNER') {
      throw new AppError(
        `Você não tem permissão para alterar o preço de "${product.name}". ` +
          `Preço cadastrado: ${catalogPrice.toFixed(2)}`,
        403
      );
    }

    priceOverrides.push({
      sku: product.sku,
      name: product.name,
      originalPrice: catalogPrice,
      soldPrice: item.unitPrice,
    });
  }

  // Calcular totais
  const subtotal = round2(
    itensVenda.reduce((acc, item) => {
      const itemTotal = item.unitPrice * item.quantity - item.discount;
      return acc + Math.max(0, itemTotal);
    }, 0)
  );

  // Desconto: percentual tem prioridade quando informado, e o valor em reais é
  // derivado dele. Guardar os dois deixa o histórico legível ("10% = R$ 30,00").
  const discountAmount =
    input.discountPercent !== undefined && input.discountPercent > 0
      ? Math.round(subtotal * (input.discountPercent / 100) * 100) / 100
      : (input.discountAmount ?? 0);

  if (discountAmount > subtotal) {
    throw new AppError('O desconto não pode ser maior que o subtotal', 400);
  }

  const total = round2(Math.max(0, subtotal - discountAmount));

  // Pagamento misto: a soma das formas precisa fechar com o total da venda.
  // Sem esta checagem a venda entrava com valores que não batiam com o caixa.
  if (input.paymentMethod === 'MIXED') {
    const somaPagamentos = (input.payments ?? []).reduce((acc, p) => acc + p.amount, 0);
    if (Math.abs(somaPagamentos - total) > 0.005) {
      throw new AppError(
        `A soma das formas de pagamento (${somaPagamentos.toFixed(2)}) não confere ` +
          `com o total da venda (${total.toFixed(2)})`,
        400
      );
    }
  }

  // Quanto da venda vai para o crediário
  const crediarioAmount =
    input.paymentMethod === 'CREDIARIO'
      ? total
      : (input.payments ?? [])
          .filter((p) => p.method === 'CREDIARIO')
          .reduce((acc, p) => acc + p.amount, 0);

  const usaCrediario = crediarioAmount > 0;

  if (usaCrediario && !input.customerId) {
    throw new AppError('Venda no crediário exige um cliente', 400);
  }

  /**
   * Entrada: sai do valor financiado e vira pagamento à vista.
   *
   * Ela precisa aparecer no caixa do dia, senão o dinheiro que entrou na hora
   * ficaria invisível até a primeira parcela vencer. Por isso não é parcela —
   * é uma linha a mais em `payments`.
   */
  const downPayment = usaCrediario ? Math.min(input.downPayment ?? 0, crediarioAmount) : 0;

  if (downPayment > 0 && downPayment >= crediarioAmount) {
    throw new AppError(
      'A entrada não pode cobrir o crediário inteiro — nesse caso registre a venda à vista',
      400
    );
  }

  const valorFinanciado = Math.round((crediarioAmount - downPayment) * 100) / 100;

  let plano: ReturnType<typeof planInstallments> = [];
  if (usaCrediario) {
    const count = input.crediarioCount ?? 1;
    const frequency = input.crediarioFrequency ?? 'MONTHLY';

    // Sem data informada, a primeira parcela vence conforme a cadência:
    // 30 dias no mensal, 15 no quinzenal, 7 no semanal
    const diasPadrao = frequency === 'WEEKLY' ? 7 : frequency === 'BIWEEKLY' ? 15 : 30;
    const firstDue = input.crediarioFirstDueDate
      ? new Date(`${input.crediarioFirstDueDate}T12:00:00`)
      : new Date(Date.now() + diasPadrao * 24 * 60 * 60 * 1000);

    if (isNaN(firstDue.getTime())) {
      throw new AppError('Data de vencimento inválida', 400);
    }

    plano = planInstallments(valorFinanciado, count, firstDue, frequency);
  }

  /**
   * Taxa da maquininha por forma de pagamento.
   *
   * Passar no cartão significa receber menos, e antes o sistema registrava
   * o valor cheio — o caixa nunca batia. A taxa vigente é congelada na venda
   * porque a tabela muda com o tempo e o histórico tem que refletir o que a
   * operadora cobrou naquele dia.
   */
  const tabelaTaxas = await listCardFees();

  const linhasBase: PaymentLine[] =
    input.paymentMethod === 'MIXED' && input.payments
      ? input.payments.map((p) => ({
          method: p.method as PaymentMethodValue,
          amount: p.amount,
          installments:
            p.method === 'CREDIT_CARD' ? (p.installments ?? input.installments ?? 1) : 1,
        }))
      : [{
          method: input.paymentMethod as PaymentMethodValue,
          amount: total,
          installments: input.paymentMethod === 'CREDIT_CARD' ? (input.installments ?? 1) : 1,
        }];

  const linhasPagamento = applyDownPayment(
    linhasBase,
    downPayment,
    input.downPaymentMethod as PaymentMethodValue
  );

  // Rede de segurança: se a entrada ou a taxa desalinharem a soma, é melhor
  // recusar a venda do que gravar um caixa que não fecha
  if (Math.abs(sumPaymentLines(linhasPagamento) - total) > 0.005) {
    throw new AppError('A soma das formas de pagamento não fecha com o total da venda', 400);
  }

  const pagamentosComTaxa = applyFees(linhasPagamento, tabelaTaxas);

  const feeAmountTotal =
    Math.round(pagamentosComTaxa.reduce((acc, p) => acc + p.feeAmount, 0) * 100) / 100;
  const netTotal = Math.round((total - feeAmountTotal) * 100) / 100;

  // Executar em transação atômica
  const sale = await prisma.$transaction(async (tx) => {
    // Criar a venda
    const newSale = await tx.sale.create({
      data: {
        userId,
        customerId: input.customerId,
        subtotal,
        discountAmount,
        discountPercent: input.discountPercent,
        total,
        feeAmount: feeAmountTotal,
        netTotal,
        downPayment,
        installmentFrequency: usaCrediario ? (input.crediarioFrequency ?? 'MONTHLY') : null,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
        items: {
          create: itensVenda.map((item) => {
            const product = productMap.get(item.productId)!;
            const itemTotal = item.unitPrice * item.quantity - item.discount;
            return {
              productId: item.productId,
              productName: product.name,
              productSku: product.sku,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              costPrice: Number(product.costPrice),
              discount: item.discount,
              total: Math.max(0, itemTotal),
            };
          }),
        },
        payments: { create: pagamentosComTaxa },
      },
      include: {
        items: true,
        payments: true,
      },
    });

    // Parcelas do crediário — dentro da mesma transação da venda, senão pode
    // sobrar venda sem parcela caso algo falhe no meio
    if (plano.length > 0) {
      await tx.installment.createMany({
        data: plano.map((p) => ({
          saleId: newSale.id,
          customerId: input.customerId!,
          number: p.number,
          totalCount: p.totalCount,
          amount: p.amount,
          dueDate: p.dueDate,
        })),
      });
    }

    // Baixa de estoque para cada item (já agrupado, uma linha por produto)
    for (const item of itensVenda) {
      await tx.product.update({
        where: { id: item.productId },
        data: { quantity: { decrement: item.quantity } },
      });
    }

    return newSale;
  });

  await createAuditLog({
    prisma,
    action: 'SALE',
    entityType: 'sale',
    entityId: sale.id,
    userId,
    metadata: {
      saleNumber: sale.saleNumber,
      total,
      itemCount: itensVenda.length,
      ...(priceOverrides.length > 0 && { priceOverrides }),
      ...(discountAmount > 0 && {
        desconto: input.discountPercent
          ? `${input.discountPercent}% (R$ ${discountAmount.toFixed(2)})`
          : `R$ ${discountAmount.toFixed(2)}`,
      }),
      ...(usaCrediario && {
        crediario: {
          valor: crediarioAmount,
          parcelas: plano.length,
          primeiroVencimento: plano[0]?.dueDate,
        },
      }),
    } as object,
  });

  return sale;
}

export async function cancelSale(id: string, input: CancelSaleInput, userId: string) {
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { items: true, installments: true },
  });

  if (!sale) throw new NotFoundError('Venda');
  if (sale.status === 'CANCELLED') {
    throw new AppError('Esta venda já foi cancelada', 400);
  }

  /**
   * Parcela já recebida trava o estorno.
   *
   * Cancelar a venda não devolve o dinheiro que entrou: a parcela paga ficaria
   * órfã, apontando para uma venda que não existe mais. Quem precisa estornar
   * reabre a parcela primeiro, decidindo conscientemente o que fazer com o
   * valor recebido.
   */
  const pagas = sale.installments.filter((i) => i.status === 'PAID');
  if (pagas.length > 0) {
    throw new AppError(
      `Esta venda tem ${pagas.length} parcela(s) já paga(s). ` +
        'Reabra as parcelas no Crediário antes de estornar a venda.',
      400
    );
  }

  // Executar em transação: cancelar venda + devolver estoque + matar parcelas
  await prisma.$transaction(async (tx) => {
    await tx.sale.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: input.reason,
      },
    });

    // Devolver estoque
    for (const item of sale.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { quantity: { increment: item.quantity } },
      });
    }

    /**
     * As parcelas em aberto morrem junto com a venda.
     *
     * Sem isso a cliente continuava aparecendo como devedora, e o valor seguia
     * contando em "a receber" e no calendário, de uma venda que foi estornada.
     */
    if (sale.installments.length > 0) {
      await tx.installment.updateMany({
        where: { saleId: id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
    }
  });

  await createAuditLog({
    prisma,
    action: 'SALE_CANCEL',
    entityType: 'sale',
    entityId: id,
    userId,
    metadata: {
      reason: input.reason,
      saleNumber: sale.saleNumber,
      ...(sale.installments.length > 0 && {
        parcelasCanceladas: sale.installments.filter((i) => i.status === 'PENDING').length,
      }),
    } as object,
  });

  return {
    message:
      sale.installments.length > 0
        ? 'Venda cancelada. Estoque devolvido e parcelas do crediário canceladas.'
        : 'Venda cancelada com sucesso. Estoque devolvido.',
  };
}

/**
 * Edita uma venda já registrada, ajustando o estoque pela diferença.
 *
 * Só OWNER. A alternativa era estornar e refazer, mas isso duplica a venda no
 * histórico e some com o número original — a loja precisa conseguir corrigir
 * "vendi 2 e era 3" sem virar duas vendas.
 *
 * Ajusta pela DIFERENÇA (ver diffStock), não devolvendo tudo e tirando de
 * novo: trocar 2 por 3 pede -1 no estoque, e o caminho "devolve 2, tira 3"
 * poderia falhar por falta de estoque no meio.
 *
 * Venda cancelada ou com crediário não pode ser editada — nesses casos as
 * parcelas (e possíveis baixas) teriam que ser refeitas, o que é estorno.
 */
export async function updateSale(
  id: string,
  input: UpdateSaleInput,
  userId: string,
  userRole: UserRole = 'EMPLOYEE'
) {
  if (userRole !== 'OWNER') {
    throw new AppError('Apenas o dono pode editar uma venda registrada', 403);
  }

  const venda = await prisma.sale.findUnique({
    where: { id },
    include: { items: true, payments: true, installments: true },
  });

  if (!venda) throw new NotFoundError('Venda');
  if (venda.status === 'CANCELLED') {
    throw new AppError('Venda cancelada não pode ser editada', 400);
  }
  if (venda.installments.length > 0) {
    throw new AppError(
      'Venda no crediário não pode ser editada — estorne e registre de novo',
      400
    );
  }

  // Agrupa repetições antes de qualquer conta: a tela deixa somar o mesmo
  // produto duas vezes e o diff contaria só a última linha
  const itensNovos = mergeSaleItems(
    input.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
    }))
  );

  const produtos = await prisma.product.findMany({
    where: { id: { in: itensNovos.map((i) => i.productId) }, deletedAt: null },
  });
  const produtoPorId = new Map(produtos.map((p) => [p.id, p]));

  if (produtos.length !== itensNovos.length) {
    throw new AppError('Um ou mais produtos não foram encontrados', 400);
  }

  const deltas = diffStock(
    venda.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    itensNovos
  );

  // Estoque insuficiente precisa barrar ANTES de gravar qualquer coisa
  for (const d of deltas) {
    if (d.delta >= 0) continue;
    const produto = produtoPorId.get(d.productId);
    if (!produto) throw new AppError('Produto da venda não encontrado', 400);
    if (produto.quantity + d.delta < 0) {
      throw new AppError(
        `Estoque insuficiente de "${produto.name}": há ${produto.quantity}, ` +
          `faltam ${Math.abs(d.delta) - produto.quantity}`,
        400
      );
    }
  }

  // Totais
  const subtotal = itensNovos.reduce(
    (acc, i) => acc + Math.max(0, i.unitPrice * i.quantity - i.discount),
    0
  );
  const discountAmount =
    input.discountPercent !== undefined && input.discountPercent > 0
      ? Math.round(subtotal * (input.discountPercent / 100) * 100) / 100
      : (input.discountAmount ?? 0);

  if (discountAmount > subtotal) {
    throw new AppError('O desconto não pode ser maior que o subtotal', 400);
  }

  const total = Math.round(Math.max(0, subtotal - discountAmount) * 100) / 100;

  const linhas: PaymentLine[] =
    input.paymentMethod === 'MIXED' && input.payments
      ? input.payments.map((p) => ({
          method: p.method as PaymentMethodValue,
          amount: p.amount,
          installments:
            p.method === 'CREDIT_CARD' ? (p.installments ?? input.installments ?? 1) : 1,
        }))
      : [{
          method: input.paymentMethod as PaymentMethodValue,
          amount: total,
          installments: input.paymentMethod === 'CREDIT_CARD' ? (input.installments ?? 1) : 1,
        }];

  if (Math.abs(sumPaymentLines(linhas) - total) > 0.005) {
    throw new AppError(
      `A soma das formas de pagamento (${sumPaymentLines(linhas).toFixed(2)}) não ` +
        `confere com o total da venda (${total.toFixed(2)})`,
      400
    );
  }

  const tabelaTaxas = await listCardFees();
  const pagamentosComTaxa = applyFees(linhas, tabelaTaxas);
  const feeAmountTotal =
    Math.round(pagamentosComTaxa.reduce((acc, p) => acc + p.feeAmount, 0) * 100) / 100;
  const netTotal = Math.round((total - feeAmountTotal) * 100) / 100;

  const antes = {
    total: Number(venda.total),
    subtotal: Number(venda.subtotal),
    desconto: Number(venda.discountAmount),
    formaPagamento: venda.paymentMethod,
    itens: venda.items.map((i) => ({
      sku: i.productSku,
      nome: i.productName,
      quantidade: i.quantity,
      precoUnitario: Number(i.unitPrice),
    })),
  };

  const atualizada = await prisma.$transaction(async (tx) => {
    // Ajuste de estoque pela diferença
    for (const d of deltas) {
      await tx.product.update({
        where: { id: d.productId },
        data: { quantity: { increment: d.delta } },
      });
    }

    // Itens e pagamentos são recriados: a venda editada é o retrato novo,
    // e o retrato antigo fica no AuditLog
    await tx.saleItem.deleteMany({ where: { saleId: id } });
    await tx.salePayment.deleteMany({ where: { saleId: id } });

    return tx.sale.update({
      where: { id },
      data: {
        subtotal,
        discountAmount,
        discountPercent: input.discountPercent ?? null,
        total,
        feeAmount: feeAmountTotal,
        netTotal,
        paymentMethod: input.paymentMethod,
        notes: input.notes ?? null,
        customerId: input.customerId ?? null,
        items: {
          create: itensNovos.map((i) => {
            const produto = produtoPorId.get(i.productId)!;
            return {
              productId: i.productId,
              productName: produto.name,
              productSku: produto.sku,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              costPrice: Number(produto.costPrice),
              discount: i.discount,
              total: Math.max(0, i.unitPrice * i.quantity - i.discount),
            };
          }),
        },
        payments: { create: pagamentosComTaxa },
      },
      include: { items: true, payments: true },
    });
  });

  await createAuditLog({
    prisma,
    action: 'UPDATE',
    entityType: 'sale',
    entityId: id,
    userId,
    metadata: {
      acao: 'edição de venda',
      venda: venda.saleNumber,
      motivo: input.reason,
      antes,
      depois: {
        total,
        subtotal,
        desconto: discountAmount,
        formaPagamento: input.paymentMethod,
        itens: atualizada.items.map((i) => ({
          sku: i.productSku,
          nome: i.productName,
          quantidade: i.quantity,
          precoUnitario: Number(i.unitPrice),
        })),
      },
      ajusteEstoque: deltas.map((d) => ({
        produto: produtoPorId.get(d.productId)?.name ?? d.productId,
        // Positivo voltou para a prateleira, negativo saiu
        delta: d.delta,
      })),
    } as object,
  });

  return atualizada;
}
