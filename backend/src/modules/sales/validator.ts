import { z } from 'zod';

const saleItemSchema = z.object({
  productId: z.string().cuid('productId inválido'),
  quantity: z.number().int().min(1, 'Quantidade mínima é 1'),
  unitPrice: z.number().min(0, 'Preço não pode ser negativo'),
  discount: z.number().min(0).default(0),
});

const salePaymentSchema = z.object({
  method: z.enum(['CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'CREDIARIO']),
  amount: z.number().min(0.01),
  /** Parcelas do cartão de crédito nesta forma específica */
  installments: z.number().int().min(1).max(24).optional(),
});

export const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'A venda deve ter ao menos um item'),
  paymentMethod: z.enum(['CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'CREDIARIO', 'MIXED']),
  payments: z.array(salePaymentSchema).optional(),
  installments: z.number().int().min(1).max(24).default(1), // parcelas cartão de crédito
  discountAmount: z.number().min(0).default(0),
  discountPercent: z.number().min(0).max(100).optional(),
  notes: z.string().max(1000).optional(),
  /** Opcional: venda de balcão não exige cliente */
  customerId: z.string().cuid('Cliente inválido').optional(),
  /** Crediário */
  crediarioCount: z.number().int().min(1).max(36).optional(),
  crediarioFirstDueDate: z.string().optional(),
  /** Cadência das parcelas. Padrão mensal, como era antes. */
  crediarioFrequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']).default('MONTHLY'),
  /**
   * Entrada paga na hora, em reais. Sai do valor financiado e entra no caixa
   * do dia como pagamento à vista, na forma escolhida em `downPaymentMethod`.
   */
  downPayment: z.number().min(0).default(0),
  downPaymentMethod: z.enum(['CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD']).default('CASH'),
})
  .refine(
    (data) => {
      // Entrada só faz sentido no crediário — fora dele não há o que financiar
      const usaCrediario =
        data.paymentMethod === 'CREDIARIO' ||
        (data.paymentMethod === 'MIXED' &&
          data.payments?.some((p) => p.method === 'CREDIARIO'));
      return data.downPayment === 0 || usaCrediario;
    },
    { message: 'Entrada só se aplica a venda no crediário', path: ['downPayment'] }
  )
  .refine(
    (data) => {
      if (data.paymentMethod === 'MIXED') {
        return data.payments && data.payments.length >= 2;
      }
      return true;
    },
    { message: 'Pagamento misto requer ao menos 2 formas de pagamento', path: ['payments'] }
  )
  .refine(
    (data) => {
      // Crediário só existe amarrado a um cliente — senão não há de quem cobrar
      const usaCrediario =
        data.paymentMethod === 'CREDIARIO' ||
        (data.paymentMethod === 'MIXED' &&
          data.payments?.some((p) => p.method === 'CREDIARIO'));
      return !usaCrediario || !!data.customerId;
    },
    { message: 'Venda no crediário exige um cliente', path: ['customerId'] }
  );

/**
 * Edição de venda já registrada.
 *
 * Só OWNER pode, e o estoque é ajustado pela DIFERENÇA entre como a venda
 * estava e como vai ficar. Itens, desconto, observação e cliente podem mudar;
 * a forma de pagamento também, desde que a soma continue fechando.
 *
 * Venda com crediário fica de fora: mexer no total depois de as parcelas
 * existirem exigiria refazer o plano e possivelmente desfazer baixas já
 * dadas. Para esses casos o caminho é estornar e refazer.
 */
export const updateSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'A venda deve ter ao menos um item'),
  paymentMethod: z.enum(['CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'MIXED']),
  payments: z.array(
    z.object({
      method: z.enum(['CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD']),
      amount: z.number().min(0.01),
      installments: z.number().int().min(1).max(24).optional(),
    })
  ).optional(),
  installments: z.number().int().min(1).max(24).default(1),
  discountAmount: z.number().min(0).default(0),
  discountPercent: z.number().min(0).max(100).optional(),
  notes: z.string().max(1000).optional(),
  customerId: z.string().cuid('Cliente inválido').nullish(),
  /** Motivo da alteração — vai para a auditoria */
  reason: z.string().min(1, 'Informe o motivo da alteração').max(500),
}).refine(
  (data) => data.paymentMethod !== 'MIXED' || (data.payments && data.payments.length >= 2),
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
  sortBy: z.enum(['createdAt', 'total', 'saleNumber']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;
export type CancelSaleInput = z.infer<typeof cancelSaleSchema>;
export type ListSalesInput = z.infer<typeof listSalesSchema>;
