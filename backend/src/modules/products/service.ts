import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { buildSearchText, searchTerms } from '../../shared/utils/search';
import { NotFoundError, ConflictError } from '../../shared/errors/AppError';
import { createAuditLog } from '../../shared/utils/auditLog';
import type { CreateProductInput, UpdateProductInput, BulkUpdateInput, ListProductsInput } from './validator';

export async function listProducts(params: ListProductsInput) {
  const {
    page, limit, search, categoryId, subcategoryId, status, audience,
    brand, size, color, minPrice, maxPrice, lowStock, sortBy, sortOrder,
  } = params;
  const skip = (page - 1) * limit;

  const baseWhere: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(status && { status }),
    ...(categoryId && { categoryId }),
    ...(subcategoryId && { subcategoryId }),
    ...(audience && { audience }),
    ...(brand && { brand }),
    ...(size && { size }),
    ...(color && { color }),
    ...((minPrice !== undefined || maxPrice !== undefined) && {
      salePrice: {
        ...(minPrice !== undefined && { gte: minPrice }),
        ...(maxPrice !== undefined && { lte: maxPrice }),
      },
    }),
    // Busca multi-termo: cada palavra digitada precisa aparecer no searchText,
    // que junta sku/nome/marca/tamanho/cor/categoria já sem acento.
    // Assim "sapatilha rosa EUA" casa mesmo com a cor sendo outra coluna.
    ...(search && {
      AND: searchTerms(search).map((term) => ({
        searchText: { contains: term },
      })),
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

  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { name: true },
  });

  const product = await prisma.product.create({
    data: {
      ...input,
      costPrice: input.costPrice,
      salePrice: input.salePrice,
      searchText: buildSearchText({ ...input, categoryName: category?.name }),
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

  // O searchText precisa refletir o estado FINAL: parte do produto atual e
  // aplica só o que veio no input.
  const merged = { ...product, ...input };
  const categoryId = input.categoryId ?? product.categoryId;
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { name: true },
  });

  const updated = await prisma.product.update({
    where: { id },
    data: {
      ...input,
      searchText: buildSearchText({ ...merged, categoryName: category?.name }),
    },
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

  // Não dá para usar updateMany: o searchText é específico de cada produto
  // (junta nome, marca, cor, categoria...), então precisa ser recalculado
  // linha por linha depois de aplicar as alterações.
  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));

  await prisma.$transaction(
    products.map((product) => {
      const merged = { ...product, ...updates };
      const categoryId = updates.categoryId ?? product.categoryId;

      return prisma.product.update({
        where: { id: product.id },
        data: {
          ...updates,
          searchText: buildSearchText({
            ...merged,
            categoryName: categoryNames.get(categoryId),
          }),
        },
      });
    })
  );

  // Detecta o tipo predominante da alteração, para o log ficar pesquisável
  const changedFields = Object.keys(updates).filter(
    (k) => updates[k as keyof typeof updates] !== undefined
  );

  await createAuditLog({
    prisma,
    action: 'BULK_UPDATE',
    entityType: 'product',
    entityId: productIds.join(','),
    userId,
    metadata: {
      productCount: productIds.length,
      changedFields,
      updates,
      // Guarda o valor anterior de cada produto para permitir auditoria real
      before: products.map((p) => ({
        id: p.id,
        sku: p.sku,
        ...Object.fromEntries(
          changedFields.map((f) => [f, (p as unknown as Record<string, unknown>)[f]])
        ),
      })),
    } as object,
  });

  return { updated: productIds.length, changedFields };
}

// ─── Facets (contagens por dimensão, estilo Power BI) ────────

type FacetFilters = Omit<ListProductsInput, 'page' | 'limit' | 'sortBy' | 'sortOrder'>;

/**
 * Monta o where dos facets, opcionalmente IGNORANDO uma dimensão.
 *
 * Ignorar a própria dimensão é o que dá o comportamento de cross-filter: ao
 * escolher Categoria=Sapatilhas, o dropdown de Marca mostra só as marcas que
 * existem em Sapatilhas, mas o dropdown de Categoria continua listando todas
 * (senão o usuário não conseguiria trocar de categoria).
 */
function buildFacetWhere(
  f: FacetFilters,
  exclude?: 'categoryId' | 'brand' | 'size' | 'color' | 'audience' | 'status' | 'price'
): Prisma.ProductWhereInput {
  return {
    deletedAt: null,
    ...(f.status && exclude !== 'status' && { status: f.status }),
    ...(f.categoryId && exclude !== 'categoryId' && { categoryId: f.categoryId }),
    ...(f.subcategoryId && { subcategoryId: f.subcategoryId }),
    ...(f.audience && exclude !== 'audience' && { audience: f.audience }),
    ...(f.brand && exclude !== 'brand' && { brand: f.brand }),
    ...(f.size && exclude !== 'size' && { size: f.size }),
    ...(f.color && exclude !== 'color' && { color: f.color }),
    ...(exclude !== 'price' &&
      (f.minPrice !== undefined || f.maxPrice !== undefined) && {
        salePrice: {
          ...(f.minPrice !== undefined && { gte: f.minPrice }),
          ...(f.maxPrice !== undefined && { lte: f.maxPrice }),
        },
      }),
    ...(f.search && {
      AND: searchTerms(f.search).map((term) => ({ searchText: { contains: term } })),
    }),
  };
}

/** Converte o groupBy do Prisma numa lista ordenada por contagem. */
function toFacetList(
  rows: Array<{ _count: { _all: number } } & Record<string, unknown>>,
  key: string
) {
  return rows
    .filter((r) => r[key] !== null && r[key] !== '')
    .map((r) => ({ value: String(r[key]), count: r._count._all }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'pt-BR'));
}

/**
 * Faixas de preço para o filtro.
 *
 * Limites pensados para o catálogo da loja (meia, collant, sapatilha, sapato).
 * A borda superior é inclusiva — "Até R$ 25" pega o produto de exatamente
 * R$ 25,00, que é como a pessoa pensa ao filtrar por preço.
 */
const PRICE_BUCKETS: Array<{ id: string; label: string; min?: number; max?: number }> = [
  { id: '0-25',    label: 'Até R$ 25',        max: 25 },
  { id: '25-50',   label: 'R$ 25 a R$ 50',    min: 25,  max: 50 },
  { id: '50-80',   label: 'R$ 50 a R$ 80',    min: 50,  max: 80 },
  { id: '80-150',  label: 'R$ 80 a R$ 150',   min: 80,  max: 150 },
  { id: '150-300', label: 'R$ 150 a R$ 300',  min: 150, max: 300 },
  { id: '300+',    label: 'Acima de R$ 300',  min: 300 },
];

export async function getProductFacets(filters: FacetFilters) {
  const [
    byCategory, byBrand, bySize, byColor, byAudience, byStatus,
    priceAgg, lowStockCount, total,
  ] = await Promise.all([
    prisma.product.groupBy({
      by: ['categoryId'],
      where: buildFacetWhere(filters, 'categoryId'),
      _count: { _all: true },
    }),
    prisma.product.groupBy({
      by: ['brand'],
      where: buildFacetWhere(filters, 'brand'),
      _count: { _all: true },
    }),
    prisma.product.groupBy({
      by: ['size'],
      where: buildFacetWhere(filters, 'size'),
      _count: { _all: true },
    }),
    prisma.product.groupBy({
      by: ['color'],
      where: buildFacetWhere(filters, 'color'),
      _count: { _all: true },
    }),
    prisma.product.groupBy({
      by: ['audience'],
      where: buildFacetWhere(filters, 'audience'),
      _count: { _all: true },
    }),
    prisma.product.groupBy({
      by: ['status'],
      where: buildFacetWhere(filters, 'status'),
      _count: { _all: true },
    }),
    prisma.product.aggregate({
      where: buildFacetWhere(filters, 'price'),
      _min: { salePrice: true },
      _max: { salePrice: true },
    }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM products
      WHERE deleted_at IS NULL AND quantity <= min_stock
    `,
    prisma.product.count({ where: buildFacetWhere(filters) }),
  ]);

  // Contagem por faixa de preço. Usa o where SEM o filtro de preço, senão ao
  // escolher uma faixa as outras zerariam e não daria para trocar.
  const wherePreco = buildFacetWhere(filters, 'price');
  const priceBuckets = await Promise.all(
    PRICE_BUCKETS.map(async (b) => ({
      id: b.id,
      label: b.label,
      min: b.min,
      max: b.max,
      count: await prisma.product.count({
        where: {
          ...wherePreco,
          salePrice: {
            ...(b.min !== undefined && { gt: b.min }),
            ...(b.max !== undefined && { lte: b.max }),
          },
        },
      }),
    }))
  );

  // Nomes das categorias que apareceram no groupBy
  const categoryIds = byCategory.map((c) => c.categoryId);
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));

  return {
    total,
    categories: byCategory
      .map((c) => ({
        value: c.categoryId,
        label: categoryNames.get(c.categoryId) ?? '—',
        count: c._count._all,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR')),
    brands: toFacetList(byBrand as never, 'brand'),
    sizes: toFacetList(bySize as never, 'size'),
    colors: toFacetList(byColor as never, 'color'),
    audiences: toFacetList(byAudience as never, 'audience'),
    statuses: toFacetList(byStatus as never, 'status'),
    priceRange: {
      min: priceAgg._min.salePrice ? Number(priceAgg._min.salePrice) : 0,
      max: priceAgg._max.salePrice ? Number(priceAgg._max.salePrice) : 0,
    },
    priceBuckets,
    lowStockCount: Number(lowStockCount[0]?.count ?? 0),
  };
}

// ─── Valor do estoque ────────────────────────────────────────

/**
 * Quanto de dinheiro está parado no estoque.
 *
 * Dois olhares sobre o mesmo estoque:
 * - a CUSTO: o que a loja pagou, ou seja o capital imobilizado
 * - a VENDA: o que entra se vender tudo
 * A diferença é o lucro potencial. Custo e lucro só vão na resposta para quem
 * tem `view_cost_price` — margem é informação do dono.
 */
export async function getStockValue(includeCost: boolean) {
  const produtos = await prisma.product.findMany({
    where: { deletedAt: null, status: 'ACTIVE' },
    select: {
      quantity: true,
      costPrice: true,
      salePrice: true,
      minStock: true,
      categoryId: true,
      category: { select: { name: true } },
    },
  });

  let totalUnits = 0;
  let totalAtSale = 0;
  let totalAtCost = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  const porCategoria = new Map<string, {
    name: string; units: number; atSale: number; atCost: number; products: number;
  }>();

  for (const p of produtos) {
    const qtd = p.quantity;
    const venda = Number(p.salePrice) * qtd;
    const custo = Number(p.costPrice) * qtd;

    totalUnits += qtd;
    totalAtSale += venda;
    totalAtCost += custo;
    if (qtd === 0) outOfStockCount++;
    else if (qtd <= p.minStock) lowStockCount++;

    const entry = porCategoria.get(p.categoryId) ?? {
      name: p.category.name, units: 0, atSale: 0, atCost: 0, products: 0,
    };
    entry.units += qtd;
    entry.atSale += venda;
    entry.atCost += custo;
    entry.products += 1;
    porCategoria.set(p.categoryId, entry);
  }

  const round = (n: number) => Math.round(n * 100) / 100;

  const categorias = Array.from(porCategoria.entries())
    .map(([id, c]) => ({
      categoryId: id,
      name: c.name,
      products: c.products,
      units: c.units,
      atSale: round(c.atSale),
      ...(includeCost && { atCost: round(c.atCost) }),
    }))
    .sort((a, b) => b.atSale - a.atSale);

  return {
    productCount: produtos.length,
    totalUnits,
    totalAtSale: round(totalAtSale),
    ...(includeCost && {
      totalAtCost: round(totalAtCost),
      potentialProfit: round(totalAtSale - totalAtCost),
      // Margem sobre o preço de venda, que é como a loja costuma pensar
      marginPercent: totalAtSale > 0
        ? round(((totalAtSale - totalAtCost) / totalAtSale) * 100)
        : 0,
    }),
    lowStockCount,
    outOfStockCount,
    categories: categorias,
  };
}

/**
 * Todos os produtos que batem com os filtros, sem paginação — para o export.
 *
 * Reusa exatamente o mesmo `where` da listagem, então o que você vê na tela
 * filtrada é o que sai na planilha.
 */
export async function listAllProductsForExport(params: FacetFilters) {
  const {
    search, categoryId, subcategoryId, status, audience,
    brand, size, color, minPrice, maxPrice, lowStock,
  } = params;

  const baseWhere: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(status && { status }),
    ...(categoryId && { categoryId }),
    ...(subcategoryId && { subcategoryId }),
    ...(audience && { audience }),
    ...(brand && { brand }),
    ...(size && { size }),
    ...(color && { color }),
    ...((minPrice !== undefined || maxPrice !== undefined) && {
      salePrice: {
        ...(minPrice !== undefined && { gte: minPrice }),
        ...(maxPrice !== undefined && { lte: maxPrice }),
      },
    }),
    ...(search && {
      AND: searchTerms(search).map((term) => ({ searchText: { contains: term } })),
    }),
  };

  let where: Prisma.ProductWhereInput = baseWhere;
  if (lowStock) {
    const baixos = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM products WHERE deleted_at IS NULL AND quantity <= min_stock
    `;
    where = { ...baseWhere, id: { in: baixos.map((p) => p.id) } };
  }

  return prisma.product.findMany({
    where,
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }, { size: 'asc' }],
    include: { category: { select: { name: true } } },
  });
}
