import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';
import { badRequest, body, classLevel, conflict, idParam, notFound } from '../../lib/http';
import { publicUser } from '../../middleware/auth';

const r = Router();
const status = z.enum(['pending', 'approved', 'rejected']);

r.get('/', async (req, res) => {
  const st = status.optional().catch(undefined).parse(req.query.status);
  const q = String(req.query.q || '').trim();
  const where: SQL[] = [eq(users.role, 'student')];
  if (st) where.push(eq(users.status, st));
  if (q) where.push(or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`), ilike(users.phone, `%${q}%`))!);
  const list = await db.select().from(users).where(and(...where)).orderBy(desc(users.createdAt));
  const counts = await db.select({ status: users.status, n: sql<number>`count(*)::int` }).from(users).where(eq(users.role, 'student')).groupBy(users.status);
  const c = { pending: 0, approved: 0, rejected: 0 } as Record<string, number>;
  counts.forEach((x) => { c[x.status] = x.n; });
  res.json({ users: list.map(publicUser), counts: { ...c, all: c.pending + c.approved + c.rejected } });
});

r.post('/', async (req, res) => {
  const d = body(req, z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email')),
    phone: z.string().trim().min(7).max(20),
    classLevel,
    password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  }));
  if (await db.query.users.findFirst({ where: eq(users.email, d.email) })) throw conflict('This email is already registered');
  const [u] = await db.insert(users).values({
    name: d.name, email: d.email, phone: d.phone, classLevel: d.classLevel,
    passwordHash: await bcrypt.hash(d.password, 10), role: 'student', status: 'approved',
  }).returning();
  res.status(201).json({ user: publicUser(u) });
});

r.patch('/:id', async (req, res) => {
  const id = idParam(req);
  const d = body(req, z.object({
    status: status.optional(),
    name: z.string().trim().min(2).max(80).optional(),
    phone: z.string().trim().min(7).max(20).optional(),
    classLevel: classLevel.optional(),
    password: z.string().min(6).max(100).optional(),
  }));
  const u = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!u || u.role !== 'student') throw notFound('User not found');
  const { password, ...rest } = d;
  const patch: Partial<typeof users.$inferInsert> = { ...rest };
  if (password) patch.passwordHash = await bcrypt.hash(password, 10);
  if (!Object.keys(patch).length) throw badRequest('Nothing to update');
  const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
  res.json({ user: publicUser(row) });
});

r.delete('/:id', async (req, res) => {
  const id = idParam(req);
  const u = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!u || u.role !== 'student') throw notFound('User not found');
  await db.delete(users).where(eq(users.id, id));
  res.status(204).end();
});

export default r;
