import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { index, summary, show, create, cancel } from './controller';
import { createSaleSchema, cancelSaleSchema, listSalesSchema } from './validator';

const router = Router();

router.use(authenticate);

router.get('/summary', summary);
router.get('/', validate(listSalesSchema, 'query'), index);
router.get('/:id', show);
router.post('/', validate(createSaleSchema), create);
router.post('/:id/cancel', validate(cancelSaleSchema), cancel);

export default router;
