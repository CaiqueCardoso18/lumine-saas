import { Response } from 'express';

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
  statusCode = 200
) {
  return res.status(statusCode).json({ success: true, data, meta });
}

export function sendError(res: Response, message: string, statusCode = 400) {
  return res.status(statusCode).json({ success: false, error: message });
}

export function getPaginationParams(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
