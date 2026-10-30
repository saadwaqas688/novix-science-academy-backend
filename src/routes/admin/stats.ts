import { Router } from 'express';
import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../../db';
import { assessments, attempts, chapters, quizResults, subjects, users } from '../../db/schema';
import { classLevel } from '../../lib/http';
import { publicUser } from '../../middleware/auth';

const r = Router();

const attemptCols = {
  id: attempts.id, score: attempts.score, total: attempts.total, durationSec: attempts.durationSec, createdAt: attempts.createdAt,
  userId: users.id, userName: users.name, userEmail: users.email,
  assessmentId: assessments.id, topic: assessments.topic,
  chapterNumber: chapters.number, chapterTitle: chapters.title, classLevel: chapters.classLevel,
  subjectSlug: subjects.slug, subjectName: subjects.name, subjectColor: subjects.color,
};
const attemptQuery = () => db.select(attemptCols).from(attempts)
  .innerJoin(users, eq(users.id, attempts.userId))
  .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
  .innerJoin(chapters, eq(chapters.id, assessments.chapterId))
  .innerJoin(subjects, eq(subjects.id, chapters.subjectId));

/** Results of frontend quizzes, in the same shape as test attempts. */
async function quizRows(where: SQL[], limit: number) {
  const rows = await db.select({
    id: quizResults.id, score: quizResults.score, total: quizResults.total, durationSec: quizResults.durationSec, createdAt: quizResults.createdAt,
    userId: users.id, userName: users.name, userEmail: users.email, quizKey: quizResults.quizKey, topic: quizResults.topic,
    chapterNumber: quizResults.chapterNumber, chapterTitle: quizResults.chapterTitle, classLevel: quizResults.classLevel,
    subjectSlug: quizResults.subjectSlug, subjectName: subjects.name, subjectColor: subjects.color,
  }).from(quizResults)
    .innerJoin(users, eq(users.id, quizResults.userId))
    .leftJoin(subjects, eq(subjects.slug, quizResults.subjectSlug))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(quizResults.createdAt)).limit(limit);
  return rows.map((q) => ({ ...q, kind: 'quiz' as const, assessmentId: null as number | null, subjectName: q.subjectName ?? q.subjectSlug, subjectColor: q.subjectColor ?? '#0d9488' }));
}
const merge = <A extends { createdAt: Date }, B extends { createdAt: Date }>(a: A[], b: B[], limit: number): (A | B)[] =>
  [...a, ...b].sort((x, y) => +y.createdAt - +x.createdAt).slice(0, limit);

r.get('/stats', async (req, res) => {
  const cls = classLevel.catch('9').parse(req.query.classLevel);
  const [counts] = await db.select({
    approved: sql<number>`count(*) filter (where ${users.status} = 'approved')::int`,
    pending: sql<number>`count(*) filter (where ${users.status} = 'pending')::int`,
  }).from(users).where(eq(users.role, 'student'));
  const [att] = await db.select({
    count: sql<number>`count(*)::int`,
    average: sql<number>`coalesce(round(avg(${attempts.score} * 100.0 / nullif(${attempts.total}, 0))), 0)::int`,
  }).from(attempts);
  const pendingUsers = await db.select().from(users).where(and(eq(users.role, 'student'), eq(users.status, 'pending'))).orderBy(desc(users.createdAt)).limit(6);
  const [qa] = await db.select({
    count: sql<number>`count(*)::int`,
    sum: sql<number>`coalesce(sum(${quizResults.score} * 100.0 / nullif(${quizResults.total}, 0)), 0)::float`,
  }).from(quizResults);
  const [ta] = await db.select({ sum: sql<number>`coalesce(sum(${attempts.score} * 100.0 / nullif(${attempts.total}, 0)), 0)::float` }).from(attempts);
  const totalAttempts = att.count + qa.count;
  const averageScore = totalAttempts ? Math.round((ta.sum + qa.sum) / totalAttempts) : 0;
  const recentTests = (await attemptQuery().orderBy(desc(attempts.createdAt)).limit(8)).map((x) => ({ ...x, kind: 'test' as const, quizKey: null as string | null }));
  const recent = merge(recentTests, await quizRows([], 8), 8);
  const content = await db.select({
    slug: subjects.slug, name: subjects.name, color: subjects.color,
    chapters: sql<number>`(select count(*)::int from chapters c where c.subject_id = "subjects"."id" and c.class_level = ${cls})`,
    withNotes: sql<number>`(select count(*)::int from chapters c where c.subject_id = "subjects"."id" and c.class_level = ${cls} and exists(select 1 from notes n where n.chapter_id = c.id))`,
    withVideos: sql<number>`(select count(*)::int from chapters c where c.subject_id = "subjects"."id" and c.class_level = ${cls} and exists(select 1 from videos v where v.chapter_id = c.id))`,
    tests: sql<number>`(select count(*)::int from assessments a join chapters c on c.id = a.chapter_id where c.subject_id = "subjects"."id" and c.class_level = ${cls})`,
  }).from(subjects).orderBy(asc(subjects.sortOrder));
  res.json({
    students: counts.approved, pending: counts.pending, attempts: totalAttempts, averageScore,
    pendingUsers: pendingUsers.map(publicUser), recentAttempts: recent, content, classLevel: cls,
  });
});

r.get('/results', async (req, res) => {
  const where: SQL[] = [];
  const subject = String(req.query.subject || '');
  const q = String(req.query.q || '').trim();
  if (subject && subject !== 'all') where.push(eq(subjects.slug, subject));
  if (req.query.userId) where.push(eq(users.id, Number(req.query.userId)));
  if (q) where.push(or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`), ilike(assessments.topic, `%${q}%`))!);
  const rows = (await attemptQuery().where(where.length ? and(...where) : undefined).orderBy(desc(attempts.createdAt)).limit(500))
    .map((x) => ({ ...x, kind: 'test' as const, quizKey: null as string | null }));
  const qw: SQL[] = [];
  if (subject && subject !== 'all') qw.push(eq(quizResults.subjectSlug, subject));
  if (req.query.userId) qw.push(eq(users.id, Number(req.query.userId)));
  if (q) qw.push(or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`), ilike(quizResults.topic, `%${q}%`))!);
  res.json({ results: merge(rows, await quizRows(qw, 500), 500) });
});

export default r;
