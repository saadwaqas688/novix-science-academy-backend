import { Router } from 'express';
import { z } from 'zod';
import { and, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '../db';
import { quizResults, subjects } from '../db/schema';
import { badRequest, body, classLevel, forbidden, idParam, notFound } from '../lib/http';
import { requireAuth } from '../middleware/auth';

/**
 * Quizzes whose questions are shipped with the frontend.
 * The backend only stores the result when a student completes a quiz.
 */
const r = Router();
r.use(requireAuth);

r.post('/', async (req, res) => {
  const d = body(req, z.object({
    quizKey: z.string().trim().min(3).max(120),
    subjectSlug: z.string().trim().min(2).max(40),
    classLevel,
    chapterNumber: z.number().int().min(1).max(50),
    chapterTitle: z.string().trim().max(200).default(''),
    topic: z.string().trim().min(2).max(200),
    answers: z.array(z.number().int().min(0).max(5).nullable()).min(1).max(100),
    score: z.number().int().min(0),
    total: z.number().int().min(1).max(100),
    durationSec: z.number().int().min(0).max(24 * 3600).default(0),
  }));
  if (d.answers.length !== d.total) throw badRequest('answers must match total');
  if (d.score > d.total) throw badRequest('score cannot be more than total');
  const [row] = await db.insert(quizResults).values({ ...d, userId: req.user!.id }).returning();
  res.status(201).json({ result: row });
});

/** Best score + attempts per quiz for the signed-in student. */
r.get('/', async (req, res) => {
  const where: SQL[] = [eq(quizResults.userId, req.user!.id)];
  if (req.query.subject) where.push(eq(quizResults.subjectSlug, String(req.query.subject)));
  if (req.query.classLevel) where.push(eq(quizResults.classLevel, String(req.query.classLevel)));
  if (req.query.chapterNumber) where.push(eq(quizResults.chapterNumber, Number(req.query.chapterNumber)));
  const rows = await db.select({
    quizKey: quizResults.quizKey,
    chapterNumber: quizResults.chapterNumber,
    best: sql<number>`max(${quizResults.score})::int`,
    total: sql<number>`max(${quizResults.total})::int`,
    count: sql<number>`count(*)::int`,
  }).from(quizResults).where(and(...where)).groupBy(quizResults.quizKey, quizResults.chapterNumber);
  res.json({ results: rows });
});

r.get('/:id', async (req, res) => {
  const [row] = await db.select({ q: quizResults, subjectName: subjects.name }).from(quizResults)
    .leftJoin(subjects, eq(subjects.slug, quizResults.subjectSlug)).where(eq(quizResults.id, idParam(req)));
  if (!row) throw notFound('Result not found');
  if (row.q.userId !== req.user!.id && req.user!.role !== 'admin') throw forbidden();
  res.json({ result: { ...row.q, subjectName: row.subjectName ?? row.q.subjectSlug } });
});

export default r;
