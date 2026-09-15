import { Request, Response, NextFunction } from 'express';
import {
  listInstallments, getCrediarioSummary, listDebtors, payInstallment, reopenInstallment,
} from './service';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';

export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await listInstallments(req.query as unknown as Parameters<typeof listInstallments>[0]);
    return sendPaginated(res, r.installments, r.meta);
  } catch (err) { next(err); }
}

export async function summary(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await getCrediarioSummary());
  } catch (err) { next(err); }
}

export async function debtors(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await listDebtors());
  } catch (err) { next(err); }
}

export async function pay(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await payInstallment(req.params.id, req.body, req.user!.userId));
  } catch (err) { next(err); }
}

export async function reopen(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await reopenInstallment(req.params.id, req.user!.userId));
  } catch (err) { next(err); }
}
