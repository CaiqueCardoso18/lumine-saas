import { Router } from 'express';
import { login, register, logout, me, refresh } from './controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { loginSchema, registerSchema } from './validator';

const router = Router();

router.post('/login', validate(loginSchema), login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.get('/me', authenticate, me);

// Registro: primeiro OWNER é livre, demais precisam estar autenticados
router.post('/register', (req, res, next) => {
  // Se não há cookie/token, deixa passar (cadastro inicial)
  const token = req.cookies?.token || req.headers.authorization;
  if (token) {
    authenticate(req, res, () => validate(registerSchema)(req, res, () => register(req, res, next)));
  } else {
    validate(registerSchema)(req, res, () => register(req, res, next));
  }
});

export default router;
