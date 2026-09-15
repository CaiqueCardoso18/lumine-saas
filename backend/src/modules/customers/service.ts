import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors/AppError';
import { createAuditLog } from '../../shared/utils/auditLog';
import { normalizeText, searchTerms } from '../../shared/utils/search';
import type {
  CreateCustomerInput, UpdateCustomerInput, ListCustomersInput,
} from './validator';

/**
 * Monta o searchText do cliente.
 * Só dígitos do telefone/CPF também entram, para achar digitando "11987654321"
 * mesmo que esteja salvo como "(11) 98765-4321".
 */
function buildCustomerSearchText(c: {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  document?: string | null;
}): string {
  const digits = (v?: string | null) => (v ? v.replace(/\D/g, '') : '');
  const parts = [c.name, c.phone, digits(c.phone), c.email, c.document, digits(c.document)]
    .filter((v): v is string => !!v && v.trim() !== '');
  return normalizeText(parts.join(' '));
}

export async function listCustomers(params: ListCustomersInput) {
  const { page, limit, search, withDebt, active } = params;

  const where: Prisma.CustomerWhereInput = {
    deletedAt: null,
    ...(active !== undefined && { active }),
    ...(search && {
      AND: searchTerms(search).map((term) => ({ searchText: { contains: term } })),
    }),
    ...(withDebt && {
      installments: { some: { status: 'PENDING' } },
    }),
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { sales: true } },
        installments: {
          where: { status: 'PENDING' },
          select: { amount: true, dueDate: true },
        },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  const hoje = new Date();

  // Saldo devedor e atraso calculados a partir das parcelas em aberto
  const withTotals = customers.map((c) => {
    const openAmount = c.installments.reduce((acc, i) => acc + Number(i.amount), 0);
    const overdueCount = c.installments.filter((i) => i.dueDate < hoje).length;
    const { installments, ...rest } = c;
    return {
      ...rest,
      salesCount: c._count.sales,
      openAmount,
      openCount: installments.length,
      overdueCount,
    };
  });

  return {
    customers: withTotals,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getCustomerById(id: string) {
  const customer = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
    include: {
      sales: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true, saleNumber: true, total: true, paymentMethod: true,
          status: true, createdAt: true,
        },
      },
      installments: {
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
        include: { sale: { select: { saleNumber: true } } },
      },
    },
  });

  if (!customer) throw new NotFoundError('Cliente');

  const hoje = new Date();
  const pending = customer.installments.filter((i) => i.status === 'PENDING');

  return {
    ...customer,
    summary: {
      salesCount: customer.sales.length,
      totalPurchased: customer.sales
        .filter((s) => s.status === 'COMPLETED')
        .reduce((acc, s) => acc + Number(s.total), 0),
      openAmount: pending.reduce((acc, i) => acc + Number(i.amount), 0),
      openCount: pending.length,
      overdueCount: pending.filter((i) => i.dueDate < hoje).length,
      overdueAmount: pending
        .filter((i) => i.dueDate < hoje)
        .reduce((acc, i) => acc + Number(i.amount), 0),
    },
  };
}

export async function createCustomer(input: CreateCustomerInput, userId: string) {
  const customer = await prisma.customer.create({
    data: { ...input, searchText: buildCustomerSearchText(input) },
  });

  await createAuditLog({
    prisma,
    action: 'CREATE',
    entityType: 'customer',
    entityId: customer.id,
    userId,
    newValue: customer as unknown as object,
  });

  return customer;
}

export async function updateCustomer(id: string, input: UpdateCustomerInput, userId: string) {
  const existing = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError('Cliente');

  const merged = { ...existing, ...input };
  const customer = await prisma.customer.update({
    where: { id },
    data: { ...input, searchText: buildCustomerSearchText(merged) },
  });

  await createAuditLog({
    prisma,
    action: 'UPDATE',
    entityType: 'customer',
    entityId: id,
    userId,
    oldValue: existing as unknown as object,
    newValue: customer as unknown as object,
  });

  return customer;
}

export async function softDeleteCustomer(id: string, userId: string) {
  const existing = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError('Cliente');

  // Não deixa remover quem ainda deve — senão a dívida some do sistema
  const pending = await prisma.installment.count({
    where: { customerId: id, status: 'PENDING' },
  });
  if (pending > 0) {
    throw new NotFoundError(
      `Cliente tem ${pending} parcela(s) em aberto. Quite ou cancele antes de remover.`
    );
  }

  await prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });

  await createAuditLog({
    prisma,
    action: 'DELETE',
    entityType: 'customer',
    entityId: id,
    userId,
    oldValue: existing as unknown as object,
  });
}
