import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/requirePermission';
import { validate } from '../../middleware/validate';
import { index, summary, show, create, update, cancel } from './controller';
import {
  createSaleSchema, updateSaleSchema, cancelSaleSchema, listSalesSchema,
} from './validator';

const router = Router();

router.use(authenticate);

// Faturamento, ticket medio e valor liquido sao numeros do negocio.
// A vendedora registra e consulta vendas sem precisar do resumo.
router.get('/summary', requirePermission('view_financials'), summary);
router.get('/', validate(listSalesSchema, 'query'), index);
router.get('/:id', show);
router.post('/', validate(createSaleSchema), create);
// Editar venda mexe em estoque e caixa de uma venda ja fechada.
// O service ainda checa o role OWNER — a permissao aqui e a primeira barreira.
router.put('/:id', requirePermission('cancel_sale'), validate(updateSaleSchema), update);
// Estorno mexe em estoque e caixa, entao exige permissao explicita
router.post('/:id/cancel', requirePermission('cancel_sale'), validate(cancelSaleSchema), cancel);

export default router;
