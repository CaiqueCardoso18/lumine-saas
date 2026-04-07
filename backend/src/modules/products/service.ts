import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError, ConflictError } from '../../shared/errors/AppError';
import { createAuditLog } from '../../shared/utils/auditLog';
import type { CreateProductInput, UpdateProductInput, BulkUpdateInput, ListProductsInput } from './validator';

export async function listProducts(params: ListProductsInput) {
  const { page, limit, search, categoryId, subcategoryId, status, lowStock, sortBy, sortOrder } = params;
  const skip = (page - 1) * limit;

  const baseWhere: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(status && { status }),
    ...(categoryId && { categoryId }),
    ...(subcategoryId && { subcategoryId }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  let productWhere: Prisma.ProductWhereInput = baseWhere;
  if (lowStock) {
    // Buscar produtos onde quantity <= minStock
    const lowStockProducts = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM products WHERE deleted_at IS NULL AND quantity <= min_stock
    `;
    productWhere = { ...baseWhere, id: { in: lowStockProducts.map((p) => p.id) } };
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: productWhere,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        subcategory: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.product.count({ where: productWhere }),
  ]);

  return {
    products,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getLowStockProducts() {
  const products = await prisma.$queryRaw<Array<{
    id: string; sku: string; name: string; quantity: number; min_stock: number;
    category_name: string;
  }>>`
    SELECT p.id, p.sku, p.name, p.quantity, p.min_stock,
           c.name as category_name
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.deleted_at IS NULL
      AND p.quantity <= p.min_stock
    ORDER BY (p.quantity::float / NULLIF(p.min_stock, 0)) ASC
    LIMIT 50
  `;
  return products;
}

export async function getProductById(id: string) {
  const product = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      subcategory: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!product) throw new NotFoundError('Produto');
  return product;
}

export async function getProductHistory(id: string) {
  const product = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!product) throw new NotFoundError('Produto');

  const history = await prisma.auditLog.findMany({
    where: { productId: id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return history;
}

export async function createProduct(input: CreateProductInput, userId: string) {
  const exists = await prisma.product.findUnique({ where: { sku: input.sku } });
  if (exists) throw new ConflictError(`Já existe um produto com o SKU "${input.sku}"`);

  const product = await prisma.product.create({
    data: {
      ...input,
      costPrice: input.costPrice,
      salePrice: input.salePrice,
    },
    include: {
      category: { select: { id: true, name: true } },
      subcategory: { select: { id: true, name: true } },
    },
  });

  await createAuditLog({
    prisma,
    action: 'CREATE',
    entityType: 'product',
    entityId: product.id,
    userId,
    productId: product.id,
    newValue: product as unknown as object,
  });

  return product;
}

export async function updateProduct(id: string, input: UpdateProductInput, userId: string) {
  const product = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!product) throw new NotFoundError('Produto');

  const oldValue = { ...product };

  const updated = await prisma.product.update({
    where: { id },
    data: input,
    include: {
      category: { select: { id: true, name: true } },
      subcategory: { select: { id: true, name: true } },
    },
  });

  // Determinar tipo de alteração para audit log
  const isPriceChange = input.salePrice !== undefined || input.costPrice !== undefined;
  const isStockChange = input.quantity !== undefined;

  await createAuditLog({
    prisma,
    action: isPriceChange ? 'PRICE_CHANGE' : isStockChange ? 'STOCK_CHANGE' : 'UPDATE',
    entityType: 'product',
    entityId: id,
    userId,
    productId: id,
    oldValue: oldValue as unknown as object,
    newValue: updated as unknown as object,
  });

  return updated;
}

export async function softDeleteProduct(id: string, userId: string) {
  const product = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!product) throw new NotFoundError('Produto');

  await prisma.product.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await createAuditLog({
    prisma,
    action: 'DELETE',
    entityType: 'product',
    entityId: id,
    userId,
    productId: id,
    oldValue: product as unknown as object,
  });
}

export async function bulkUpdateProducts(input: BulkUpdateInput, userId: string) {
  const { productIds, updates } = input;

  // Verificar que todos os produtos existem
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, deletedAt: null },
  });

  if (products.length !== productIds.length) {
    throw new NotFoundError('Um ou mais produtos não foram encontrados');
  }

  await prisma.product.updateMany({
    where: { id: { in: productIds } },
    data: updates,
  });

  await createAuditLog({
    prisma,
    action: 'BULK_UPDATE',
    entityType: 'product',
    entityId: productIds.join(','),
    userId,
    metadata: { productIds, updates } as object,
  });

  return { updated: productIds.length };
}
