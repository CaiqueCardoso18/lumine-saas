import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError, NotFoundError } from '../../shared/errors/AppError';
import { createAuditLog } from '../../shared/utils/auditLog';
import { searchTerms } from '../../shared/utils/search';
import { startOfToday } from '../../shared/utils/date';
import { planInstallments, computeRenegotiationTotal } from './helpers';
import type {
  ListInstallmentsInput,
  PayInstallmentInput,
  UpdateInstallmentInput,
  RenegotiateInput,
} from './validator';

/**
 * Monta o filtro das parcelas.
 *
 * Usa AND em vez de espalhar chaves soltas: `overdue` e `status` escreviam
 * ambos em `status`, e `dueUntil` sobrescrevia o `dueDate` do `overdue`, então
 * `?status=PAID&overdue=true` devolvia silenciosamente parcelas em aberto.
 */
function buildWhere(f: ListInstallmentsInput): Prisma.InstallmentWhereInput {
  const { customerId, status, overdue, dueUntil, search } = f;

  const and: Prisma.InstallmentWhereInput[] = [];

  if (customerId) and.push({ customerId });
  if (status) and.push({ status });
  // Atrasada = em aberto e vencida ANTES de hoje (ver startOfToday)
  if (overdue) and.push({ status: 'PENDING', dueDate: { lt: startOfToday() } });
  if (dueUntil) and.push({ dueDate: { lte: new Date(`${dueUntil}T23:59:59.999Z`) } });
  if (search) {
    and.push({
      customer: {
        AND: searchTerms(search).map((term) => ({ searchText: { contains: term } })),
      },
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

export async function listInstallments(params: ListInstallmentsInput) {
  const { page, limit } = params;
  const where = buildWhere(params);

  const [installments, total] = await Promise.all([
    prisma.installment.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        sale: { select: { id: true, saleNumber: true, createdAt: true } },
      },
    }),
    prisma.installment.count({ where }),
  ]);

  return {
    installments,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/** Resumo do crediário para os cards do topo da tela. */
export async function getCrediarioSummary() {
  const hoje = new Date();

  const [pending, overdue, paidThisMonth, debtors] = await Promise.all([
    prisma.installment.aggregate({
      where: { status: 'PENDING' },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.installment.aggregate({
      where: { status: 'PENDING', dueDate: { lt: startOfToday() } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.installment.aggregate({
      where: {
        status: 'PAID',
        paidAt: { gte: new Date(hoje.getFullYear(), hoje.getMonth(), 1) },
      },
      _sum: { paidAmount: true },
      _count: { _all: true },
    }),
    prisma.installment.groupBy({
      by: ['customerId'],
      where: { status: 'PENDING' },
      _sum: { amount: true },
    }),
  ]);

  return {
    openAmount: Number(pending._sum.amount ?? 0),
    openCount: pending._count._all,
    overdueAmount: Number(overdue._sum.amount ?? 0),
    overdueCount: overdue._count._all,
    receivedThisMonth: Number(paidThisMonth._sum.paidAmount ?? 0),
    receivedCount: paidThisMonth._count._all,
    debtorCount: debtors.length,
  };
}

/** Devedores agrupados, ordenados por quem deve mais. */
export async function listDebtors() {
  // Atraso só conta a partir do dia seguinte ao vencimento
  const inicioHoje = startOfToday();

  const pending = await prisma.installment.findMany({
    where: { status: 'PENDING' },
    include: { customer: { select: { id: true, name: true, phone: true } } },
    orderBy: { dueDate: 'asc' },
  });

  const map = new Map<string, {
    customer: { id: string; name: string; phone: string | null };
    openAmount: number;
    openCount: number;
    overdueAmount: number;
    overdueCount: number;
    nextDueDate: Date;
  }>();

  for (const inst of pending) {
    const key = inst.customerId;
    const amount = Number(inst.amount);
    const isOverdue = inst.dueDate < inicioHoje;

    const entry = map.get(key) ?? {
      customer: inst.customer,
      openAmount: 0,
      openCount: 0,
      overdueAmount: 0,
      overdueCount: 0,
      nextDueDate: inst.dueDate,
    };

    entry.openAmount += amount;
    entry.openCount += 1;
    if (isOverdue) {
      entry.overdueAmount += amount;
      entry.overdueCount += 1;
    }
    // como vem ordenado por dueDate, o primeiro é o próximo vencimento
    if (inst.dueDate < entry.nextDueDate) entry.nextDueDate = inst.dueDate;

    map.set(key, entry);
  }

  return Array.from(map.values()).sort(
    (a, b) => b.overdueAmount - a.overdueAmount || b.openAmount - a.openAmount
  );
}

/** Dá baixa numa parcela. */
export async function payInstallment(id: string, input: PayInstallmentInput, userId: string) {
  const installment = await prisma.installment.findUnique({
    where: { id },
    include: { customer: { select: { name: true } } },
  });

  if (!installment) throw new NotFoundError('Parcela');
  if (installment.status === 'PAID') {
    throw new AppError('Esta parcela já foi paga', 400);
  }
  if (installment.status === 'CANCELLED') {
    throw new AppError('Esta parcela está cancelada', 400);
  }

  const paidAmount = input.paidAmount ?? Number(installment.amount);

  const updated = await prisma.installment.update({
    where: { id },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      paidAmount,
      paidMethod: input.paidMethod,
      ...(input.notes && { notes: input.notes }),
    },
  });

  await createAuditLog({
    prisma,
    action: 'UPDATE',
    entityType: 'installment',
    entityId: id,
    userId,
    metadata: {
      acao: 'baixa de parcela',
      cliente: installment.customer.name,
      parcela: `${installment.number}/${installment.totalCount}`,
      valorParcela: Number(installment.amount),
      valorPago: paidAmount,
      forma: input.paidMethod,
    } as object,
  });

  return updated;
}

/** Desfaz a baixa — para corrigir lançamento errado. */
export async function reopenInstallment(id: string, userId: string) {
  const installment = await prisma.installment.findUnique({ where: { id } });
  if (!installment) throw new NotFoundError('Parcela');
  if (installment.status !== 'PAID') {
    throw new AppError('Só é possível reabrir uma parcela paga', 400);
  }

  const updated = await prisma.installment.update({
    where: { id },
    data: { status: 'PENDING', paidAt: null, paidAmount: null, paidMethod: null },
  });

  await createAuditLog({
    prisma,
    action: 'UPDATE',
    entityType: 'installment',
    entityId: id,
    userId,
    metadata: {
      acao: 'reabertura de parcela',
      valorEstornado: Number(installment.paidAmount ?? 0),
    } as object,
  });

  return updated;
}

/**
 * Edita uma parcela em aberto: valor, vencimento ou observação.
 *
 * Parcela paga fica de fora de propósito — mexer no valor de algo já recebido
 * faria o caixa e a parcela contarem histórias diferentes. Para corrigir uma
 * paga, reabra primeiro (`/reopen`) e edite depois.
 */
export async function updateInstallment(
  id: string,
  input: UpdateInstallmentInput,
  userId: string
) {
  const installment = await prisma.installment.findUnique({
    where: { id },
    include: { customer: { select: { name: true } } },
  });

  if (!installment) throw new NotFoundError('Parcela');
  if (installment.status === 'PAID') {
    throw new AppError('Reabra a parcela antes de editar — ela já foi paga', 400);
  }
  if (installment.status !== 'PENDING') {
    throw new AppError('Só é possível editar parcela em aberto', 400);
  }

  let dueDate: Date | undefined;
  if (input.dueDate) {
    // Meio-dia evita a data "voltar um dia" por causa de fuso
    dueDate = new Date(`${input.dueDate}T12:00:00`);
    if (isNaN(dueDate.getTime())) throw new AppError('Data de vencimento inválida', 400);
  }

  const updated = await prisma.installment.update({
    where: { id },
    data: {
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(dueDate && { dueDate }),
      ...(input.notes !== undefined && { notes: input.notes }),
    },
  });

  await createAuditLog({
    prisma,
    action: 'UPDATE',
    entityType: 'installment',
    entityId: id,
    userId,
    metadata: {
      acao: 'edição de parcela',
      cliente: installment.customer.name,
      parcela: `${installment.number}/${installment.totalCount}`,
      antes: {
        valor: Number(installment.amount),
        vencimento: installment.dueDate,
        observacao: installment.notes,
      },
      depois: {
        valor: Number(updated.amount),
        vencimento: updated.dueDate,
        observacao: updated.notes,
      },
    } as object,
  });

  return updated;
}

/**
 * Junta várias parcelas em aberto do mesmo cliente num plano novo.
 *
 * É o "a Monique quer juntar tudo e pagar de 15 em 15": soma o que está em
 * aberto, aplica desconto ou acréscimo se houver, e recria em N parcelas na
 * cadência escolhida. As antigas NÃO somem — viram RENEGOTIATED apontando
 * para a primeira parcela nova, para a loja conseguir explicar depois o que
 * aconteceu com a dívida antiga.
 *
 * As parcelas novas ficam penduradas na venda mais recente do grupo, já que
 * `Installment` exige uma venda e não existe "venda de renegociação".
 */
export async function renegotiateInstallments(input: RenegotiateInput, userId: string) {
  const antigas = await prisma.installment.findMany({
    where: { id: { in: input.installmentIds } },
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { dueDate: 'asc' },
  });

  if (antigas.length !== input.installmentIds.length) {
    throw new AppError('Alguma das parcelas não foi encontrada', 404);
  }

  const pendentes = antigas.filter((i) => i.status === 'PENDING');
  if (pendentes.length !== antigas.length) {
    throw new AppError('Só é possível renegociar parcelas em aberto', 400);
  }

  // Misturar clientes criaria uma dívida que não é de ninguém
  const clientes = new Set(antigas.map((i) => i.customerId));
  if (clientes.size > 1) {
    throw new AppError('As parcelas precisam ser todas do mesmo cliente', 400);
  }

  const { somaAntiga, novoTotal } = computeRenegotiationTotal(
    antigas.map((i) => Number(i.amount)),
    input.adjustment
  );
  if (novoTotal <= 0) {
    throw new AppError('O total renegociado precisa ser maior que zero', 400);
  }

  const firstDue = new Date(`${input.firstDueDate}T12:00:00`);
  if (isNaN(firstDue.getTime())) throw new AppError('Data de vencimento inválida', 400);

  const plano = planInstallments(novoTotal, input.count, firstDue, input.frequency);

  // A venda mais recente do grupo carrega as parcelas novas
  const saleId = antigas[antigas.length - 1].saleId;
  const customerId = antigas[0].customerId;
  const clienteNome = antigas[0].customer.name;

  const novas = await prisma.$transaction(async (tx) => {
    const criadas = [];
    for (const p of plano) {
      criadas.push(
        await tx.installment.create({
          data: {
            saleId,
            customerId,
            number: p.number,
            totalCount: p.totalCount,
            amount: p.amount,
            dueDate: p.dueDate,
            status: 'PENDING',
            notes: input.notes ?? `Renegociação de ${antigas.length} parcela(s)`,
          },
        })
      );
    }

    /**
     * O filtro de status se repete aqui de propósito.
     *
     * A checagem lá em cima roda fora da transação; se alguém der baixa numa
     * das parcelas nesse meio-tempo, sem este filtro a parcela paga viraria
     * RENEGOTIATED e o pagamento sumiria do controle.
     */
    const substituidas = await tx.installment.updateMany({
      where: { id: { in: input.installmentIds }, status: 'PENDING' },
      data: { status: 'RENEGOTIATED', renegotiatedIntoId: criadas[0].id },
    });

    if (substituidas.count !== input.installmentIds.length) {
      throw new AppError(
        'Alguma das parcelas mudou de situação durante a renegociação. ' +
          'Confira a lista e tente de novo.',
        409
      );
    }

    return criadas;
  });

  await createAuditLog({
    prisma,
    action: 'UPDATE',
    entityType: 'installment',
    entityId: novas[0].id,
    userId,
    metadata: {
      acao: 'renegociação de dívida',
      cliente: clienteNome,
      parcelasAntigas: antigas.map((i) => ({
        id: i.id,
        parcela: `${i.number}/${i.totalCount}`,
        valor: Number(i.amount),
        vencimento: i.dueDate,
      })),
      somaAntiga,
      ajuste: input.adjustment,
      novoTotal,
      novasParcelas: novas.length,
      frequencia: input.frequency,
    } as object,
  });

  return {
    customerId,
    somaAntiga,
    adjustment: input.adjustment,
    novoTotal,
    substituidas: antigas.length,
    installments: novas,
  };
}
