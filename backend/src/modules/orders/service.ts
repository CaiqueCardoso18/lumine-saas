import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError, NotFoundError } from '../../shared/errors/AppError';
import { createAuditLog } from '../../shared/utils/auditLog';
import type {
  CreateSupplierInput,
  CreateOrderInput,
  UpdateOrderInput,
  UpdateOrderStatusInput,
  ListOrdersInput,
} from './validator';

// ─── Suppliers ────────────────────────────────────────────────
export async function listSuppliers() {
  return prisma.supplier.findMany({ orderBy: { name: 'asc' } });
}

export async function createSupplier(input: CreateSupplierInput) {
  return prisma.supplier.create({ data: input });
}

export async function updateSupplier(id: string, input: Partial<CreateSupplierInput>) {
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) throw new NotFoundError('Fornecedor');
  return prisma.supplier.update({ where: { id }, data: input });
}

export async function deleteSupplier(id: string) {
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) throw new NotFoundError('Fornecedor');
  // Verificar se tem pedidos
  const ordersCount = await prisma.order.count({ where: { supplierId: id } });
  if (ordersCount > 0) {
    throw new AppError('Fornecedor possui pedidos associados. Não é possível excluir.', 400);
  }
  await prisma.supplier.delete({ where: { id } });
}

// ─── Orders ───────────────────────────────────────────────────
export async function listOrders(params: ListOrdersInput) {
  const { page, limit, status, supplierId } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.OrderWhereInput = {
    ...(status && { status }),
    ...(supplierId && { supplierId }),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getOrderById(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: {
        include: { product: { select: { id: true, name: true, sku: true, salePrice: true } } },
      },
    },
  });
  if (!order) throw new NotFoundError('Pedido');
  return order;
}

export async function createOrder(input: CreateOrderInput, userId: string) {
  const totalCost = input.items.reduce(
    (acc, item) => acc + item.unitCost * item.quantityOrdered,
    0
  );

  const order = await prisma.order.create({
    data: {
      supplierId: input.supplierId,
      totalCost,
      notes: input.notes,
      items: {
        create: input.items.map((item) => ({
          productId: item.productId,
          quantityOrdered: item.quantityOrdered,
          unitCost: item.unitCost,
        })),
      },
    },
    include: {
      supplier: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
  });

  await createAuditLog({
    prisma,
    action: 'ORDER_STATUS_CHANGE',
    entityType: 'order',
    entityId: order.id,
    userId,
    metadata: { orderNumber: order.orderNumber, status: 'DRAFT', totalCost } as object,
  });

  return order;
}

export async function updateOrder(id: string, input: UpdateOrderInput) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new NotFoundError('Pedido');

  if (order.status !== 'DRAFT') {
    throw new AppError('Apenas pedidos em RASCUNHO podem ser editados', 400);
  }

  const updateData: Prisma.OrderUpdateInput = {
    supplierId: input.supplierId,
    notes: input.notes,
  };

  if (input.items) {
    const totalCost = input.items.reduce(
      (acc, item) => acc + item.unitCost * item.quantityOrdered,
      0
    );
    updateData.totalCost = totalCost;
    // Deletar itens antigos e recriar
    await prisma.orderItem.deleteMany({ where: { orderId: id } });
    updateData.items = {
      create: input.items.map((item) => ({
        productId: item.productId,
        quantityOrdered: item.quantityOrdered,
        unitCost: item.unitCost,
        quantityReceived: item.quantityReceived,
      })),
    };
  }

  return prisma.order.update({
    where: { id },
    data: updateData,
    include: {
      supplier: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true } } } },
    },
  });
}

export async function updateOrderStatus(id: string, input: UpdateOrderStatusInput, userId: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) throw new NotFoundError('Pedido');

  // Validar transições de status (frente e volta)
  const validTransitions: Record<string, string[]> = {
    DRAFT: ['SENT', 'CANCELLED'],
    SENT: ['RECEIVED', 'DRAFT', 'CANCELLED'],
    RECEIVED: ['CHECKED', 'SENT', 'CANCELLED'],
    CHECKED: ['RECEIVED'],
    CANCELLED: ['DRAFT'],
  };

  if (!validTransitions[order.status]?.includes(input.status)) {
    throw new AppError(
      `Não é possível mover o pedido de ${order.status} para ${input.status}`,
      400
    );
  }

  const updateData: Prisma.OrderUpdateInput = {
    status: input.status,
    ...(input.status === 'SENT' && { sentAt: new Date() }),
    ...(input.status === 'RECEIVED' && { receivedAt: new Date() }),
    ...(input.status === 'CHECKED' && { checkedAt: new Date() }),
    // Ao voltar, limpa os timestamps correspondentes
    ...(input.status === 'DRAFT' && { sentAt: null }),
    ...(input.status === 'SENT' && order.status === 'RECEIVED' && { receivedAt: null }),
    ...(input.status === 'RECEIVED' && order.status === 'CHECKED' && { checkedAt: null }),
  };

  // Se CHECKED → entrada no estoque
  if (input.status === 'CHECKED') {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: updateData });
      for (const item of order.items) {
        const received = item.quantityReceived ?? item.quantityOrdered;
        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: { increment: received } },
        });
      }
    });
  } else if (order.status === 'CHECKED' && input.status === 'RECEIVED') {
    // Reverter entrada no estoque ao voltar de CHECKED
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: updateData });
      for (const item of order.items) {
        const received = item.quantityReceived ?? item.quantityOrdered;
        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: { decrement: received } },
        });
      }
    });
  } else {
    await prisma.order.update({ where: { id }, data: updateData });
  }

  await createAuditLog({
    prisma,
    action: 'ORDER_STATUS_CHANGE',
    entityType: 'order',
    entityId: id,
    userId,
    oldValue: { status: order.status } as object,
    newValue: { status: input.status } as object,
    metadata: { orderNumber: order.orderNumber } as object,
  });

  return prisma.order.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true } } } },
    },
  });
}
