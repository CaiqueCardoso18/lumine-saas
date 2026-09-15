import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/requirePermission';
import { index, summary, debtors, pay, reopen } from './controller';
import { listInstallmentsSchema, payInstallmentSchema } from './validator';

const router = Router();

router.use(authenticate);

router.get('/summary', summary);
router.get('/debtors', debtors);
router.get('/', validate(listInstallmentsSchema, 'query'), index);
router.post('/:id/pay', validate(payInstallmentSchema), pay);
// Reabrir parcela desfaz um recebimento, entao segue a mesma regra do estorno
router.post('/:id/reopen', requirePermission('cancel_sale'), reopen);

export default router;
