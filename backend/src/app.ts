import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';

// Routes
import authRoutes from './modules/auth/routes';
import productRoutes from './modules/products/routes';
import uploadRoutes from './modules/upload/routes';
import salesRoutes from './modules/sales/routes';
import ordersRoutes from './modules/orders/routes';
import analyticsRoutes from './modules/analytics/routes';
import insightsRoutes from './modules/insights/routes';
import settingsRoutes from './modules/settings/routes';

const app = express();

// ─── Security ────────────────────────────────────────────────
app.use(helmet());

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Rate Limiting ────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Muitas requisições. Tente novamente em instantes.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
});

app.use(globalLimiter);

// ─── Parsing ──────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ─── Health check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Lumine API online', timestamp: new Date().toISOString() });
});

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/settings', settingsRoutes);

// ─── 404 ──────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Rota não encontrada' });
});

// ─── Error Handler ────────────────────────────────────────────
app.use(errorHandler);

export default app;
