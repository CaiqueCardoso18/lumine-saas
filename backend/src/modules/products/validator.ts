import { z } from 'zod';

export const createProductSchema = z.object({
  sku: z.string().min(1).max(50).trim(),
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(1000).optional(),
  categoryId: z.string().cuid('categoryId inválido'),
  subcategoryId: z.string().cuid().optional(),
  brand: z.string().max(100).optional(),
  size: z.string().max(50).optional(),
  color: z.string().max(50).optional(),
  costPrice: z.coerce.number().min(0, 'Preço de custo não pode ser negativo'),
  salePrice: z.coerce.number().min(0.01, 'Preço de venda deve ser maior que zero'),
  quantity: z.coerce.number().int().min(0).default(0),
  minStock: z.coerce.number().int().min(0).default(5),
  imageUrl: z.string().url().optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).default('ACTIVE'),
  barcode: z.string().max(50).optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const bulkUpdateSchema = z.object({
  productIds: z.array(z.string().cuid()).min(1, 'Selecione ao menos um produto'),
  updates: z.object({
    salePrice: z.coerce.number().min(0).optional(),
    costPrice: z.coerce.number().min(0).optional(),
    quantity: z.coerce.number().int().min(0).optional(),
    minStock: z.coerce.number().int().min(0).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).optional(),
  }).refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'Informe ao menos um campo para atualizar' }
  ),
});

export const listProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).optional(),
  lowStock: z.coerce.boolean().optional(),
  sortBy: z.enum(['name', 'sku', 'salePrice', 'quantity', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type BulkUpdateInput = z.infer<typeof bulkUpdateSchema>;
export type ListProductsInput = z.infer<typeof listProductsSchema>;
