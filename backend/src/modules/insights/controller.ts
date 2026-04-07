import { Request, Response, NextFunction } from 'express';
import { getAllInsights, getStockInsights, getSalesInsights } from './service';
import { sendSuccess } from '../../shared/utils/response';

export async function index(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await getAllInsights());
  } catch (err) { next(err); }
}

export async function stock(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await getStockInsights());
  } catch (err) { next(err); }
}

export async function sales(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await getSalesInsights());
  } catch (err) { next(err); }
}
