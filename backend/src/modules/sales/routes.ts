import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/requirePermission';
import { validate } from '../../middleware/validate';
import { index, summary, show, create, cancel } from './controller';
import { createSaleSchema, cancelSaleSchema, listSalesSchema } from './validator';

const router = Router();

router.use(authenticate);

router.get('/summary', summary);
router.get('/', validate(listSalesSchema, 'query'), index);
router.get('/:id', show);
router.post('/', validate(createSaleSchema), create);
// Estorno mexe em estoque e caixa, entao exige permissao explicita
router.post('/:id/cancel', requirePermission('cancel_sale'), validate(cancelSaleSchema), cancel);

export default router;
