import { Router } from 'express';
import { z } from 'zod';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { noteHighlights } from '../db/schema';
import { badRequest, body, idParam, notFound } from '../lib/http';
import { requireAuth } from '../middleware/auth';

/** Each student's own highlights on the notes PDFs. Nobody else can see or change them. */
const r = Router();
r.use(requireAuth);

const COLORS = ['yellow', 'green', 'blue', 'pink', 'orange', 'purple', 'red', 'teal'] as const;
const fileUrl = z.string().trim().min(5).max(300).regex(/^\/[\w\-./]+\.pdf$/i, 'Invalid file');
const MAX_PER_FILE = 500;

r.get('/', async (req, res) => {
  const f = fileUrl.safeParse(req.query.file);
  if (!f.success) throw badRequest('file is required');
  const rows = await db.select().from(noteHighlights)
    .where(and(eq(noteHighlights.userId, req.user!.id), eq(noteHighlights.fileUrl, f.data)))
    .orderBy(asc(noteHighlights.page), asc(noteHighlights.id));
  res.json({ highlights: rows });
});

r.post('/', async (req, res) => {
  const d = body(req, z.object({
    fileUrl,
    page: z.number().int().min(1).max(2000),
    rects: z.array(z.object({
      x: z.number().min(0).max(1), y: z.number().min(0).max(1),
      w: z.number().min(0).max(1), h: z.number().min(0).max(1),
    })).min(1).max(200),
    text: z.string().max(5000).default(''),
    color: z.enum(COLORS).default('yellow'),
  }));
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(noteHighlights)
    .where(and(eq(noteHighlights.userId, req.user!.id), eq(noteHighlights.fileUrl, d.fileUrl)));
  if (n >= MAX_PER_FILE) throw badRequest('Too many highlights on this file');
  const [row] = await db.insert(noteHighlights).values({ ...d, userId: req.user!.id }).returning();
  res.status(201).json({ highlight: row });
});

r.patch('/:id', async (req, res) => {
  const d = body(req, z.object({ color: z.enum(COLORS) }));
  const [row] = await db.update(noteHighlights).set({ color: d.color })
    .where(and(eq(noteHighlights.id, idParam(req)), eq(noteHighlights.userId, req.user!.id))).returning();
  if (!row) throw notFound('Highlight not found');
  res.json({ highlight: row });
});

r.delete('/:id', async (req, res) => {
  const [row] = await db.delete(noteHighlights)
    .where(and(eq(noteHighlights.id, idParam(req)), eq(noteHighlights.userId, req.user!.id))).returning({ id: noteHighlights.id });
  if (!row) throw notFound('Highlight not found');
  res.status(204).end();
});

export default r;
