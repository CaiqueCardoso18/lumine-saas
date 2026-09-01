import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/requirePermission';
import {
  index, lowStock, show, history, create, update, destroy, bulkUpdate, downloadTemplate, facets,
} from './controller';
import {
  createProductSchema, updateProductSchema, bulkUpdateSchema, listProductsSchema,
  productFacetsSchema,
} from './validator';

const router = Router();

// Template é público — não precisa de auth (window.open não envia cookie cross-origin)
router.get('/template', downloadTemplate);

router.use(authenticate);
router.get('/low-stock', lowStock);
router.get('/facets', validate(productFacetsSchema, 'query'), facets);
router.get('/', validate(listProductsSchema, 'query'), index);
router.get('/:id', show);
router.get('/:id/history', history);
router.post('/', requirePermission('manage_products'), validate(createProductSchema), create);
router.put('/:id', requirePermission('manage_products'), validate(updateProductSchema), update);
router.delete('/:id', requirePermission('manage_products'), destroy);
router.patch('/bulk', requirePermission('manage_products'), validate(bulkUpdateSchema), bulkUpdate);

export default router;
