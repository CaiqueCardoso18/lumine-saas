import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  indexSuppliers, createSupplierHandler, updateSupplierHandler, deleteSupplierHandler,
  index, show, create, update, updateStatus,
} from './controller';
import {
  createSupplierSchema, createOrderSchema, updateOrderSchema,
  updateOrderStatusSchema, listOrdersSchema,
} from './validator';

const router = Router();

router.use(authenticate);

// Suppliers
router.get('/suppliers', indexSuppliers);
router.post('/suppliers', validate(createSupplierSchema), createSupplierHandler);
router.put('/suppliers/:id', validate(createSupplierSchema.partial()), updateSupplierHandler);
router.delete('/suppliers/:id', deleteSupplierHandler);

// Orders
router.get('/', validate(listOrdersSchema, 'query'), index);
router.get('/:id', show);
router.post('/', validate(createOrderSchema), create);
router.put('/:id', validate(updateOrderSchema), update);
router.patch('/:id/status', validate(updateOrderStatusSchema), updateStatus);

export default router;
