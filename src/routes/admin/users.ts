import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../../db';
import { appSessions, assessments, attempts, chapters, quizResults, subjects, users, videoViews } from '../../db/schema';
import { badRequest, body, classLevel, conflict, idParam, notFound } from '../../lib/http';
import { publicUser } from '../../middleware/auth';

const r = Router();
const status = z.enum(['pending', 'approved', 'rejected', 'disabled']);
const ONLINE_SEC = 150;

r.get('/', async (req, res) => {
  const st = status.optional().catch(undefined).parse(req.query.status);
  const q = String(req.query.q || '').trim();
  const where: SQL[] = [eq(users.role, 'student')];
  if (st) where.push(eq(users.status, st));
  if (q) where.push(or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`), ilike(users.phone, `%${q}%`))!);
  const list = await db.select({
    user: users,
    quizCount: sql<number>`((select count(*) from attempts t where t.user_id = "users"."id") + (select count(*) from quiz_results q where q.user_id = "users"."id"))::int`,
    scoreSum: sql<number>`(coalesce((select sum(t.score * 100.0 / nullif(t.total, 0)) from attempts t where t.user_id = "users"."id"), 0) + coalesce((select sum(q.score * 100.0 / nullif(q.total, 0)) from quiz_results q where q.user_id = "users"."id"), 0))::float`,
    activeSec: sql<number>`coalesce((select sum(a.active_sec) from app_sessions a where a.user_id = "users"."id" and a.last_seen_at > now() - interval '14 days'), 0)::int`,
    lastSeenAt: sql<Date | null>`(select max(a.last_seen_at) from app_sessions a where a.user_id = "users"."id")`.mapWith(appSessions.lastSeenAt),
  }).from(users).where(and(...where)).orderBy(desc(users.createdAt));
  const counts = await db.select({ status: users.status, n: sql<number>`count(*)::int` }).from(users).where(eq(users.role, 'student')).groupBy(users.status);
  const c = { pending: 0, approved: 0, rejected: 0, disabled: 0 } as Record<string, number>;
  counts.forEach((x) => { c[x.status] = x.n; });
  const now = Date.now();
  res.json({
    users: list.map((x) => ({
      ...publicUser(x.user), quizCount: x.quizCount, averageScore: x.quizCount ? Math.round(x.scoreSum / x.quizCount) : null,
      activeSec14: x.activeSec, lastSeenAt: x.lastSeenAt, online: !!x.lastSeenAt && now - x.lastSeenAt.getTime() < ONLINE_SEC * 1000,
    })),
    counts: { ...c, all: c.pending + c.approved + c.rejected + c.disabled },
  });
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

/** Student details: every quiz/test with its result, time on app, watched lectures. */
r.get('/:id/activity', async (req, res) => {
  const id = idParam(req);
  const u = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!u || u.role !== 'student') throw notFound('User not found');
  const tests = await db.select({
    id: attempts.id, score: attempts.score, total: attempts.total, durationSec: attempts.durationSec, createdAt: attempts.createdAt,
    topic: assessments.topic, chapterNumber: chapters.number, chapterTitle: chapters.title, classLevel: chapters.classLevel,
    subjectSlug: subjects.slug, subjectName: subjects.name, subjectColor: subjects.color,
  }).from(attempts)
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .innerJoin(chapters, eq(chapters.id, assessments.chapterId))
    .innerJoin(subjects, eq(subjects.id, chapters.subjectId))
    .where(eq(attempts.userId, id));
  const quizzes = await db.select({
    id: quizResults.id, quizKey: quizResults.quizKey, score: quizResults.score, total: quizResults.total, durationSec: quizResults.durationSec, createdAt: quizResults.createdAt,
    topic: quizResults.topic, chapterNumber: quizResults.chapterNumber, chapterTitle: quizResults.chapterTitle, classLevel: quizResults.classLevel,
    subjectSlug: quizResults.subjectSlug, subjectName: subjects.name, subjectColor: subjects.color,
  }).from(quizResults).leftJoin(subjects, eq(subjects.slug, quizResults.subjectSlug)).where(eq(quizResults.userId, id));
  const results = [
    ...tests.map((t) => ({ ...t, kind: 'test' as const, key: `test:${t.subjectSlug}:${t.classLevel}:${t.chapterNumber}:${t.topic}` })),
    ...quizzes.map(({ quizKey, ...q }) => ({ ...q, kind: 'quiz' as const, key: quizKey, subjectName: q.subjectName ?? q.subjectSlug, subjectColor: q.subjectColor ?? '#0d9488' })),
  ].sort((a, b) => +b.createdAt - +a.createdAt);

  const sessions = await db.select().from(appSessions)
    .where(and(eq(appSessions.userId, id), sql`${appSessions.lastSeenAt} > now() - interval '14 days'`))
    .orderBy(desc(appSessions.startedAt));
  const [{ total: totalSec }] = await db.select({ total: sql<number>`coalesce(sum(${appSessions.activeSec}), 0)::int` }).from(appSessions).where(eq(appSessions.userId, id));
  const [{ n: videosWatched }] = await db.select({ n: sql<number>`count(*)::int` }).from(videoViews).where(eq(videoViews.userId, id));
  const now = Date.now();
  const last = sessions[0];
  res.json({
    user: publicUser(u),
    results,
    time: {
      activeSec14: sessions.reduce((n, x) => n + x.activeSec, 0),
      activeSecAll: totalSec,
      activeDays14: new Set(sessions.map((x) => x.startedAt.toISOString().slice(0, 10))).size,
      sessionCount14: sessions.length,
      lastSeenAt: last?.lastSeenAt ?? null,
      online: !!last && now - last.lastSeenAt.getTime() < ONLINE_SEC * 1000,
      sessions: sessions.slice(0, 300).map((x) => ({ id: x.id, startedAt: x.startedAt, lastSeenAt: x.lastSeenAt, activeSec: x.activeSec, device: x.device })),
    },
    videosWatched,
  });
});

export default r;
