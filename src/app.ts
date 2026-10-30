import express, { Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { eq } from 'drizzle-orm';
import { config } from './config';
import { db } from './db';
import { files } from './db/schema';
import { requireAdmin } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import authRoutes from './routes/auth';
import publicRoutes from './routes/public';
import studentRoutes from './routes/student';
import quizRoutes from './routes/quiz';
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

  // uploaded files stored in the database (FILE_STORAGE=db)
  app.get('/files/:id{/:name}', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) { res.status(404).end(); return; }
    const [f] = await db.select().from(files).where(eq(files.id, id));
    if (!f) { res.status(404).json({ error: { message: 'File not found', code: 'NOT_FOUND' } }); return; }
    res.set({
      'Content-Type': f.mimeType,
      'Content-Length': String(f.data.length),
      'Content-Disposition': `inline; filename="${f.fileName.replace(/[^\w.\- ]/g, '_')}"`,
      'Cache-Control': 'public, max-age=604800, immutable',
    });
    res.end(f.data);
  });

  app.get('/', (_req, res) => { res.json({ name: 'Novix Science Academy API', ok: true }); });
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

  api.use('/quiz-results', quizRoutes);
  api.use('/', studentRoutes);
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
