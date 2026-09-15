import { Request, Response, NextFunction } from 'express';
import {
  listCustomers, getCustomerById, createCustomer, updateCustomer, softDeleteCustomer,
} from './service';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';

export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listCustomers(req.query as unknown as Parameters<typeof listCustomers>[0]);
    return sendPaginated(res, result.customers, result.meta);
  } catch (err) { next(err); }
}

export async function show(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await getCustomerById(req.params.id));
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await createCustomer(req.body, req.user!.userId), 201);
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await updateCustomer(req.params.id, req.body, req.user!.userId));
  } catch (err) { next(err); }
}

export async function destroy(req: Request, res: Response, next: NextFunction) {
  try {
    await softDeleteCustomer(req.params.id, req.user!.userId);
    return sendSuccess(res, { message: 'Cliente removido' });
  } catch (err) { next(err); }
}
