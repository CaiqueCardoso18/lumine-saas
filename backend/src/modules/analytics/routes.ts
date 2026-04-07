import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { revenue, topProducts, categories, margins, trends, stockTurnover } from './controller';

const router = Router();

router.use(authenticate);

router.get('/revenue', revenue);
router.get('/top-products', topProducts);
router.get('/categories', categories);
router.get('/margins', margins);
router.get('/trends', trends);
router.get('/stock-turnover', stockTurnover);

export default router;
