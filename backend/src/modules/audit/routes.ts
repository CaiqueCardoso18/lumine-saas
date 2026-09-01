import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/requirePermission';
import { validate } from '../../middleware/validate';
import { index, facets } from './controller';
import { listAuditSchema } from './validator';

const router = Router();

router.use(authenticate);
router.use(requirePermission('view_audit'));

router.get('/', validate(listAuditSchema, 'query'), index);
router.get('/facets', validate(listAuditSchema, 'query'), facets);

export default router;
