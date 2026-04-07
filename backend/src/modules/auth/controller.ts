import { Request, Response, NextFunction } from 'express';
import { loginService, registerService, getMeService, refreshTokenService } from './service';
import { sendSuccess } from '../../shared/utils/response';
import { env } from '../../config/env';

const COOKIE_OPTIONS = {
  httpOnly: true,
  // COOKIE_SECURE=true só quando houver HTTPS (não setar em HTTP puro)
  secure: process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
};

const REFRESH_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
  path: '/api/auth/refresh',
};

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await loginService(req.body);

    res.cookie('token', result.token, COOKIE_OPTIONS);
    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    return sendSuccess(res, { user: result.user });
  } catch (err) {
    next(err);
  }
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const requestingRole = req.user?.role;
    const user = await registerService(req.body, requestingRole);
    return sendSuccess(res, user, 201);
  } catch (err) {
    next(err);
  }
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie('token');
  res.clearCookie('refreshToken');
  return sendSuccess(res, { message: 'Logout realizado com sucesso' });
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getMeService(req.user!.userId);
    return sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.refreshToken;
    const result = await refreshTokenService(token);

    res.cookie('token', result.token, COOKIE_OPTIONS);
    return sendSuccess(res, { message: 'Token renovado' });
  } catch (err) {
    next(err);
  }
}
