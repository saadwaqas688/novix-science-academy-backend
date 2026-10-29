import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { db } from '../db';
import { users, type User } from '../db/schema';
import { forbidden, unauthorized } from '../lib/http';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { user?: User } }
}

export function signToken(user: Pick<User, 'id' | 'role'>) {
  return jwt.sign({ sub: String(user.id), role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
}

export function publicUser(u: User) {
  const { passwordHash: _ph, ...rest } = u;
  return rest;
}

async function loadUser(req: Request): Promise<User | undefined> {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return undefined;
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string };
    return await db.query.users.findFirst({ where: eq(users.id, Number(payload.sub)) });
  } catch {
    return undefined;
  }
}

/** Signed-in AND approved user (student or admin). */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const u = await loadUser(req);
  if (!u) throw unauthorized();
  if (u.status === 'pending') throw forbidden('Your account is waiting for admin approval', 'PENDING');
  if (u.status === 'rejected') throw forbidden('Your account was not approved', 'REJECTED');
  req.user = u;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => undefined);
  if (req.user?.role !== 'admin') throw forbidden('Admin access only');
  next();
}
