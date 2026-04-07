import { z } from 'zod';

const saleItemSchema = z.object({
  productId: z.string().cuid('productId inválido'),
  quantity: z.number().int().min(1, 'Quantidade mínima é 1'),
  unitPrice: z.number().min(0, 'Preço não pode ser negativo'),
  discount: z.number().min(0).default(0),
});

const salePaymentSchema = z.object({
  method: z.enum(['CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD']),
  amount: z.number().min(0.01),
});

export const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'A venda deve ter ao menos um item'),
  paymentMethod: z.enum(['CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'MIXED']),
  payments: z.array(salePaymentSchema).optional(),
  installments: z.number().int().min(1).max(24).default(1), // parcelas cartão de crédito
  discountAmount: z.number().min(0).default(0),
  discountPercent: z.number().min(0).max(100).optional(),
  notes: z.string().max(500).optional(),
}).refine(
  (data) => {
    if (data.paymentMethod === 'MIXED') {
      return data.payments && data.payments.length >= 2;
    }
    return true;
  },
  { message: 'Pagamento misto requer ao menos 2 formas de pagamento', path: ['payments'] }
);

export const cancelSaleSchema = z.object({
  reason: z.string().min(1, 'Motivo do cancelamento é obrigatório').max(500),
});

export const listSalesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'MIXED']).optional(),
  status: z.enum(['COMPLETED', 'CANCELLED']).optional(),
  minTotal: z.coerce.number().optional(),
  maxTotal: z.coerce.number().optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type CancelSaleInput = z.infer<typeof cancelSaleSchema>;
export type ListSalesInput = z.infer<typeof listSalesSchema>;
