import * as xlsx from 'xlsx';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/errors/AppError';
import { createAuditLog } from '../../shared/utils/auditLog';
import { aggregateVariants, categoryKey, parseAudience, VariantRow } from './helpers';

const REQUIRED_COLUMNS = ['sku', 'nome', 'quantidade', 'preco_venda'];
const OPTIONAL_COLUMNS = ['preco_custo', 'categoria', 'marca', 'tamanho', 'cor', 'publico', 'descricao', 'descricao_curta', 'barcode'];

interface RawRow {
  sku?: string;
  nome?: string;
  quantidade?: string | number;
  preco_venda?: string | number;
  preco_custo?: string | number;
  categoria?: string;
  marca?: string;
  tamanho?: string;
  cor?: string;
  publico?: string;
  descricao?: string;
  descricao_curta?: string;
  barcode?: string;
  [key: string]: unknown;
}

interface ParsedRow {
  sku: string;
  name: string;
  quantity: number;
  salePrice: number;
  costPrice: number;
  categoryName?: string;
  brand?: string;
  size?: string;
  color?: string;
  audience?: 'ADULTO' | 'INFANTIL';
  description?: string;
  shortDescription?: string;
  barcode?: string;
}

interface PreviewItem {
  row: number;
  sku: string;
  name: string;
  quantity: number;
  salePrice: number;
  action: 'create' | 'update';
  /** Tamanho/cor/público da variante, para o usuário conferir no preview */
  size?: string;
  color?: string;
  audience?: 'ADULTO' | 'INFANTIL';
  /** Quantas linhas da planilha foram somadas nesta variante (>1 = duplicatas) */
  mergedRows?: number;
  currentData?: {
    name: string;
    quantity: number;
    salePrice: number;
  } | null;
  error?: string;
}

function parseRow(raw: RawRow, rowIndex: number): { data?: ParsedRow; error?: string } {
  const sku = String(raw.sku || '').trim();
  const name = String(raw.nome || '').trim();

  if (!sku) return { error: `Linha ${rowIndex}: SKU é obrigatório` };
  if (!name) return { error: `Linha ${rowIndex}: Nome é obrigatório` };

  const quantity = Number(raw.quantidade);
  if (isNaN(quantity) || quantity < 0) {
    return { error: `Linha ${rowIndex}: Quantidade inválida` };
  }

  const salePrice = Number(String(raw.preco_venda).replace(',', '.'));
  if (isNaN(salePrice) || salePrice <= 0) {
    return { error: `Linha ${rowIndex}: Preço de venda inválido` };
  }

  const costPrice = raw.preco_custo
    ? Number(String(raw.preco_custo).replace(',', '.'))
    : 0;

  return {
    data: {
      sku,
      name,
      quantity: Math.floor(quantity),
      salePrice,
      costPrice: isNaN(costPrice) ? 0 : costPrice,
      categoryName: raw.categoria ? String(raw.categoria).trim() : undefined,
      brand: raw.marca ? String(raw.marca).trim() : undefined,
      size: raw.tamanho ? String(raw.tamanho).trim() : undefined,
      color: raw.cor ? String(raw.cor).trim() : undefined,
      audience: parseAudience(raw.publico),
      description: raw.descricao ? String(raw.descricao).trim() : undefined,
      shortDescription: raw.descricao_curta ? String(raw.descricao_curta).trim().slice(0, 200) : undefined,
      barcode: raw.barcode ? String(raw.barcode).trim() : undefined,
    },
  };
}

export async function previewUpload(fileBuffer: Buffer, fileName: string) {
  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json<RawRow>(sheet, { defval: '' });

  if (rows.length === 0) {
    throw new AppError('Planilha vazia ou sem dados válidos');
  }

  // Verificar colunas obrigatórias
  const headers = Object.keys(rows[0]).map((h) => h.toLowerCase().trim());
  const missingColumns = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
  if (missingColumns.length > 0) {
    throw new AppError(`Colunas obrigatórias ausentes: ${missingColumns.join(', ')}`);
  }

  // Parse de todas as linhas
  const parsed: Array<{ data: ParsedRow; rowNumber: number }> = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const { data, error } = parseRow(rows[i] as RawRow, i + 2); // +2 porque linha 1 é header
    if (error) {
      errors.push(error);
      continue;
    }
    parsed.push({ data: data!, rowNumber: i + 2 });
  }

  // Agrupa por variante (sku + tamanho + cor), somando duplicatas
  const variants = aggregateVariants(parsed);

  // Busca os produtos existentes pelo SKU COMPOSTO
  const variantSkus = variants.map((v) => v.variantSku);
  const existingProducts = await prisma.product.findMany({
    where: { sku: { in: variantSkus }, deletedAt: null },
    select: { id: true, sku: true, name: true, quantity: true, salePrice: true },
  });
  const existingMap = new Map(existingProducts.map((p) => [p.sku, p]));

  const preview: PreviewItem[] = variants.map((v) => {
    const existing = existingMap.get(v.variantSku);
    return {
      row: v.sourceRows[0],
      sku: v.variantSku,
      name: v.name,
      quantity: v.quantity,
      salePrice: v.salePrice,
      size: v.size,
      color: v.color,
      audience: v.audience,
      mergedRows: v.sourceRows.length > 1 ? v.sourceRows.length : undefined,
      action: existing ? ('update' as const) : ('create' as const),
      currentData: existing
        ? { name: existing.name, quantity: existing.quantity, salePrice: Number(existing.salePrice) }
        : null,
    };
  });

  return {
    fileName,
    totalRows: rows.length,
    /** Nº de variantes distintas depois do agrupamento */
    totalVariants: variants.length,
    /** Nº de linhas que foram somadas em variantes repetidas */
    mergedRows: variants.reduce((acc, v) => acc + (v.sourceRows.length - 1), 0),
    toCreate: preview.filter((p) => p.action === 'create').length,
    toUpdate: preview.filter((p) => p.action === 'update').length,
    errorCount: errors.length,
    preview,
    errors,
  };
}

