import 'dotenv/config';
import path from 'path';

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: req('DATABASE_URL', 'postgres://novix:novix_password@localhost:5433/novix'),
  jwtSecret: req('JWT_SECRET', 'dev-only-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((s) => s.trim()),
  publicUrl: (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, ''),
  uploadDir: path.resolve(process.env.UPLOAD_DIR || 'uploads'),
  admin: {
    name: process.env.ADMIN_NAME || 'Academy Admin',
    email: (process.env.ADMIN_EMAIL || 'admin@novix.pk').toLowerCase(),
    password: process.env.ADMIN_PASSWORD || 'Admin@12345',
  },
  seedDemo: (process.env.SEED_DEMO_DATA || 'true').toLowerCase() === 'true',
  isProd: process.env.NODE_ENV === 'production',
};
