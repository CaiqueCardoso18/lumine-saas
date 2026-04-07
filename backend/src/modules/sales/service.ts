import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError, NotFoundError } from '../../shared/errors/AppError';
import { createAuditLog } from '../../shared/utils/auditLog';
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

export async function createSale(input: CreateSaleInput, userId: string) {
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

  // Calcular totais
  const subtotal = input.items.reduce((acc, item) => {
    const itemTotal = item.unitPrice * item.quantity - item.discount;
    return acc + Math.max(0, itemTotal);
  }, 0);

  const discountAmount = input.discountAmount ?? 0;
  const total = Math.max(0, subtotal - discountAmount);

  // Executar em transação atômica
  const sale = await prisma.$transaction(async (tx) => {
    // Criar a venda
    const newSale = await tx.sale.create({
      data: {
        userId,
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
                installments: p.method === 'CREDIT_CARD' ? (input.installments ?? 1) : 1,
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
    metadata: { saleNumber: sale.saleNumber, total, itemCount: input.items.length } as object,
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
