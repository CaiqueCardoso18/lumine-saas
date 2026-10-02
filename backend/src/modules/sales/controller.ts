import { Request, Response, NextFunction } from 'express';
import { listSales, getSaleById, getSalesSummary, createSale, updateSale, cancelSale } from './service';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';

export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listSales(req.query as unknown as Parameters<typeof listSales>[0]);
    return sendPaginated(res, result.sales, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function summary(req: Request, res: Response, next: NextFunction) {
  try {
    const { startDate, endDate } = req.query as Record<string, string>;
    const data = await getSalesSummary(startDate, endDate);
    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function show(req: Request, res: Response, next: NextFunction) {
  try {
    const sale = await getSaleById(req.params.id);
    return sendSuccess(res, sale);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const sale = await createSale(req.body, req.user!.userId, req.user!.role);
    return sendSuccess(res, sale, 201);
  } catch (err) {
    next(err);
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await cancelSale(req.params.id, req.body, req.user!.userId);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * Edição de venda: só OWNER, e o estoque é ajustado pela diferença.
 * O role vai para o service porque a regra de quem pode editar vive junto
 * das outras regras da venda.
 */
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const sale = await updateSale(req.params.id, req.body, req.user!.userId, req.user!.role);
    return sendSuccess(res, sale);
  } catch (err) {
    next(err);
  }
}
