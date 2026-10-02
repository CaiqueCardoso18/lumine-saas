import { z } from 'zod';

/** Só cartão tem taxa de maquininha — dinheiro, PIX e crediário não. */
export const CARD_METHODS = ['DEBIT_CARD', 'CREDIT_CARD'] as const;

export const upsertCardFeeSchema = z.object({
  method: z.enum(CARD_METHODS),
  installments: z.coerce.number().int().min(1).max(24).default(1),
  feePercent: z.coerce
    .number()
    .min(0, 'Taxa não pode ser negativa')
    .max(100, 'Taxa não pode passar de 100%'),
}).refine(
  (d) => d.method !== 'DEBIT_CARD' || d.installments === 1,
  { message: 'Débito não tem parcelas', path: ['installments'] }
);

/** Salva a tabela inteira de uma vez — é assim que a tela de Configurações edita. */
export const replaceCardFeesSchema = z.object({
  fees: z.array(upsertCardFeeSchema).max(50),
}).refine(
  (d) => {
    // O model tem @@unique(method, installments): duplicata derrubava o
    // createMany com erro 500 em vez de uma mensagem de validação
    const chaves = d.fees.map((f) => `${f.method}-${f.installments}`);
    return new Set(chaves).size === chaves.length;
  },
  { message: 'Há mais de uma taxa para a mesma forma e número de parcelas', path: ['fees'] }
);

export type UpsertCardFeeInput = z.infer<typeof upsertCardFeeSchema>;
export type ReplaceCardFeesInput = z.infer<typeof replaceCardFeesSchema>;
