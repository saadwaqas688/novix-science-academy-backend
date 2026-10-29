import express, { Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { requireAdmin } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import authRoutes from './routes/auth';
import publicRoutes from './routes/public';
import studentRoutes from './routes/student';
import adminUsers from './routes/admin/users';
import adminContent from './routes/admin/content';
import adminAssessments from './routes/admin/assessments';
import adminStats from './routes/admin/stats';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: config.corsOrigin, credentials: false }));
  app.use(express.json({ limit: '1mb' }));
  if (!config.isProd || process.env.LOG_REQUESTS) app.use(morgan('dev'));

  // uploaded PDFs and photos
  app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d', fallthrough: false }));

  app.get('/health', (_req, res) => { res.json({ ok: true }); });

  const api = Router();
  api.use('/auth', authRoutes);
  api.use('/', publicRoutes);

  const admin = Router();
  admin.use(requireAdmin);
  admin.use('/users', adminUsers);
  admin.use('/assessments', adminAssessments);
  admin.use('/', adminContent);
  admin.use('/', adminStats);
  api.use('/admin', admin);

  api.use('/', studentRoutes);
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
