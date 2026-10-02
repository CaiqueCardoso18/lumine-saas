import { z } from 'zod';

export const calendarSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const createPayableSchema = z.object({
  description: z.string().min(1, 'Descreva a conta').max(200),
  category: z.string().max(60).optional(),
  supplierId: z.string().cuid().optional(),
  amount: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
  dueDate: z.string().min(1, 'Informe o vencimento'),
  notes: z.string().max(500).optional(),
  /**
   * Repetir a conta nos meses seguintes. Aluguel e energia vencem todo mês,
   * e cadastrar doze vezes na mão seria o caminho mais rápido para a dona
   * desistir de usar a tela.
   */
  repeatMonths: z.coerce.number().int().min(1).max(24).default(1),
});

export const updatePayableSchema = z.object({
  description: z.string().min(1).max(200).optional(),
  category: z.string().max(60).nullish(),
  amount: z.coerce.number().min(0.01).optional(),
  dueDate: z.string().optional(),
  notes: z.string().max(500).nullish(),
}).refine(
  (d) => Object.values(d).some((v) => v !== undefined),
  { message: 'Informe ao menos um campo para alterar' }
);

export const payPayableSchema = z.object({
  paidAmount: z.coerce.number().min(0.01).optional(),
  notes: z.string().max(500).optional(),
});

export const listPayablesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  status: z.enum(['PENDING', 'PAID', 'CANCELLED']).optional(),
  overdue: z.coerce.boolean().optional(),
});

export type CalendarInput = z.infer<typeof calendarSchema>;
export type CreatePayableInput = z.infer<typeof createPayableSchema>;
export type UpdatePayableInput = z.infer<typeof updatePayableSchema>;
export type PayPayableInput = z.infer<typeof payPayableSchema>;
export type ListPayablesInput = z.infer<typeof listPayablesSchema>;
