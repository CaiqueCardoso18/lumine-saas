import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AppError, ConflictError, UnauthorizedError } from '../../shared/errors/AppError';
import { JwtPayload } from '../../middleware/auth';
import type { LoginInput, RegisterInput } from './validator';

function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export async function loginService(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user || !user.active) {
    throw new UnauthorizedError('Email ou senha incorretos');
  }

  const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatch) {
    throw new UnauthorizedError('Email ou senha incorretos');
  }

  const payload: JwtPayload = { userId: user.id, email: user.email, role: user.role };
  const token = generateToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {
    token,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

export async function registerService(input: RegisterInput, requestingUserRole?: string) {
  // Apenas OWNER pode criar outros OWNER
  if (input.role === 'OWNER' && requestingUserRole !== 'OWNER') {
    throw new AppError('Apenas administradores podem criar outros administradores', 403);
  }

  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) {
    throw new ConflictError('Este email já está cadastrado');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return user;
}

export async function getMeService(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, active: true, permissions: true, createdAt: true },
  });

  if (!user || !user.active) {
    throw new UnauthorizedError('Usuário não encontrado ou inativo');
  }

  return user;
}

export async function refreshTokenService(token: string) {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.active) {
      throw new UnauthorizedError('Usuário inativo');
    }

    const newPayload: JwtPayload = { userId: user.id, email: user.email, role: user.role };
    const newToken = generateToken(newPayload);

    return { token: newToken };
  } catch {
    throw new UnauthorizedError('Token de refresh inválido ou expirado');
  }
}
