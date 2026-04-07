import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import {
  getSettings, putSettings,
  indexCategories, postCategory, patchCategory, postSubcategory,
  indexUsers, postUser, toggleUser, patchUserPermissions, backup,
  indexSuppliers, postSupplier, patchSupplier, destroySupplier,
} from './controller';

const router = Router();

router.use(authenticate);

router.get('/', getSettings);
router.put('/', requireRole('OWNER'), putSettings);

router.get('/categories', indexCategories);
router.post('/categories', requireRole('OWNER'), postCategory);
router.patch('/categories/:id', requireRole('OWNER'), patchCategory);
router.post('/subcategories', requireRole('OWNER'), postSubcategory);

router.get('/users', requireRole('OWNER'), indexUsers);
router.post('/users', requireRole('OWNER'), postUser);
router.patch('/users/:id/toggle', requireRole('OWNER'), toggleUser);
router.patch('/users/:id/permissions', requireRole('OWNER'), patchUserPermissions);

router.get('/suppliers', indexSuppliers);
router.post('/suppliers', postSupplier);
router.patch('/suppliers/:id', patchSupplier);
router.delete('/suppliers/:id', requireRole('OWNER'), destroySupplier);

router.post('/backup', requireRole('OWNER'), backup);

export default router;
