import { Router } from 'express';
import { z } from 'zod';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { assessments, attempts, books, chapters, notes, questions, subjects, videos } from '../db/schema';
import { badRequest, body, classLevel, forbidden, idParam, notFound } from '../lib/http';
import { requireAuth } from '../middleware/auth';

const r = Router();
r.use(['/subjects/:slug', '/chapters', '/assessments', '/attempts', '/me'], requireAuth);

/** Subject page: book + chapters with content counts + the student's progress. */
r.get('/subjects/:slug', async (req, res) => {
  const cls = classLevel.catch('9').parse(req.query.classLevel);
  const s = await db.query.subjects.findFirst({ where: eq(subjects.slug, String(req.params.slug)) });
  if (!s) throw notFound('Subject not found');
  const uid = req.user!.id;
  const book = await db.query.books.findFirst({ where: and(eq(books.subjectId, s.id), eq(books.classLevel, cls)) });
  const list = await db.select({
    id: chapters.id, number: chapters.number, title: chapters.title,
    hasNotes: sql<boolean>`exists(select 1 from notes n where n.chapter_id = "chapters"."id")`,
    videoCount: sql<number>`(select count(*)::int from videos v where v.chapter_id = "chapters"."id")`,
    assessmentCount: sql<number>`(select count(*)::int from assessments a where a.chapter_id = "chapters"."id" and a.published)`,
    completedCount: sql<number>`(select count(distinct a.id)::int from assessments a join attempts t on t.assessment_id = a.id where a.chapter_id = "chapters"."id" and a.published and t.user_id = ${uid})`,
  }).from(chapters).where(and(eq(chapters.subjectId, s.id), eq(chapters.classLevel, cls))).orderBy(asc(chapters.number));
  const total = list.reduce((n, c) => n + c.assessmentCount, 0);
  const done = list.reduce((n, c) => n + c.completedCount, 0);
  res.json({ subject: s, classLevel: cls, book: book ?? null, chapters: list, progress: { done, total } });
});

/** Chapter page: notes, videos, assessments (with the student's best score). */
r.get('/chapters/:id', async (req, res) => {
  const id = idParam(req);
  const ch = await db.query.chapters.findFirst({ where: eq(chapters.id, id) });
  if (!ch) throw notFound('Chapter not found');
  const s = await db.query.subjects.findFirst({ where: eq(subjects.id, ch.subjectId) });
  const note = await db.query.notes.findFirst({ where: eq(notes.chapterId, id) });
  const vids = await db.select().from(videos).where(eq(videos.chapterId, id)).orderBy(asc(videos.sortOrder), asc(videos.id));
  const uid = req.user!.id;
  const tests = await db.select({
    id: assessments.id, topic: assessments.topic,
    questionCount: sql<number>`(select count(*)::int from questions q where q.assessment_id = "assessments"."id")`,
    bestScore: sql<number | null>`(select max(t.score) from attempts t where t.assessment_id = "assessments"."id" and t.user_id = ${uid})`,
    attemptCount: sql<number>`(select count(*)::int from attempts t where t.assessment_id = "assessments"."id" and t.user_id = ${uid})`,
  }).from(assessments).where(and(eq(assessments.chapterId, id), eq(assessments.published, true))).orderBy(asc(assessments.id));
  const chapterCount = await db.$count(chapters, and(eq(chapters.subjectId, ch.subjectId), eq(chapters.classLevel, ch.classLevel)));
  res.json({ chapter: ch, chapterCount, subject: s, notes: note ?? null, videos: vids, assessments: tests });
});

async function loadAssessment(id: number) {
  const a = await db.query.assessments.findFirst({ where: eq(assessments.id, id) });
  if (!a) throw notFound('Assessment not found');
  const ch = (await db.query.chapters.findFirst({ where: eq(chapters.id, a.chapterId) }))!;
  const s = (await db.query.subjects.findFirst({ where: eq(subjects.id, ch.subjectId) }))!;
  const qs = await db.select().from(questions).where(eq(questions.assessmentId, id)).orderBy(asc(questions.sortOrder));
  return { a, ch, s, qs };
}
const meta = (a: { id: number; topic: string }, ch: typeof chapters.$inferSelect, s: typeof subjects.$inferSelect) => ({
  id: a.id, topic: a.topic,
  chapter: { id: ch.id, number: ch.number, title: ch.title, classLevel: ch.classLevel },
  subject: { slug: s.slug, name: s.name, color: s.color, icon: s.icon },
});

