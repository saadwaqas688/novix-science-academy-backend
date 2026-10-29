import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { config } from '../config';
import { badRequest } from '../lib/http';

function storage(folder: string) {
  const dir = path.join(config.uploadDir, folder);
  fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: dir,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  });
}

export const uploadPdf = (folder: string) => multer({
  storage: storage(folder),
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) cb(null, true);
    else cb(badRequest('Only PDF files are allowed'));
  },
}).single('file');

export const uploadImage = multer({
  storage: storage('photos'),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(badRequest('Only PNG, JPG, WEBP or GIF images are allowed'));
  },
}).single('file');

/** Public URL for a stored file. */
export const fileUrl = (folder: string, filename: string) => `${config.publicUrl}/uploads/${folder}/${filename}`;

/** Delete a previously uploaded file given its public URL (ignore errors). */
export function removeFile(url?: string | null) {
  if (!url) return;
  const m = url.match(/\/uploads\/(.+)$/);
  if (!m) return;
  const p = path.join(config.uploadDir, m[1]);
  if (p.startsWith(config.uploadDir)) fs.promises.unlink(p).catch(() => undefined);
}
