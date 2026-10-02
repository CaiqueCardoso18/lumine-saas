import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { UnauthorizedError, ForbiddenError } from '../shared/errors/AppError';

// A lista de permissões vive em ./permissions.ts (sem Prisma, para ser
// testável isolada) e é reexportada aqui para não quebrar quem já importava
// daqui.
export { PERMISSIONS, DEFAULT_EMPLOYEE_PERMISSIONS } from './permissions';
export type { Permission } from './permissions';

import type { Permission } from './permissions';

/** Cache curto para não bater no banco a cada request do mesmo usuário. */
const cache = new Map<string, { permissions: string[]; expires: number }>();
const CACHE_MS = 30_000;

async function getPermissions(userId: string): Promise<string[]> {
  const hit = cache.get(userId);
  if (hit && hit.expires > Date.now()) return hit.permissions;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { permissions: true, active: true },
  });

  if (!user || !user.active) {
    cache.delete(userId);
    throw new ForbiddenError('Usuário inativo');
  }

  const permissions = Array.isArray(user.permissions) ? (user.permissions as string[]) : [];
  cache.set(userId, { permissions, expires: Date.now() + CACHE_MS });
  return permissions;
}

/** Invalida o cache — chamar ao alterar permissões de um usuário. */
export function invalidatePermissionCache(userId?: string) {
  if (userId) cache.delete(userId);
  else cache.clear();
}

/**
 * Exige uma permissão específica.
 *
 * Importante: até agora as permissões só existiam no frontend (usePermission),
 * então um EMPLOYEE conseguia chamar a API direto e fazer o que quisesse.
 * Este middleware fecha isso no servidor.
 */
export function requirePermission(...required: Permission[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new UnauthorizedError();

      // OWNER tem acesso total
      if (req.user.role === 'OWNER') return next();

      const permissions = await getPermissions(req.user.userId);
      const missing = required.filter((p) => !permissions.includes(p));

      if (missing.length > 0) {
        throw new ForbiddenError(
          'Você não tem permissão para esta ação. Fale com o administrador.'
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Retorna true se o usuário da request pode ver preço de custo.
 * Usado nos services para omitir custo/margem da resposta.
 */
export async function canViewCostPrice(req: Request): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.role === 'OWNER') return true;
  const permissions = await getPermissions(req.user.userId);
  return permissions.includes('view_cost_price');
}
