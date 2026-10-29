import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { HttpError } from '../lib/http';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { message: 'Route not found', code: 'NOT_FOUND' } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message, code: err.code, details: err.details } });
    return;
  }
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
    res.status(400).json({ error: { message: msg, code: 'UPLOAD_ERROR' } });
    return;
  }
  const e = err as { type?: string; code?: string };
  if (e?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { message: 'Invalid JSON body', code: 'BAD_REQUEST' } });
    return;
  }
  if (e?.code === '23505') {
    res.status(409).json({ error: { message: 'This record already exists', code: 'CONFLICT' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { message: 'Something went wrong', code: 'SERVER_ERROR' } });
}
