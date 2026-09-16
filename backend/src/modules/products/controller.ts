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
  getProductFacets,
  getStockValue,
  listAllProductsForExport,
} from './service';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import { canViewCostPrice } from '../../middleware/requirePermission';

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

export async function facets(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getProductFacets(req.query as unknown as Parameters<typeof getProductFacets>[0]);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function stockValue(req: Request, res: Response, next: NextFunction) {
  try {
    // Custo e lucro só para quem tem permissão de ver custo
    const includeCost = await canViewCostPrice(req);
    return sendSuccess(res, await getStockValue(includeCost));
  } catch (err) {
    next(err);
  }
}

/**
 * Exporta os produtos em .xlsx respeitando os filtros da tela.
 *
 * As colunas base são as MESMAS do template de import, então o arquivo
 * exportado pode ser editado e reimportado. As colunas de conferência
 * (estoque mínimo, valor total, status) vão depois, e o import ignora o que
 * não reconhece.
 */
export async function exportProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const xlsx = await import('xlsx');
    const includeCost = await canViewCostPrice(req);

    const produtos = await listAllProductsForExport(
      req.query as unknown as Parameters<typeof listAllProductsForExport>[0]
    );

    const header = [
      'sku', 'nome', 'quantidade', 'preco_venda',
      ...(includeCost ? ['preco_custo'] : []),
      'categoria', 'marca', 'tamanho', 'cor', 'publico',
      'descricao_curta', 'descricao', 'barcode',
      'estoque_minimo', 'status',
      'valor_total_venda',
      ...(includeCost ? ['valor_total_custo', 'lucro_potencial'] : []),
    ];

    const linhas = produtos.map((p) => {
      const qtd = p.quantity;
      const venda = Number(p.salePrice);
      const custo = Number(p.costPrice);
      return [
        p.sku,
        p.name,
        qtd,
        venda,
        ...(includeCost ? [custo] : []),
        p.category?.name ?? '',
        p.brand ?? '',
        p.size ?? '',
        p.color ?? '',
        p.audience === 'ADULTO' ? 'Adulto' : p.audience === 'INFANTIL' ? 'Infantil' : '',
        p.shortDescription ?? '',
        p.description ?? '',
        p.barcode ?? '',
        p.minStock,
        p.status === 'ACTIVE' ? 'Ativo' : p.status === 'INACTIVE' ? 'Inativo' : 'Descontinuado',
        Math.round(venda * qtd * 100) / 100,
        ...(includeCost
          ? [
              Math.round(custo * qtd * 100) / 100,
              Math.round((venda - custo) * qtd * 100) / 100,
            ]
          : []),
      ];
    });

    // Linha de totais no fim, para conferir sem precisar somar na mão
    const somaCol = (idx: number) =>
      linhas.reduce((acc, l) => acc + (typeof l[idx] === 'number' ? (l[idx] as number) : 0), 0);

    const idxQtd = header.indexOf('quantidade');
    const idxValorVenda = header.indexOf('valor_total_venda');
    const idxValorCusto = header.indexOf('valor_total_custo');
    const idxLucro = header.indexOf('lucro_potencial');

    const totais = header.map((_, i) => {
      if (i === 0) return 'TOTAL';
      if (i === idxQtd) return somaCol(idxQtd);
      if (i === idxValorVenda) return Math.round(somaCol(idxValorVenda) * 100) / 100;
      if (includeCost && i === idxValorCusto) return Math.round(somaCol(idxValorCusto) * 100) / 100;
      if (includeCost && i === idxLucro) return Math.round(somaCol(idxLucro) * 100) / 100;
      return '';
    });

    const ws = xlsx.utils.aoa_to_sheet([header, ...linhas, [], totais]);

    ws['!cols'] = header.map((h) => {
      if (h === 'nome') return { wch: 34 };
      if (h === 'descricao') return { wch: 50 };
      if (h === 'descricao_curta') return { wch: 32 };
      if (h === 'categoria' || h === 'marca') return { wch: 18 };
      return { wch: 14 };
    });
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Produtos');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const data = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="produtos-lumine-${data}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function downloadTemplate(_req: Request, res: Response, next: NextFunction) {
  try {
    const xlsx = await import('xlsx');
    const ws = xlsx.utils.aoa_to_sheet([
      ['sku', 'nome', 'quantidade', 'preco_venda', 'preco_custo', 'categoria', 'marca', 'tamanho', 'cor', 'publico', 'descricao_curta', 'descricao'],
      ['SKU-001', 'Collant Básico Preto', '10', '89.90', '35.00', 'Collants', 'Só Dança', 'P', 'Preto', 'Adulto', 'Collant de alcinha em helanca', 'Collant básico de alcinha, tecido helanca com ótimo caimento. Ideal para aulas de ballet clássico e jazz.'],
      ['SKU-002', 'Sapatilha Ballet Rosa', '5', '149.90', '60.00', 'Sapatilhas', 'Capezio', '34', 'Rosa', 'Infantil', 'Sapatilha de meia ponta em couro', 'Sapatilha de meia ponta em couro legítimo, sola dividida, com elástico já costurado.'],
      ['SKU-002', 'Sapatilha Ballet Rosa', '8', '149.90', '60.00', 'Sapatilhas', 'Capezio', '36', 'Rosa', 'Adulto', 'Sapatilha de meia ponta em couro', 'Sapatilha de meia ponta em couro legítimo, sola dividida, com elástico já costurado.'],
    ]);

    // Larguras de coluna para a planilha abrir legível
    ws['!cols'] = [
      { wch: 12 }, { wch: 28 }, { wch: 11 }, { wch: 12 }, { wch: 12 },
      { wch: 16 }, { wch: 14 }, { wch: 9 }, { wch: 12 }, { wch: 10 },
      { wch: 36 }, { wch: 55 },
    ];

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
