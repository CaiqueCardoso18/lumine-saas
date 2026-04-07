import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  index, lowStock, show, history, create, update, destroy, bulkUpdate, downloadTemplate,
} from './controller';
import {
  createProductSchema, updateProductSchema, bulkUpdateSchema, listProductsSchema,
} from './validator';

const router = Router();

router.use(authenticate);

router.get('/template', downloadTemplate);
router.get('/low-stock', lowStock);
router.get('/', validate(listProductsSchema, 'query'), index);
router.get('/:id', show);
router.get('/:id/history', history);
router.post('/', validate(createProductSchema), create);
router.put('/:id', validate(updateProductSchema), update);
router.delete('/:id', destroy);
router.patch('/bulk', validate(bulkUpdateSchema), bulkUpdate);

export default router;
