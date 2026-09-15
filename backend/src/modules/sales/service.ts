import { Prisma } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError, NotFoundError } from '../../shared/errors/AppError';
import { createAuditLog } from '../../shared/utils/auditLog';
import { planInstallments } from '../crediario/helpers';
import type { CreateSaleInput, CancelSaleInput, ListSalesInput } from './validator';

export async function listSales(params: ListSalesInput) {
  const { page, limit, startDate, endDate, paymentMethod, status, minTotal, maxTotal } = params;
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
      orderBy: { createdAt: 'desc' },
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
  }>>`
    SELECT
      COUNT(*) FILTER (WHERE status = 'COMPLETED') as total_sales,
      COALESCE(SUM(total) FILTER (WHERE status = 'COMPLETED'), 0) as total_revenue,
      COALESCE(SUM(discount_amount) FILTER (WHERE status = 'COMPLETED'), 0) as total_discount,
      COALESCE(AVG(total) FILTER (WHERE status = 'COMPLETED'), 0) as avg_ticket,
      COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled_count
    FROM sales
    WHERE created_at BETWEEN ${start} AND ${end}
  `;

  return {
    totalSales: Number(summary.total_sales),
    totalRevenue: Number(summary.total_revenue),
    totalDiscount: Number(summary.total_discount),
    avgTicket: Number(summary.avg_ticket),
    cancelledCount: Number(summary.cancelled_count),
    period: { start, end },
  };
}

export async function createSale(
  input: CreateSaleInput,
  userId: string,
  userRole: UserRole = 'EMPLOYEE'
) {
  // Buscar produtos e validar estoque
  const productIds = input.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, deletedAt: null, status: 'ACTIVE' },
  });

  if (products.length !== productIds.length) {
    throw new AppError('Um ou mais produtos não encontrados ou inativos', 400);
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Verificar estoque
  for (const item of input.items) {
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

  for (const item of input.items) {
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
  const subtotal = input.items.reduce((acc, item) => {
    const itemTotal = item.unitPrice * item.quantity - item.discount;
    return acc + Math.max(0, itemTotal);
  }, 0);

  // Desconto: percentual tem prioridade quando informado, e o valor em reais é
  // derivado dele. Guardar os dois deixa o histórico legível ("10% = R$ 30,00").
  const discountAmount =
    input.discountPercent !== undefined && input.discountPercent > 0
      ? Math.round(subtotal * (input.discountPercent / 100) * 100) / 100
      : (input.discountAmount ?? 0);

  if (discountAmount > subtotal) {
    throw new AppError('O desconto não pode ser maior que o subtotal', 400);
  }

  const total = Math.max(0, subtotal - discountAmount);

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

  let plano: ReturnType<typeof planInstallments> = [];
  if (usaCrediario) {
    const count = input.crediarioCount ?? 1;
    // Sem data informada, a primeira parcela vence em 30 dias
    const firstDue = input.crediarioFirstDueDate
      ? new Date(`${input.crediarioFirstDueDate}T12:00:00`)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    if (isNaN(firstDue.getTime())) {
      throw new AppError('Data de vencimento inválida', 400);
    }

    plano = planInstallments(crediarioAmount, count, firstDue);
  }

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
        paymentMethod: input.paymentMethod,
        notes: input.notes,
        items: {
          create: input.items.map((item) => {
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
        payments: {
          create: input.paymentMethod === 'MIXED' && input.payments
            ? input.payments.map((p) => ({
                method: p.method,
                amount: p.amount,
                installments:
                  p.method === 'CREDIT_CARD' ? (p.installments ?? input.installments ?? 1) : 1,
              }))
            : [{
                method: input.paymentMethod,
                amount: total,
                installments: input.paymentMethod === 'CREDIT_CARD' ? (input.installments ?? 1) : 1,
              }],
        },
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

    // Baixa de estoque para cada item
    for (const item of input.items) {
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
      itemCount: input.items.length,
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
    include: { items: true },
  });

  if (!sale) throw new NotFoundError('Venda');
  if (sale.status === 'CANCELLED') {
    throw new AppError('Esta venda já foi cancelada', 400);
  }

  // Executar em transação: cancelar venda + devolver estoque
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
  });

  await createAuditLog({
    prisma,
    action: 'SALE_CANCEL',
    entityType: 'sale',
    entityId: id,
    userId,
    metadata: { reason: input.reason, saleNumber: sale.saleNumber } as object,
  });

  return { message: 'Venda cancelada com sucesso. Estoque devolvido.' };
}
