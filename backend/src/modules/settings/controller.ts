import { Request, Response, NextFunction } from 'express';
import {
  getAllSettings, updateSettings,
  getCategories, createCategory, updateCategory, createSubcategory,
  listUsers, createUser, toggleUserActive, updateUserPermissions,
  listSuppliers, createSupplier, updateSupplier, deleteSupplier,
} from './service';
import { sendSuccess } from '../../shared/utils/response';

export async function getSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await getAllSettings());
  } catch (err) { next(err); }
}

export async function putSettings(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await updateSettings(req.body));
  } catch (err) { next(err); }
}

export async function indexCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await getCategories());
  } catch (err) { next(err); }
}

export async function postCategory(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await createCategory(req.body), 201);
  } catch (err) { next(err); }
}

export async function patchCategory(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await updateCategory(req.params.id, req.body));
  } catch (err) { next(err); }
}

export async function postSubcategory(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await createSubcategory(req.body), 201);
  } catch (err) { next(err); }
}

export async function indexUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await listUsers());
  } catch (err) { next(err); }
}

export async function postUser(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await createUser(req.body), 201);
  } catch (err) { next(err); }
}

export async function toggleUser(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await toggleUserActive(req.params.id));
  } catch (err) { next(err); }
}

export async function patchUserPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await updateUserPermissions(req.params.id, req.body.permissions ?? []));
  } catch (err) { next(err); }
}

export async function indexSuppliers(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await listSuppliers());
  } catch (err) { next(err); }
}

export async function postSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await createSupplier(req.body), 201);
  } catch (err) { next(err); }
}

export async function patchSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await updateSupplier(req.params.id, req.body));
  } catch (err) { next(err); }
}

export async function destroySupplier(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteSupplier(req.params.id);
    return sendSuccess(res, { deleted: true });
  } catch (err) { next(err); }
}

export async function backup(_req: Request, res: Response, next: NextFunction) {
  try {
    // Instrução para o cliente sobre como gerar backup via pg_dump
    res.json({
      success: true,
      data: {
        message: 'Para fazer backup, use o endpoint administrativo ou execute pg_dump no servidor.',
        instructions: 'Contate o administrador do sistema para solicitar um backup completo.',
      },
    });
  } catch (err) { next(err); }
}
