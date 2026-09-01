import { Request, Response, NextFunction } from 'express';
import { listAuditLogs, getAuditFacets } from './service';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';

export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listAuditLogs(req.query as unknown as Parameters<typeof listAuditLogs>[0]);
    return sendPaginated(res, result.logs, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function facets(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getAuditFacets(req.query as unknown as Parameters<typeof getAuditFacets>[0]);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
