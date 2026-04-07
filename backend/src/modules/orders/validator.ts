import { z } from 'zod';

export const createSupplierSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  contactName: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().max(500).optional(),
});

const orderItemSchema = z.object({
  productId: z.string().cuid(),
  quantityOrdered: z.number().int().min(1),
  unitCost: z.number().min(0),
});

export const createOrderSchema = z.object({
  supplierId: z.string().cuid().nullable().optional(),
  items: z.array(orderItemSchema).min(1, 'Pedido deve ter ao menos um item'),
  notes: z.string().max(500).nullable().optional(),
});

export const updateOrderSchema = z.object({
  supplierId: z.string().cuid().optional(),
  notes: z.string().max(500).optional(),
  items: z.array(orderItemSchema.extend({
    quantityReceived: z.number().int().min(0).optional(),
  })).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'RECEIVED', 'CHECKED', 'CANCELLED']),
  notes: z.string().max(500).nullable().optional(),
});

export const listOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'SENT', 'RECEIVED', 'CHECKED', 'CANCELLED']).optional(),
  supplierId: z.string().optional(),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type ListOrdersInput = z.infer<typeof listOrdersSchema>;
