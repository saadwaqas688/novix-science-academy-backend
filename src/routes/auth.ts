import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { body, classLevel, conflict, forbidden, HttpError } from '../lib/http';
import { publicUser, requireAuth, signToken } from '../middleware/auth';

const r = Router();
const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'));

r.post('/signup', async (req, res) => {
  const d = body(req, z.object({
    name: z.string().trim().min(2, 'Name is too short').max(80),
    email,
    phone: z.string().trim().min(7, 'Enter a valid phone number').max(20),
    classLevel,
    password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  }));
  const exists = await db.query.users.findFirst({ where: eq(users.email, d.email) });
  if (exists) throw conflict('This email is already registered');
  await db.insert(users).values({
    name: d.name, email: d.email, phone: d.phone, classLevel: d.classLevel,
    passwordHash: await bcrypt.hash(d.password, 10), role: 'student', status: 'pending',
  });
  res.status(201).json({ message: 'Account created. It is waiting for admin approval.', status: 'pending' });
});

r.post('/login', async (req, res) => {
  const d = body(req, z.object({ email, password: z.string().min(1) }));
  const u = await db.query.users.findFirst({ where: eq(users.email, d.email) });
  if (!u || !(await bcrypt.compare(d.password, u.passwordHash))) throw new HttpError(401, 'Wrong email or password', 'INVALID_CREDENTIALS');
  if (u.status === 'pending') throw forbidden('Your account is waiting for admin approval. Please try again later.', 'PENDING');
  if (u.status === 'rejected') throw forbidden('Your account request was not approved. Please contact the academy.', 'REJECTED');
  res.json({ token: signToken(u), user: publicUser(u) });
});

r.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user!) });
});

r.patch('/me', requireAuth, async (req, res) => {
  const d = body(req, z.object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: z.string().trim().min(7).max(20).optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(6, 'Password must be at least 6 characters').max(100).optional(),
  }));
  const patch: Partial<typeof users.$inferInsert> = {};
  if (d.name) patch.name = d.name;
  if (d.phone) patch.phone = d.phone;
  if (d.newPassword) {
    if (!d.currentPassword || !(await bcrypt.compare(d.currentPassword, req.user!.passwordHash))) throw new HttpError(400, 'Current password is wrong', 'BAD_PASSWORD');
    patch.passwordHash = await bcrypt.hash(d.newPassword, 10);
  }
  const [u] = Object.keys(patch).length
    ? await db.update(users).set(patch).where(eq(users.id, req.user!.id)).returning()
    : [req.user!];
  res.json({ user: publicUser(u) });
});

export default r;
