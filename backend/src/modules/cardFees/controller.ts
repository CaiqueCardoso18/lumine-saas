import { Request, Response, NextFunction } from 'express';
import { listCardFees, replaceCardFees } from './service';
import { sendSuccess } from '../../shared/utils/response';

export async function index(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await listCardFees());
  } catch (err) {
    next(err);
  }
}

export async function replace(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await replaceCardFees(req.body, req.user!.userId));
  } catch (err) {
    next(err);
  }
}
