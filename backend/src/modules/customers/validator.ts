import { z } from 'zod';

const optionalText = (max: number) =>
  z.string().max(max).optional().or(z.literal('').transform(() => undefined));

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200).trim(),
  phone: optionalText(30),
  email: z.string().email('Email inválido').optional().or(z.literal('').transform(() => undefined)),
  document: optionalText(20),
  address: optionalText(300),
  notes: optionalText(1000),
});

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  active: z.boolean().optional(),
});

export const listCustomersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  /** Só clientes com parcela em aberto */
  withDebt: z.coerce.boolean().optional(),
  active: z.coerce.boolean().optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ListCustomersInput = z.infer<typeof listCustomersSchema>;
