import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { requireRole } from '../../middleware/auth';
import { index, replace } from './controller';
import { replaceCardFeesSchema } from './validator';

const router = Router();

router.use(authenticate);
// Ler é liberado: o PDV precisa da taxa para mostrar o líquido na hora
router.get('/', index);
// Mexer na tabela é coisa de dono — muda quanto a loja recebe
router.put('/', requireRole('OWNER'), validate(replaceCardFeesSchema), replace);

export default router;
