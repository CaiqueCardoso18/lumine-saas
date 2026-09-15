import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError, NotFoundError } from '../../shared/errors/AppError';
import { createAuditLog } from '../../shared/utils/auditLog';
import { searchTerms } from '../../shared/utils/search';
import type { ListInstallmentsInput, PayInstallmentInput } from './validator';

function buildWhere(f: ListInstallmentsInput): Prisma.InstallmentWhereInput {
  const { customerId, status, overdue, dueUntil, search } = f;

  return {
    ...(customerId && { customerId }),
    ...(status && { status }),
    ...(overdue && { status: 'PENDING', dueDate: { lt: new Date() } }),
    ...(dueUntil && { dueDate: { lte: new Date(`${dueUntil}T23:59:59.999Z`) } }),
    ...(search && {
      customer: {
        AND: searchTerms(search).map((term) => ({ searchText: { contains: term } })),
      },
    }),
  };
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
      where: { status: 'PENDING', dueDate: { lt: hoje } },
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
  const hoje = new Date();

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
    const isOverdue = inst.dueDate < hoje;

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
