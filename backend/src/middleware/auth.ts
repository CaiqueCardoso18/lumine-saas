import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { env } from '../config/env';
import { UnauthorizedError, ForbiddenError } from '../shared/errors/AppError';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token =
      req.cookies?.token ||
      req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedError('Token de autenticação ausente');
    }

    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Token inválido ou expirado'));
    } else {
      next(err);
    }
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('Permissão insuficiente para esta ação'));
    }
    next();
  };
}
