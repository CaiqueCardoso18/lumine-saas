import { Request, Response, NextFunction } from 'express';
import {
  createSession, listSessions, getSession, addCounts, applySession, cancelSession,
  createMovement, listMovements, getMovementsByProduct,
} from './service';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';

// ─── Sessões de Inventário ───────────────────────────────────

export async function createSessionCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await createSession(req.body, req.user!.userId);
    return sendSuccess(res, session, 201);
  } catch (err) { next(err); }
}

export async function listSessionsCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listSessions(req.query as unknown as Parameters<typeof listSessions>[0]);
    return sendPaginated(res, result.sessions, result.meta);
  } catch (err) { next(err); }
}

export async function getSessionCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await getSession(req.params.id);
    return sendSuccess(res, session);
  } catch (err) { next(err); }
}

export async function addCountsCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const counts = await addCounts(req.params.id, req.body, req.user!.userId);
    return sendSuccess(res, counts);
  } catch (err) { next(err); }
}

export async function applySessionCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await applySession(req.params.id, req.user!.userId);
    return sendSuccess(res, session);
  } catch (err) { next(err); }
}

export async function cancelSessionCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await cancelSession(req.params.id);
    return sendSuccess(res, session);
  } catch (err) { next(err); }
}

// ─── Movimentações de Estoque ────────────────────────────────

export async function createMovementCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const movement = await createMovement(req.body, req.user!.userId);
    return sendSuccess(res, movement, 201);
  } catch (err) { next(err); }
}

export async function listMovementsCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listMovements(req.query as unknown as Parameters<typeof listMovements>[0]);
    return sendPaginated(res, result.movements, result.meta);
  } catch (err) { next(err); }
}

export async function productMovementsCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const movements = await getMovementsByProduct(req.params.productId);
    return sendSuccess(res, movements);
  } catch (err) { next(err); }
}
