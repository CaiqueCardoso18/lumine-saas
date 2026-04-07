import { Request, Response, NextFunction } from 'express';
import {
  getRevenue, getTopProducts, getCategoriesAnalytics,
  getMargins, getTrends, getStockTurnover,
} from './service';
import { sendSuccess } from '../../shared/utils/response';

export async function revenue(req: Request, res: Response, next: NextFunction) {
  try {
    const { period, startDate, endDate, groupBy } = req.query as Record<string, string>;
    return sendSuccess(res, await getRevenue(period, startDate, endDate, groupBy));
  } catch (err) { next(err); }
}

export async function topProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const { period, startDate, endDate, limit } = req.query as Record<string, string>;
    return sendSuccess(res, await getTopProducts(period, startDate, endDate, Number(limit) || 10));
  } catch (err) { next(err); }
}

export async function categories(req: Request, res: Response, next: NextFunction) {
  try {
    const { period, startDate, endDate } = req.query as Record<string, string>;
    return sendSuccess(res, await getCategoriesAnalytics(period, startDate, endDate));
  } catch (err) { next(err); }
}

export async function margins(req: Request, res: Response, next: NextFunction) {
  try {
    const { period, startDate, endDate } = req.query as Record<string, string>;
    return sendSuccess(res, await getMargins(period, startDate, endDate));
  } catch (err) { next(err); }
}

export async function trends(req: Request, res: Response, next: NextFunction) {
  try {
    const { period } = req.query as Record<string, string>;
    return sendSuccess(res, await getTrends(period));
  } catch (err) { next(err); }
}

export async function stockTurnover(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await getStockTurnover());
  } catch (err) { next(err); }
}
