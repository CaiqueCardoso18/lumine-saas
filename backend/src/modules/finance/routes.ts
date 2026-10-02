import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { calendar, index, create, update, pay, cancel } from './controller';
import {
  calendarSchema, listPayablesSchema, createPayableSchema,
  updatePayableSchema, payPayableSchema,
} from './validator';

const router = Router();

router.use(authenticate);

// O calendario mostra o caixa futuro da loja — coisa de dono
router.use(requireRole('OWNER'));

router.get('/calendar', validate(calendarSchema, 'query'), calendar);
router.get('/payables', validate(listPayablesSchema, 'query'), index);
router.post('/payables', validate(createPayableSchema), create);
router.patch('/payables/:id', validate(updatePayableSchema), update);
router.post('/payables/:id/pay', validate(payPayableSchema), pay);
router.post('/payables/:id/cancel', cancel);

export default router;
