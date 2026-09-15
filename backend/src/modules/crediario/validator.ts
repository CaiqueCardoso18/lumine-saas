import { z } from 'zod';

export const listInstallmentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  customerId: z.string().optional(),
  status: z.enum(['PENDING', 'PAID', 'CANCELLED']).optional(),
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

export type ListInstallmentsInput = z.infer<typeof listInstallmentsSchema>;
export type PayInstallmentInput = z.infer<typeof payInstallmentSchema>;
