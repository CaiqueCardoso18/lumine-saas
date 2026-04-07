import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { index, stock, sales } from './controller';

const router = Router();

router.use(authenticate);

router.get('/', index);
router.get('/stock', stock);
router.get('/sales', sales);

export default router;
