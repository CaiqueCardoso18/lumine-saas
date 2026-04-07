import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth';
import { preview, confirm, history } from './controller';
import { env } from '../../config/env';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos .xlsx e .csv são aceitos'));
    }
  },
});

const router = Router();

router.use(authenticate);

router.post('/preview', upload.single('file'), preview);
router.post('/confirm', upload.single('file'), confirm);
router.get('/history', history);

export default router;
