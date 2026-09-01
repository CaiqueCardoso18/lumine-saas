import { z } from 'zod';

export const listAuditSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  userId: z.string().optional(),
  productId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  /** Busca livre no entityId e no nome/SKU do produto */
  search: z.string().optional(),
});

export type ListAuditInput = z.infer<typeof listAuditSchema>;
