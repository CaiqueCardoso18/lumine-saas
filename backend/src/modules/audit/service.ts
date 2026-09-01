import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import type { ListAuditInput } from './validator';

/**
 * Auditoria.
 *
 * O AuditLog já era gravado por todos os módulos, mas não havia como
 * consultá-lo — este módulo expõe a leitura com filtros e o diff do
 * antes/depois de cada alteração.
 */

function buildWhere(f: ListAuditInput): Prisma.AuditLogWhereInput {
  const { action, entityType, entityId, userId, productId, startDate, endDate, search } = f;

  return {
    ...(action && { action: action as Prisma.EnumAuditActionFilter['equals'] }),
    ...(entityType && { entityType }),
    ...(entityId && { entityId }),
    ...(userId && { userId }),
    ...(productId && { productId }),
    ...((startDate || endDate) && {
      createdAt: {
        ...(startDate && { gte: new Date(startDate) }),
        // endDate inclui o dia inteiro
        ...(endDate && { lte: new Date(`${endDate}T23:59:59.999Z`) }),
      },
    }),
    ...(search && {
      OR: [
        { entityId: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
        { product: { sku: { contains: search, mode: 'insensitive' } } },
      ],
    }),
  };
}

export async function listAuditLogs(filters: ListAuditInput) {
  const { page, limit } = filters;
  const where = buildWhere(filters);

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        product: { select: { id: true, sku: true, name: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/** Opções para os dropdowns de filtro, com contagem. */
export async function getAuditFacets(filters: ListAuditInput) {
  const [byAction, byEntity, byUser, total] = await Promise.all([
    prisma.auditLog.groupBy({
      by: ['action'],
      where: buildWhere({ ...filters, action: undefined }),
      _count: { _all: true },
    }),
    prisma.auditLog.groupBy({
      by: ['entityType'],
      where: buildWhere({ ...filters, entityType: undefined }),
      _count: { _all: true },
    }),
    prisma.auditLog.groupBy({
      by: ['userId'],
      where: buildWhere({ ...filters, userId: undefined }),
      _count: { _all: true },
    }),
    prisma.auditLog.count({ where: buildWhere(filters) }),
  ]);

  const userIds = byUser.map((u) => u.userId).filter((id): id is string => !!id);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const userNames = new Map(users.map((u) => [u.id, u.name]));

  const sortByCount = <T extends { count: number }>(a: T, b: T) => b.count - a.count;

  return {
    total,
    actions: byAction
      .map((a) => ({ value: a.action, count: a._count._all }))
      .sort(sortByCount),
    entityTypes: byEntity
      .map((e) => ({ value: e.entityType, count: e._count._all }))
      .sort(sortByCount),
    users: byUser
      .filter((u) => u.userId)
      .map((u) => ({
        value: u.userId!,
        label: userNames.get(u.userId!) ?? 'Usuário removido',
        count: u._count._all,
      }))
      .sort(sortByCount),
  };
}
