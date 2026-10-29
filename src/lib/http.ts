import type { Request } from 'express';
import { z } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: unknown) {
    super(message);
  }
}

export const badRequest = (m: string, details?: unknown) => new HttpError(400, m, 'BAD_REQUEST', details);
export const notFound = (m = 'Not found') => new HttpError(404, m, 'NOT_FOUND');
export const forbidden = (m = 'Forbidden', code = 'FORBIDDEN') => new HttpError(403, m, code);
export const unauthorized = (m = 'Please sign in') => new HttpError(401, m, 'UNAUTHORIZED');
export const conflict = (m: string) => new HttpError(409, m, 'CONFLICT');

/** Parse and validate a request body with a zod schema. */
export function body<T extends z.ZodTypeAny>(req: Request, schema: T): z.infer<T> {
  const r = schema.safeParse(req.body ?? {});
  if (!r.success) {
    const first = r.error.issues[0];
    const field = first?.path?.join('.');
    throw badRequest(field ? `${field}: ${first.message}` : first?.message || 'Invalid input', r.error.issues);
  }
  return r.data;
}

export function idParam(req: Request, name = 'id'): number {
  const v = Number(req.params[name]);
  if (!Number.isInteger(v) || v <= 0) throw badRequest(`Invalid ${name}`);
  return v;
}

export const CLASS_LEVELS = ['9', '10', '11', '12'] as const;
export const classLevel = z.enum(CLASS_LEVELS);
