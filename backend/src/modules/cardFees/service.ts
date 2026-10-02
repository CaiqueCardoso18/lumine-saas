import { prisma } from '../../config/database';
import { createAuditLog } from '../../shared/utils/auditLog';
import type { FeeRow } from '../sales/helpers';
import type { ReplaceCardFeesInput } from './validator';

/**
 * Linha da tabela de taxas. O tipo é o mesmo usado no cálculo da venda, e é
 * estreito de propósito: só débito e crédito têm taxa de maquininha, e o
 * validator já garante que nada mais entra na tabela.
 */
export type CardFeeRow = FeeRow;

export async function listCardFees(): Promise<CardFeeRow[]> {
  const fees = await prisma.cardFee.findMany({
    orderBy: [{ method: 'asc' }, { installments: 'asc' }],
  });
  return fees.map((f) => ({
    method: f.method as CardFeeRow['method'],
    installments: f.installments,
    feePercent: Number(f.feePercent),
  }));
}

/**
 * Substitui a tabela inteira.
 *
 * A tela edita tudo junto, e apagar-e-regravar dentro de uma transação evita
 * o estado intermediário em que uma venda simultânea leria meia tabela.
 */
export async function replaceCardFees(input: ReplaceCardFeesInput, userId: string) {
  const antes = await listCardFees();

  await prisma.$transaction(async (tx) => {
    await tx.cardFee.deleteMany();
    if (input.fees.length > 0) {
      await tx.cardFee.createMany({ data: input.fees });
    }
  });

  await createAuditLog({
    userId,
    action: 'UPDATE',
    entityType: 'CardFee',
    entityId: 'tabela',
    metadata: { antes, depois: input.fees } as object,
  });

  return listCardFees();
}

// resolveFeePercent e calcFee vivem em ../sales/helpers.ts, junto do resto do
// cálculo de pagamento — duas cópias da mesma regra acabariam divergindo.
export { resolveFeePercent, calcFee } from '../sales/helpers';
