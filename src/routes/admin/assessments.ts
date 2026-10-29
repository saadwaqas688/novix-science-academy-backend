import { Router } from 'express';
import { z } from 'zod';
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '../../db';
import { assessments, chapters, questions, subjects } from '../../db/schema';
import { body, classLevel, idParam, notFound } from '../../lib/http';

const r = Router();
export const QUESTIONS_PER_TEST = 10;

const questionSchema = z.object({
  text: z.string().trim().min(3, 'Question text is required').max(1000),
  options: z.array(z.string().trim().min(1, 'Option cannot be empty').max(300)).length(4, 'Each question needs exactly 4 options'),
  correctIndex: z.number().int().min(0).max(3),
});
const assessmentSchema = z.object({
  chapterId: z.number().int().positive(),
  topic: z.string().trim().min(2, 'Topic is required').max(200),
  published: z.boolean().default(true),
  questions: z.array(questionSchema).length(QUESTIONS_PER_TEST, `An assessment must have exactly ${QUESTIONS_PER_TEST} questions`),
});

r.get('/', async (req, res) => {
  const where: SQL[] = [];
  const subject = req.query.subject ? String(req.query.subject) : '';
  const cls = classLevel.optional().catch(undefined).parse(req.query.classLevel);
  if (subject && subject !== 'all') where.push(eq(subjects.slug, subject));
  if (cls) where.push(eq(chapters.classLevel, cls));
  if (req.query.chapterId) where.push(eq(chapters.id, Number(req.query.chapterId)));
  const rows = await db.select({
    id: assessments.id, topic: assessments.topic, published: assessments.published, createdAt: assessments.createdAt,
    chapterId: chapters.id, chapterNumber: chapters.number, chapterTitle: chapters.title, classLevel: chapters.classLevel,
    subjectSlug: subjects.slug, subjectName: subjects.name, subjectColor: subjects.color,
    questionCount: sql<number>`(select count(*)::int from questions q where q.assessment_id = "assessments"."id")`,
    attemptCount: sql<number>`(select count(*)::int from attempts t where t.assessment_id = "assessments"."id")`,
  }).from(assessments)
    .innerJoin(chapters, eq(chapters.id, assessments.chapterId))
    .innerJoin(subjects, eq(subjects.id, chapters.subjectId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(subjects.sortOrder), asc(chapters.number), desc(assessments.id));
  res.json({ assessments: rows });
});

r.get('/:id', async (req, res) => {
  const a = await db.query.assessments.findFirst({ where: eq(assessments.id, idParam(req)) });
  if (!a) throw notFound('Assessment not found');
  const ch = (await db.query.chapters.findFirst({ where: eq(chapters.id, a.chapterId) }))!;
  const s = (await db.query.subjects.findFirst({ where: eq(subjects.id, ch.subjectId) }))!;
  const qs = await db.select().from(questions).where(eq(questions.assessmentId, a.id)).orderBy(asc(questions.sortOrder));
  res.json({
    assessment: { ...a, subjectSlug: s.slug, classLevel: ch.classLevel, chapterNumber: ch.number },
    questions: qs.map((q) => ({ text: q.text, options: q.options, correctIndex: q.correctIndex })),
  });
});

async function ensureChapter(id: number) {
  if (!(await db.query.chapters.findFirst({ where: eq(chapters.id, id) }))) throw notFound('Chapter not found');
}

r.post('/', async (req, res) => {
  const d = body(req, assessmentSchema);
  await ensureChapter(d.chapterId);
  const row = await db.transaction(async (tx) => {
    const [a] = await tx.insert(assessments).values({ chapterId: d.chapterId, topic: d.topic, published: d.published }).returning();
    await tx.insert(questions).values(d.questions.map((q, i) => ({ assessmentId: a.id, sortOrder: i, ...q })));
    return a;
  });
  res.status(201).json({ assessment: row });
});

r.put('/:id', async (req, res) => {
  const id = idParam(req);
  const d = body(req, assessmentSchema);
  await ensureChapter(d.chapterId);
  const row = await db.transaction(async (tx) => {
    const [a] = await tx.update(assessments).set({ chapterId: d.chapterId, topic: d.topic, published: d.published }).where(eq(assessments.id, id)).returning();
    if (!a) throw notFound('Assessment not found');
    await tx.delete(questions).where(eq(questions.assessmentId, id));
    await tx.insert(questions).values(d.questions.map((q, i) => ({ assessmentId: id, sortOrder: i, ...q })));
    return a;
  });
  res.json({ assessment: row });
});

r.delete('/:id', async (req, res) => {
  const [row] = await db.delete(assessments).where(eq(assessments.id, idParam(req))).returning();
  if (!row) throw notFound('Assessment not found');
  res.status(204).end();
});

export default r;
