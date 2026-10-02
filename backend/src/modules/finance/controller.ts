import { Request, Response, NextFunction } from 'express';
import {
  getCalendar, listPayables, createPayable, updatePayable, payPayable, cancelPayable,
} from './service';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';

export async function calendar(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await getCalendar(req.query as unknown as Parameters<typeof getCalendar>[0]));
  } catch (err) { next(err); }
}

export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await listPayables(req.query as unknown as Parameters<typeof listPayables>[0]);
    return sendPaginated(res, r.payables, r.meta);
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await createPayable(req.body, req.user!.userId), 201);
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await updatePayable(req.params.id, req.body, req.user!.userId));
  } catch (err) { next(err); }
}

export async function pay(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await payPayable(req.params.id, req.body, req.user!.userId));
  } catch (err) { next(err); }
}

export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await cancelPayable(req.params.id, req.user!.userId));
  } catch (err) { next(err); }
}
