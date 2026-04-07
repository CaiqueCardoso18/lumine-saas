import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../shared/errors/AppError';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Zod validation errors
  if (err instanceof ZodError) {
    const errors = err.flatten().fieldErrors;
    return res.status(422).json({
      success: false,
      error: 'Dados inválidos',
      details: errors,
    });
  }

  // Operational errors (AppError)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const field = (err.meta?.target as string[])?.join(', ') ?? 'campo';
      return res.status(409).json({
        success: false,
        error: `Já existe um registro com esse ${field}`,
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Registro não encontrado',
      });
    }
  }

  // Unknown errors
  console.error('Unexpected error:', err);
  return res.status(500).json({
    success: false,
    error: 'Erro interno do servidor',
  });
}
