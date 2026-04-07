import { Request, Response, NextFunction } from 'express';
import {
  listSuppliers, createSupplier, updateSupplier, deleteSupplier,
  listOrders, getOrderById, createOrder, updateOrder, updateOrderStatus,
} from './service';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';

// ─── Suppliers ────────────────────────────────────────────────
export async function indexSuppliers(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await listSuppliers());
  } catch (err) { next(err); }
}

export async function createSupplierHandler(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await createSupplier(req.body), 201);
  } catch (err) { next(err); }
}

export async function updateSupplierHandler(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await updateSupplier(req.params.id, req.body));
  } catch (err) { next(err); }
}

export async function deleteSupplierHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteSupplier(req.params.id);
    return sendSuccess(res, { message: 'Fornecedor removido' });
  } catch (err) { next(err); }
}

// ─── Orders ───────────────────────────────────────────────────
export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listOrders(req.query as Parameters<typeof listOrders>[0]);
    return sendPaginated(res, result.orders, result.meta);
  } catch (err) { next(err); }
}

export async function show(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await getOrderById(req.params.id));
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await createOrder(req.body, req.user!.userId), 201);
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await updateOrder(req.params.id, req.body));
  } catch (err) { next(err); }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await updateOrderStatus(req.params.id, req.body, req.user!.userId));
  } catch (err) { next(err); }
}
