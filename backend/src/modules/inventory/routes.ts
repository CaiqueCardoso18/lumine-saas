import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createSessionCtrl, listSessionsCtrl, getSessionCtrl,
  addCountsCtrl, applySessionCtrl, cancelSessionCtrl,
  createMovementCtrl, listMovementsCtrl, productMovementsCtrl,
} from './controller';
import {
  createSessionSchema, addCountBatchSchema, listSessionsSchema,
  createMovementSchema, listMovementsSchema,
} from './validator';

const router = Router();

router.use(authenticate);

// ─── Sessões de Inventário (Contagem Física) ─────────────────
router.get('/sessions', validate(listSessionsSchema, 'query'), listSessionsCtrl);
router.post('/sessions', validate(createSessionSchema), createSessionCtrl);
router.get('/sessions/:id', getSessionCtrl);
router.post('/sessions/:id/counts', validate(addCountBatchSchema), addCountsCtrl);
router.post('/sessions/:id/apply', applySessionCtrl);
router.post('/sessions/:id/cancel', cancelSessionCtrl);

// ─── Movimentações de Estoque ────────────────────────────────
router.get('/movements', validate(listMovementsSchema, 'query'), listMovementsCtrl);
router.post('/movements', validate(createMovementSchema), createMovementCtrl);
router.get('/movements/product/:productId', productMovementsCtrl);

export default router;
