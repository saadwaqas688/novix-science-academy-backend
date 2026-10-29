import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { badRequest } from '../lib/http';
import { db } from '../db';
import { files } from '../db/schema';

/**
 * Two storage modes (FILE_STORAGE env):
 *  - "disk" (default): files are written to UPLOAD_DIR and served from /uploads/…  (Docker / VPS)
 *  - "db": files are stored inside PostgreSQL and served from /files/:id/…        (free hosts without a persistent disk, e.g. Render free)
 */
const useDb = config.fileStorage === 'db';

function storage(folder: string) {
  if (useDb) return multer.memoryStorage();
  const dir = path.join(config.uploadDir, folder);
  fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: dir,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  });
}

const MB = 1024 * 1024;

export const uploadPdf = (folder: string) => multer({
  storage: storage(folder),
  limits: { fileSize: (useDb ? config.maxDbFileMb : 80) * MB },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) cb(null, true);
    else cb(badRequest('Only PDF files are allowed'));
  },
}).single('file');

export const uploadImage = multer({
  storage: storage('photos'),
  limits: { fileSize: 8 * MB },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(badRequest('Only PNG, JPG, WEBP or GIF images are allowed'));
  },
}).single('file');

/** Persist an uploaded file and return its public URL. */
export async function storeFile(folder: string, file: Express.Multer.File): Promise<string> {
  if (!useDb) return `${config.publicUrl}/uploads/${folder}/${file.filename}`;
  const mime = file.mimetype || (file.originalname.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
  const [row] = await db.insert(files).values({ folder, fileName: file.originalname, mimeType: mime, sizeBytes: file.size, data: file.buffer }).returning({ id: files.id });
  return `${config.publicUrl}/files/${row.id}/${encodeURIComponent(file.originalname.replace(/[\\/]/g, '_'))}`;
}

/** Throw away an upload that will not be used. */
export function discardUpload(file?: Express.Multer.File) {
  if (file?.path) fs.promises.unlink(file.path).catch(() => undefined);
}

/** Delete a previously stored file given its public URL (errors are ignored). */
export function removeFile(url?: string | null) {
  if (!url) return;
  const dbm = url.match(/\/files\/(\d+)(\/|$)/);
  if (dbm) { db.delete(files).where(eq(files.id, Number(dbm[1]))).catch(() => undefined); return; }
  const m = url.match(/\/uploads\/(.+)$/);
  if (!m) return;
  const p = path.join(config.uploadDir, m[1]);
  if (p.startsWith(config.uploadDir)) fs.promises.unlink(p).catch(() => undefined);
}
