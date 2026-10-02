import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/requirePermission';
import { index, summary, debtors, pay, reopen, update, renegotiate } from './controller';
import {
  listInstallmentsSchema, payInstallmentSchema, updateInstallmentSchema, renegotiateSchema,
} from './validator';

const router = Router();

router.use(authenticate);

// Totais da loja (em aberto, recebido no mes) sao numeros do negocio.
// A lista de devedores e parcelas continua liberada: a vendedora cobra no balcao.
router.get('/summary', requirePermission('view_financials'), summary);
router.get('/debtors', debtors);
router.get('/', validate(listInstallmentsSchema, 'query'), index);
router.post('/:id/pay', validate(payInstallmentSchema), pay);
// Reabrir parcela desfaz um recebimento, entao segue a mesma regra do estorno
router.post('/:id/reopen', requirePermission('cancel_sale'), reopen);
// Editar valor/vencimento e renegociar mexem no que a loja tem a receber,
// entao pedem a mesma permissao de quem pode desfazer um recebimento
router.patch('/:id', requirePermission('cancel_sale'), validate(updateInstallmentSchema), update);
router.post('/renegotiate', requirePermission('cancel_sale'), validate(renegotiateSchema), renegotiate);

export default router;
