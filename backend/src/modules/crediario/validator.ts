import { z } from 'zod';

export const listInstallmentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  customerId: z.string().optional(),
  status: z.enum(['PENDING', 'PAID', 'CANCELLED', 'RENEGOTIATED']).optional(),
  /** overdue=true traz só as vencidas e ainda em aberto */
  overdue: z.coerce.boolean().optional(),
  dueUntil: z.string().optional(),
  search: z.string().optional(),
});

export const payInstallmentSchema = z.object({
  paidAmount: z.coerce.number().min(0.01, 'Valor pago deve ser maior que zero').optional(),
  paidMethod: z.enum(['CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD']).default('CASH'),
  notes: z.string().max(500).optional(),
});

/**
 * Edição de uma parcela já criada.
 *
 * Serve para o caso real de "a cliente pediu para adiar" ou "combinamos um
 * valor diferente". Só mexe em parcela em aberto — parcela paga precisa ser
 * reaberta antes, senão o caixa e a parcela contariam histórias diferentes.
 */
export const updateInstallmentSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Valor deve ser maior que zero').optional(),
  dueDate: z.string().optional(),
  notes: z.string().max(500).optional(),
}).refine(
  (d) => d.amount !== undefined || d.dueDate !== undefined || d.notes !== undefined,
  { message: 'Informe ao menos um campo para alterar' }
);

/**
 * Renegociação: junta várias parcelas em aberto do MESMO cliente num plano novo.
 *
 * As antigas viram RENEGOTIATED apontando para a primeira nova, em vez de
 * sumirem — a loja precisa conseguir explicar para a cliente o que aconteceu
 * com a dívida antiga.
 */
export const renegotiateSchema = z.object({
  installmentIds: z.array(z.string().cuid()).min(1, 'Selecione ao menos uma parcela'),
  count: z.coerce.number().int().min(1).max(36),
  firstDueDate: z.string().min(1, 'Informe o primeiro vencimento'),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']).default('MONTHLY'),
  /** Desconto ou acréscimo no total renegociado, em reais. Negativo = desconto. */
  adjustment: z.coerce.number().default(0),
  notes: z.string().max(500).optional(),
});

export type UpdateInstallmentInput = z.infer<typeof updateInstallmentSchema>;
export type RenegotiateInput = z.infer<typeof renegotiateSchema>;
export type ListInstallmentsInput = z.infer<typeof listInstallmentsSchema>;
export type PayInstallmentInput = z.infer<typeof payInstallmentSchema>;
