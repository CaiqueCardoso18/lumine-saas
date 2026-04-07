import * as xlsx from 'xlsx';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/errors/AppError';
import { createAuditLog } from '../../shared/utils/auditLog';

const REQUIRED_COLUMNS = ['sku', 'nome', 'quantidade', 'preco_venda'];
const OPTIONAL_COLUMNS = ['preco_custo', 'categoria', 'marca', 'tamanho', 'cor', 'descricao', 'barcode'];

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
  descricao?: string;
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
  description?: string;
  barcode?: string;
}

interface PreviewItem {
  row: number;
  sku: string;
  name: string;
  quantity: number;
  salePrice: number;
  action: 'create' | 'update';
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
      description: raw.descricao ? String(raw.descricao).trim() : undefined,
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

  // Buscar todos os SKUs existentes
  const skusInFile = rows.map((r) => String(r.sku || '').trim()).filter(Boolean);
  const existingProducts = await prisma.product.findMany({
    where: { sku: { in: skusInFile }, deletedAt: null },
    select: { id: true, sku: true, name: true, quantity: true, salePrice: true },
  });
  const existingMap = new Map(existingProducts.map((p) => [p.sku, p]));

  const preview: PreviewItem[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const { data, error } = parseRow(rows[i] as RawRow, i + 2); // +2 porque linha 1 é header
    if (error) {
      errors.push(error);
      continue;
    }

    const existing = existingMap.get(data!.sku);
    preview.push({
      row: i + 2,
      sku: data!.sku,
      name: data!.name,
      quantity: data!.quantity,
      salePrice: data!.salePrice,
      action: existing ? 'update' : 'create',
      currentData: existing
        ? { name: existing.name, quantity: existing.quantity, salePrice: Number(existing.salePrice) }
        : null,
    });
  }

  return {
    fileName,
    totalRows: rows.length,
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

  // Buscar categoria padrão
  const defaultCategory = await prisma.category.findFirst({ orderBy: { sortOrder: 'asc' } });
  if (!defaultCategory) throw new AppError('Nenhuma categoria cadastrada. Execute o seed primeiro.');

  const allCategories = await prisma.category.findMany();
  const categoryMap = new Map(allCategories.map((c) => [c.name.toLowerCase(), c]));

  const skusInFile = rows.map((r) => String(r.sku || '').trim()).filter(Boolean);
  const existingProducts = await prisma.product.findMany({
    where: { sku: { in: skusInFile }, deletedAt: null },
  });
  const existingMap = new Map(existingProducts.map((p) => [p.sku, p]));

  let createdCount = 0;
  let updatedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const { data, error } = parseRow(rows[i] as RawRow, i + 2);
    if (error) {
      errors.push(error);
      continue;
    }

    try {
      const categoryId = data!.categoryName
        ? (categoryMap.get(data!.categoryName.toLowerCase())?.id ?? defaultCategory.id)
        : defaultCategory.id;

      const existing = existingMap.get(data!.sku);

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            quantity: data!.quantity,
            salePrice: data!.salePrice,
            ...(data!.costPrice && { costPrice: data!.costPrice }),
            name: data!.name,
          },
        });
        updatedCount++;
      } else {
        await prisma.product.create({
          data: {
            sku: data!.sku,
            name: data!.name,
            quantity: data!.quantity,
            salePrice: data!.salePrice,
            costPrice: data!.costPrice ?? 0,
            categoryId,
            brand: data!.brand,
            size: data!.size,
            color: data!.color,
            description: data!.description,
            barcode: data!.barcode,
          },
        });
        createdCount++;
      }
    } catch (err) {
      errors.push(`Linha ${i + 2}: Erro ao processar SKU ${data!.sku}`);
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
      status: errors.length === rows.length ? 'FAILED' : 'COMPLETED',
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
