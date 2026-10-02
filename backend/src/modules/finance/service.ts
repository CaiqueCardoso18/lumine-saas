import { prisma } from '../../config/database';
import { AppError, NotFoundError } from '../../shared/errors/AppError';
import { createAuditLog } from '../../shared/utils/auditLog';
import { monthlyDueDates } from '../crediario/helpers';
import { startOfToday } from '../../shared/utils/date';
import {
  groupByDay, monthRange, summarize, type CalendarEntry,
} from './helpers';
import type {
  CalendarInput, CreatePayableInput, UpdatePayableInput,
  PayPayableInput, ListPayablesInput,
} from './validator';

/**
 * Calendário financeiro do mês: o que entra e o que sai, dia a dia.
 *
 * A receber vem das parcelas de crediário em aberto; a pagar, das contas
 * cadastradas. Parcela renegociada não aparece — ela foi substituída e
 * contá-la duplicaria a dívida.
 */
export async function getCalendar(params: CalendarInput) {
  const { start, end } = monthRange(params.year, params.month);
  // Atraso só a partir do dia seguinte ao vencimento (ver startOfToday)
  const inicioHoje = startOfToday();

  const [parcelas, contas] = await Promise.all([
    prisma.installment.findMany({
      where: { status: 'PENDING', dueDate: { gte: start, lte: end } },
      include: { customer: { select: { name: true } }, sale: { select: { saleNumber: true } } },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.payable.findMany({
      where: { status: 'PENDING', dueDate: { gte: start, lte: end } },
      include: { supplier: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
    }),
  ]);

  const entries: CalendarEntry[] = [
    ...parcelas.map((p) => ({
      id: p.id,
      kind: 'RECEIVABLE' as const,
      description: `Parcela ${p.number}/${p.totalCount} — venda #${p.sale.saleNumber}`,
      amount: Number(p.amount),
      dueDate: p.dueDate,
      overdue: p.dueDate < inicioHoje,
      party: p.customer.name,
      link: { type: 'installment' as const, id: p.id },
    })),
    ...contas.map((c) => ({
      id: c.id,
      kind: 'PAYABLE' as const,
      description: c.description,
      amount: Number(c.amount),
      dueDate: c.dueDate,
      overdue: c.dueDate < inicioHoje,
      party: c.supplier?.name ?? c.category ?? null,
      link: { type: 'payable' as const, id: c.id },
    })),
  ];

  return {
    period: { year: params.year, month: params.month, start, end },
    totals: summarize(entries),
    days: groupByDay(entries),
  };
}

export async function listPayables(params: ListPayablesInput) {
  const { page, limit, status, overdue } = params;

  // AND em vez de chaves soltas: `overdue` sobrescrevia `status`, e
  // `?status=PAID&overdue=true` devolvia contas em aberto sem avisar
  const and = [
    ...(status ? [{ status }] : []),
    ...(overdue ? [{ status: 'PENDING' as const, dueDate: { lt: startOfToday() } }] : []),
  ];
  const where = and.length > 0 ? { AND: and } : {};

  const [payables, total] = await Promise.all([
    prisma.payable.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { dueDate: 'asc' },
      include: { supplier: { select: { id: true, name: true } } },
    }),
    prisma.payable.count({ where }),
  ]);

  return { payables, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

/**
 * Cria a conta — e as repetições mensais, quando pedidas.
 *
 * As repetições usam monthlyDueDates, a mesma função do crediário: vencimento
 * dia 31 cai no último dia de fevereiro em vez de escorregar para março.
 */
export async function createPayable(input: CreatePayableInput, userId: string) {
  const primeiroVencimento = new Date(`${input.dueDate}T12:00:00`);
  if (isNaN(primeiroVencimento.getTime())) {
    throw new AppError('Data de vencimento inválida', 400);
  }

  const datas = monthlyDueDates(primeiroVencimento, input.repeatMonths);

  const criadas = await prisma.$transaction(
    datas.map((dueDate, i) =>
      prisma.payable.create({
        data: {
          description:
            input.repeatMonths > 1
              ? `${input.description} (${i + 1}/${input.repeatMonths})`
              : input.description,
          category: input.category,
          supplierId: input.supplierId,
          amount: input.amount,
          dueDate,
          notes: input.notes,
        },
      })
    )
  );

  await createAuditLog({
    prisma,
    action: 'CREATE',
    entityType: 'payable',
    entityId: criadas[0].id,
    userId,
    metadata: {
      acao: 'conta a pagar cadastrada',
      descricao: input.description,
      valor: input.amount,
      vencimentos: datas.length,
    } as object,
  });

  return criadas;
}

export async function updatePayable(id: string, input: UpdatePayableInput, userId: string) {
  const conta = await prisma.payable.findUnique({ where: { id } });
  if (!conta) throw new NotFoundError('Conta a pagar');
  if (conta.status === 'PAID') {
    throw new AppError('Conta já paga não pode ser editada', 400);
  }

  let dueDate: Date | undefined;
  if (input.dueDate) {
    dueDate = new Date(`${input.dueDate}T12:00:00`);
    if (isNaN(dueDate.getTime())) throw new AppError('Data de vencimento inválida', 400);
  }

  const atualizada = await prisma.payable.update({
    where: { id },
    data: {
      ...(input.description !== undefined && { description: input.description }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(dueDate && { dueDate }),
      ...(input.notes !== undefined && { notes: input.notes }),
    },
  });

  await createAuditLog({
    prisma,
    action: 'UPDATE',
    entityType: 'payable',
    entityId: id,
    userId,
    metadata: {
      acao: 'edição de conta a pagar',
      antes: {
        descricao: conta.description,
        valor: Number(conta.amount),
        vencimento: conta.dueDate,
      },
      depois: {
        descricao: atualizada.description,
        valor: Number(atualizada.amount),
        vencimento: atualizada.dueDate,
      },
    } as object,
  });

  return atualizada;
}

/** Marca a conta como paga. */
export async function payPayable(id: string, input: PayPayableInput, userId: string) {
  const conta = await prisma.payable.findUnique({ where: { id } });
  if (!conta) throw new NotFoundError('Conta a pagar');
  if (conta.status === 'PAID') throw new AppError('Esta conta já foi paga', 400);
  if (conta.status === 'CANCELLED') throw new AppError('Esta conta está cancelada', 400);

  const paidAmount = input.paidAmount ?? Number(conta.amount);

  const paga = await prisma.payable.update({
    where: { id },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      paidAmount,
      ...(input.notes && { notes: input.notes }),
    },
  });

  await createAuditLog({
    prisma,
    action: 'UPDATE',
    entityType: 'payable',
    entityId: id,
    userId,
    metadata: {
      acao: 'pagamento de conta',
      descricao: conta.description,
      valorPrevisto: Number(conta.amount),
      valorPago: paidAmount,
    } as object,
  });

  return paga;
}

/**
 * Cancela a conta em vez de apagar.
 *
 * Conta some do calendário mas fica no histórico — "por que a gente não pagou
 * o aluguel em março?" precisa ter resposta.
 */
export async function cancelPayable(id: string, userId: string) {
  const conta = await prisma.payable.findUnique({ where: { id } });
  if (!conta) throw new NotFoundError('Conta a pagar');
  if (conta.status === 'PAID') {
    throw new AppError('Conta já paga não pode ser cancelada', 400);
  }

  const cancelada = await prisma.payable.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });

  await createAuditLog({
    prisma,
    action: 'UPDATE',
    entityType: 'payable',
    entityId: id,
    userId,
    metadata: {
      acao: 'cancelamento de conta a pagar',
      descricao: conta.description,
      valor: Number(conta.amount),
    } as object,
  });

  return cancelada;
}