/** Questions for taking a test — correct answers are NOT sent. */
r.get('/assessments/:id', async (req, res) => {
  const { a, ch, s, qs } = await loadAssessment(idParam(req));
  if (!a.published && req.user!.role !== 'admin') throw notFound('Assessment not found');
  res.json({ assessment: meta(a, ch, s), questions: qs.map((q) => ({ id: q.id, text: q.text, options: q.options })) });
});

function review(qs: (typeof questions.$inferSelect)[], answers: (number | null)[]) {
  return qs.map((q, i) => ({ id: q.id, text: q.text, options: q.options, correctIndex: q.correctIndex, answer: answers[i] ?? null, correct: answers[i] === q.correctIndex }));
}

/** Submit answers; server calculates the score. */
r.post('/assessments/:id/attempts', async (req, res) => {
  const { a, ch, s, qs } = await loadAssessment(idParam(req));
  if (!a.published) throw notFound('Assessment not found');
  const d = body(req, z.object({
    answers: z.array(z.number().int().min(0).max(3).nullable()),
    durationSec: z.number().int().min(0).max(24 * 3600).default(0),
  }));
  if (d.answers.length !== qs.length) throw badRequest(`Expected ${qs.length} answers`);
  const score = qs.reduce((n, q, i) => n + (d.answers[i] === q.correctIndex ? 1 : 0), 0);
  const [row] = await db.insert(attempts).values({ userId: req.user!.id, assessmentId: a.id, answers: d.answers, score, total: qs.length, durationSec: d.durationSec }).returning();
  res.status(201).json({ attempt: { id: row.id, score, total: qs.length, durationSec: row.durationSec, createdAt: row.createdAt }, assessment: meta(a, ch, s), review: review(qs, d.answers) });
});

r.get('/attempts/:id', async (req, res) => {
  const row = await db.query.attempts.findFirst({ where: eq(attempts.id, idParam(req)) });
  if (!row) throw notFound('Result not found');
  if (row.userId !== req.user!.id && req.user!.role !== 'admin') throw forbidden();
  const { a, ch, s, qs } = await loadAssessment(row.assessmentId);
  res.json({ attempt: { id: row.id, score: row.score, total: row.total, durationSec: row.durationSec, createdAt: row.createdAt }, assessment: meta(a, ch, s), review: review(qs, row.answers) });
});

/** Assessment history + summary for the progress page. */
r.get('/me/progress', async (req, res) => {
  const rows = await db.select({
    id: attempts.id, score: attempts.score, total: attempts.total, durationSec: attempts.durationSec, createdAt: attempts.createdAt,
    assessmentId: assessments.id, topic: assessments.topic,
    chapterId: chapters.id, chapterNumber: chapters.number, chapterTitle: chapters.title, classLevel: chapters.classLevel,
    subjectSlug: subjects.slug, subjectName: subjects.name, subjectColor: subjects.color, subjectIcon: subjects.icon,
  }).from(attempts)
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .innerJoin(chapters, eq(chapters.id, assessments.chapterId))
    .innerJoin(subjects, eq(subjects.id, chapters.subjectId))
    .where(eq(attempts.userId, req.user!.id))
    .orderBy(desc(attempts.createdAt));
  const pct = (x: { score: number; total: number }) => (x.total ? (x.score / x.total) * 100 : 0);
  const avg = (l: typeof rows) => (l.length ? Math.round(l.reduce((n, x) => n + pct(x), 0) / l.length) : 0);
  const allSubjects = await db.select().from(subjects).orderBy(asc(subjects.sortOrder));
  const bySubject = allSubjects.map((s) => {
    const l = rows.filter((x) => x.subjectSlug === s.slug);
    return { slug: s.slug, name: s.name, color: s.color, icon: s.icon, count: l.length, average: avg(l) };
  });
  const best = bySubject.filter((x) => x.count).sort((x, y) => y.average - x.average)[0];
  res.json({
    attempts: rows,
    summary: { count: rows.length, average: avg(rows), bestSubject: best ? best.name : null, questionsAnswered: rows.reduce((n, x) => n + x.total, 0) },
    bySubject,
  });
});

export default r;
