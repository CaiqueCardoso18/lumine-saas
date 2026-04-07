import { Request, Response, NextFunction } from 'express';
import { previewUpload, confirmUpload, getImportHistory } from './service';
import { sendSuccess } from '../../shared/utils/response';
import { AppError } from '../../shared/errors/AppError';

export async function preview(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError('Arquivo não enviado');
    const result = await previewUpload(req.file.buffer, req.file.originalname);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function confirm(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError('Arquivo não enviado');
    const result = await confirmUpload(req.file.buffer, req.file.originalname, req.user!.userId);
    return sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function history(_req: Request, res: Response, next: NextFunction) {
  try {
    const imports = await getImportHistory();
    return sendSuccess(res, imports);
  } catch (err) {
    next(err);
  }
}
