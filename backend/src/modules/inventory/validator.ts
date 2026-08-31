import { z } from 'zod';

// ─── Sessões de Inventário (Contagem Física) ─────────────────

export const createSessionSchema = z.object({
  name: z.string().min(1, 'Nome da sessão obrigatório').max(200).trim(),
  notes: z.string().max(500).optional(),
});

export const addCountSchema = z.object({
  productId: z.string().cuid('productId inválido'),
  countedQuantity: z.coerce.number().int().min(0, 'Quantidade não pode ser negativa'),
  notes: z.string().max(500).optional(),
});

export const addCountBatchSchema = z.object({
  counts: z.array(addCountSchema).min(1, 'Informe ao menos um produto'),
});

export const listSessionsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
});

// ─── Movimentações de Estoque ────────────────────────────────

export const createMovementSchema = z.object({
  productId: z.string().cuid('productId inválido'),
  type: z.enum([
    'ADJUSTMENT', 'LOSS', 'DAMAGE', 'RETURN',
    'TRANSFER_IN', 'TRANSFER_OUT', 'OTHER',
  ]),
  quantity: z.coerce.number().int().refine(val => val !== 0, 'Quantidade não pode ser zero'),
  reason: z.string().min(1, 'Motivo obrigatório').max(500).trim(),
  reference: z.string().max(200).optional(),
});

export const listMovementsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  productId: z.string().cuid().optional(),
  type: z.enum([
    'ADJUSTMENT', 'LOSS', 'DAMAGE', 'RETURN',
    'TRANSFER_IN', 'TRANSFER_OUT', 'INVENTORY_ADJUSTMENT', 'OTHER',
  ]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// Types
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type AddCountInput = z.infer<typeof addCountSchema>;
export type AddCountBatchInput = z.infer<typeof addCountBatchSchema>;
export type ListSessionsInput = z.infer<typeof listSessionsSchema>;
export type CreateMovementInput = z.infer<typeof createMovementSchema>;
export type ListMovementsInput = z.infer<typeof listMovementsSchema>;
