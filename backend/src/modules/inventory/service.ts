import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError, AppError } from '../../shared/errors/AppError';
import { createAuditLog } from '../../shared/utils/auditLog';
import type {
  CreateSessionInput, AddCountInput, AddCountBatchInput,
  ListSessionsInput, CreateMovementInput, ListMovementsInput,
} from './validator';

// ═════════════════════════════════════════════════════════════
// SESSÕES DE INVENTÁRIO (Contagem Física)
// ═════════════════════════════════════════════════════════════

export async function createSession(input: CreateSessionInput, userId: string) {
  return prisma.inventorySession.create({
    data: { ...input, userId },
    include: { user: { select: { id: true, name: true } } },
  });
}

export async function listSessions(params: ListSessionsInput) {
  const { page, limit, status } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.InventorySessionWhereInput = {
    ...(status && { status }),
  };

  const [sessions, total] = await Promise.all([
    prisma.inventorySession.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
        _count: { select: { counts: true } },
      },
    }),
    prisma.inventorySession.count({ where }),
  ]);

  return {
    sessions,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getSession(id: string) {
  const session = await prisma.inventorySession.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      counts: {
        include: {
          product: {
            select: { id: true, sku: true, name: true, quantity: true, category: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!session) throw new NotFoundError('Sessão de inventário');
  return session;
}

export async function addCounts(sessionId: string, input: AddCountBatchInput, userId: string) {
  const session = await prisma.inventorySession.findUnique({ where: { id: sessionId } });
  if (!session) throw new NotFoundError('Sessão de inventário');
  if (session.status !== 'IN_PROGRESS') {
    throw new AppError('Sessão já finalizada ou cancelada', 400);
  }

  const results = [];

  for (const count of input.counts) {
    const product = await prisma.product.findFirst({
      where: { id: count.productId, deletedAt: null },
    });
    if (!product) throw new NotFoundError(`Produto ${count.productId}`);

    const difference = count.countedQuantity - product.quantity;

    const created = await prisma.inventoryCount.upsert({
      where: {
        sessionId_productId: { sessionId, productId: count.productId },
      },
      update: {
        countedQuantity: count.countedQuantity,
        systemQuantity: product.quantity,
        difference,
        notes: count.notes,
      },
      create: {
        sessionId,
        productId: count.productId,
        systemQuantity: product.quantity,
        countedQuantity: count.countedQuantity,
        difference,
        notes: count.notes,
      },
      include: {
        product: { select: { id: true, sku: true, name: true } },
      },
    });

    results.push(created);
  }

  // Atualizar contadores da sessão
  const allCounts = await prisma.inventoryCount.findMany({ where: { sessionId } });
  await prisma.inventorySession.update({
    where: { id: sessionId },
    data: {
      totalProducts: allCounts.length,
      matchedCount: allCounts.filter(c => c.difference === 0).length,
      divergedCount: allCounts.filter(c => c.difference !== 0).length,
    },
  });

  return results;
}

export async function applySession(sessionId: string, userId: string) {
  const session = await prisma.inventorySession.findUnique({
    where: { id: sessionId },
    include: { counts: { include: { product: true } } },
  });

  if (!session) throw new NotFoundError('Sessão de inventário');
  if (session.status !== 'IN_PROGRESS') {
    throw new AppError('Sessão já finalizada ou cancelada', 400);
  }
  if (session.counts.length === 0) {
    throw new AppError('Sessão sem contagens registradas', 400);
  }

  // Aplicar ajustes em transação atômica
  await prisma.$transaction(async (tx) => {
    for (const count of session.counts) {
      if (count.difference === 0) continue; // sem divergência

      const product = await tx.product.findUnique({ where: { id: count.productId } });
      if (!product) continue;

      const previousStock = product.quantity;
      const newStock = count.countedQuantity;

      // Atualizar estoque do produto
      await tx.product.update({
        where: { id: count.productId },
        data: { quantity: newStock },
      });

      // Criar movimentação de estoque
      await tx.stockMovement.create({
        data: {
          productId: count.productId,
          userId,
          type: 'INVENTORY_ADJUSTMENT',
          quantity: count.difference,
          previousStock,
          newStock,
          reason: `Ajuste de inventário — sessão "${session.name}"`,
          reference: `inventory_session:${sessionId}`,
        },
      });

      // Audit log
      await createAuditLog({
        prisma: tx,
        action: 'INVENTORY_ADJUST',
        entityType: 'product',
        entityId: count.productId,
        userId,
        productId: count.productId,
        oldValue: { quantity: previousStock },
        newValue: { quantity: newStock },
        metadata: { sessionId, sessionName: session.name, difference: count.difference },
      });
    }

    // Finalizar sessão
    await tx.inventorySession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED', appliedAt: new Date() },
    });
  });

  return getSession(sessionId);
}

export async function cancelSession(sessionId: string) {
  const session = await prisma.inventorySession.findUnique({ where: { id: sessionId } });
  if (!session) throw new NotFoundError('Sessão de inventário');
  if (session.status !== 'IN_PROGRESS') {
    throw new AppError('Sessão já finalizada ou cancelada', 400);
  }

  return prisma.inventorySession.update({
    where: { id: sessionId },
    data: { status: 'CANCELLED' },
  });
}

// ═════════════════════════════════════════════════════════════
// MOVIMENTAÇÕES DE ESTOQUE (Manual)
// ═════════════════════════════════════════════════════════════

export async function createMovement(input: CreateMovementInput, userId: string) {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, deletedAt: null },
  });
  if (!product) throw new NotFoundError('Produto');

  const previousStock = product.quantity;
  const newStock = previousStock + input.quantity;

  if (newStock < 0) {
    throw new AppError(`Estoque insuficiente. Atual: ${previousStock}, tentativa de remover: ${Math.abs(input.quantity)}`, 400);
  }

  const [movement] = await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        productId: input.productId,
        userId,
        type: input.type,
        quantity: input.quantity,
        previousStock,
        newStock,
        reason: input.reason,
        reference: input.reference,
      },
      include: {
        product: { select: { id: true, sku: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.product.update({
      where: { id: input.productId },
      data: { quantity: newStock },
    }),
  ]);

  await createAuditLog({
    action: 'STOCK_MOVEMENT',
    entityType: 'product',
    entityId: input.productId,
    userId,
    productId: input.productId,
    oldValue: { quantity: previousStock },
    newValue: { quantity: newStock },
    metadata: { type: input.type, reason: input.reason, movementId: movement.id },
  });

  return movement;
}

export async function listMovements(params: ListMovementsInput) {
  const { page, limit, productId, type, startDate, endDate } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.StockMovementWhereInput = {
    ...(productId && { productId }),
    ...(type && { type }),
    ...((startDate || endDate) && {
      createdAt: {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      },
    }),
  };

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, sku: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return {
    movements,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getMovementsByProduct(productId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
  if (!product) throw new NotFoundError('Produto');

  return prisma.stockMovement.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: { select: { id: true, name: true } },
    },
  });
}