export async function confirmUpload(fileBuffer: Buffer, fileName: string, userId: string) {
  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json<RawRow>(sheet, { defval: '' });

  // Categoria padrão (usada só quando a planilha não informa categoria)
  const defaultCategory = await prisma.category.findFirst({ orderBy: { sortOrder: 'asc' } });
  if (!defaultCategory) throw new AppError('Nenhuma categoria cadastrada. Execute o seed primeiro.');

  // Índice de categorias por chave normalizada (sem acento, caixa baixa, singular)
  const allCategories = await prisma.category.findMany();
  const categoryMap = new Map(allCategories.map((c) => [categoryKey(c.name), c.id]));

  /** Acha a categoria por nome flexível; se não existir, cria. */
  async function resolveCategoryId(name?: string): Promise<string> {
    if (!name) return defaultCategory!.id;

    const key = categoryKey(name);
    const found = categoryMap.get(key);
    if (found) return found;

    // Não existe: cria a categoria com o nome da planilha
    const slug = key.replace(/\s+/g, '-');
    const created = await prisma.category.create({
      data: { name: name.trim(), slug, sortOrder: 999 },
    });
    categoryMap.set(key, created.id);
    return created.id;
  }

  // Parse + agrupamento por variante (mesma lógica do preview)
  const parsed: Array<{ data: ParsedRow; rowNumber: number }> = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const { data, error } = parseRow(rows[i] as RawRow, i + 2);
    if (error) {
      errors.push(error);
      continue;
    }
    parsed.push({ data: data!, rowNumber: i + 2 });
  }

  const variants: VariantRow[] = aggregateVariants(parsed);

  // Produtos já existentes, pelo SKU composto
  const existingProducts = await prisma.product.findMany({
    where: { sku: { in: variants.map((v) => v.variantSku) }, deletedAt: null },
  });
  const existingMap = new Map(existingProducts.map((p) => [p.sku, p]));

  let createdCount = 0;
  let updatedCount = 0;

  for (const v of variants) {
    try {
      const categoryId = await resolveCategoryId(v.categoryName);
      const existing = existingMap.get(v.variantSku);

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            quantity: v.quantity,
            salePrice: v.salePrice,
            ...(v.costPrice && { costPrice: v.costPrice }),
            name: v.name,
            categoryId,
            ...(v.brand && { brand: v.brand }),
            ...(v.size && { size: v.size }),
            ...(v.color && { color: v.color }),
            ...(v.audience && { audience: v.audience }),
            ...(v.description && { description: v.description }),
            ...(v.shortDescription && { shortDescription: v.shortDescription }),
          },
        });
        updatedCount++;
      } else {
        await prisma.product.create({
          data: {
            sku: v.variantSku,
            name: v.name,
            quantity: v.quantity,
            salePrice: v.salePrice,
            costPrice: v.costPrice ?? 0,
            categoryId,
            brand: v.brand,
            size: v.size,
            color: v.color,
            audience: v.audience,
            description: v.description,
            shortDescription: v.shortDescription,
            barcode: v.barcode,
          },
        });
        createdCount++;
      }
    } catch (err) {
      const detalhe = err instanceof Error ? err.message : 'erro desconhecido';
      errors.push(
        `Linha(s) ${v.sourceRows.join(', ')} — SKU ${v.variantSku}: ${detalhe}`
      );
    }
  }

  // Registrar o import
  const importRecord = await prisma.import.create({
    data: {
      fileName,
      totalRows: rows.length,
      createdCount,
      updatedCount,
      errorCount: errors.length,
      status: createdCount === 0 && updatedCount === 0 ? 'FAILED' : 'COMPLETED',
      errors: errors.length > 0 ? errors : undefined,
      completedAt: new Date(),
    },
  });

  await createAuditLog({
    prisma,
    action: 'IMPORT',
    entityType: 'import',
    entityId: importRecord.id,
    userId,
    metadata: { fileName, createdCount, updatedCount, errorCount: errors.length } as object,
  });

  return {
    importId: importRecord.id,
    createdCount,
    updatedCount,
    errorCount: errors.length,
    totalVariants: variants.length,
    mergedRows: variants.reduce((acc, v) => acc + (v.sourceRows.length - 1), 0),
    errors,
  };
}

export async function getImportHistory() {
  const imports = await prisma.import.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return imports;
}
