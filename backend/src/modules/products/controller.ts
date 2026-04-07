import { Request, Response, NextFunction } from 'express';
import {
  listProducts,
  getLowStockProducts,
  getProductById,
  getProductHistory,
  createProduct,
  updateProduct,
  softDeleteProduct,
  bulkUpdateProducts,
} from './service';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';

export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listProducts(req.query as unknown as Parameters<typeof listProducts>[0]);
    return sendPaginated(res, result.products, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function lowStock(req: Request, res: Response, next: NextFunction) {
  try {
    const products = await getLowStockProducts();
    return sendSuccess(res, products);
  } catch (err) {
    next(err);
  }
}

export async function show(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await getProductById(req.params.id);
    return sendSuccess(res, product);
  } catch (err) {
    next(err);
  }
}

export async function history(req: Request, res: Response, next: NextFunction) {
  try {
    const logs = await getProductHistory(req.params.id);
    return sendSuccess(res, logs);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await createProduct(req.body, req.user!.userId);
    return sendSuccess(res, product, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await updateProduct(req.params.id, req.body, req.user!.userId);
    return sendSuccess(res, product);
  } catch (err) {
    next(err);
  }
}

export async function destroy(req: Request, res: Response, next: NextFunction) {
  try {
    await softDeleteProduct(req.params.id, req.user!.userId);
    return sendSuccess(res, { message: 'Produto removido com sucesso' });
  } catch (err) {
    next(err);
  }
}

export async function bulkUpdate(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await bulkUpdateProducts(req.body, req.user!.userId);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function downloadTemplate(_req: Request, res: Response, next: NextFunction) {
  try {
    const xlsx = await import('xlsx');
    const ws = xlsx.utils.aoa_to_sheet([
      ['sku', 'nome', 'quantidade', 'preco_venda', 'preco_custo', 'categoria', 'marca', 'tamanho', 'cor'],
      ['SKU-001', 'Collant Básico Preto', '10', '89.90', '35.00', 'Collants', 'Só Dança', 'P', 'Preto'],
      ['SKU-002', 'Sapatilha Ballet Rosa', '5', '149.90', '60.00', 'Sapatilhas', 'Capezio', '34', 'Rosa'],
    ]);

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Produtos');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-produtos-lumine.xlsx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}
