import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { index, show, create, update, destroy } from './controller';
import { createCustomerSchema, updateCustomerSchema, listCustomersSchema } from './validator';

const router = Router();

router.use(authenticate);

// Listar e criar ficam liberados: a vendedora precisa cadastrar cliente no balcão
router.get('/', validate(listCustomersSchema, 'query'), index);
router.get('/:id', show);
router.post('/', validate(createCustomerSchema), create);
router.put('/:id', validate(updateCustomerSchema), update);
router.delete('/:id', destroy);

export default router;
