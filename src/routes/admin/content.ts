import { Router } from 'express';
import { z } from 'zod';
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import { db } from '../../db';
import { books, chapters, notes, subjects, teacherProfile, videos } from '../../db/schema';
import { badRequest, body, classLevel, idParam, notFound } from '../../lib/http';
import { discardUpload, removeFile, storeFile, uploadImage, uploadPdf } from '../../middleware/upload';

const r = Router();

/* ---------- teacher profile ---------- */
r.put('/teacher', async (req, res) => {
  const d = body(req, z.object({
    name: z.string().trim().min(2).max(100),
    title: z.string().trim().max(200).default(''),
    intro: z.string().trim().max(3000).default(''),
    highlights: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
    years: z.string().trim().max(20).default(''),
    students: z.string().trim().max(20).default(''),
    results: z.string().trim().max(20).default(''),
  }));
  const [row] = await db.insert(teacherProfile).values({ id: 1, ...d, updatedAt: new Date() })
    .onConflictDoUpdate({ target: teacherProfile.id, set: { ...d, updatedAt: new Date() } }).returning();
  res.json({ teacher: row });
});

r.post('/teacher/photo', uploadImage, async (req, res) => {
  if (!req.file) throw badRequest('Please choose an image');
  const old = await db.query.teacherProfile.findFirst();
  const url = await storeFile('photos', req.file);
  const [row] = await db.update(teacherProfile).set({ photoUrl: url, updatedAt: new Date() }).where(eq(teacherProfile.id, 1)).returning();
  removeFile(old?.photoUrl);
  res.json({ teacher: row });
});

r.delete('/teacher/photo', async (_req, res) => {
  const old = await db.query.teacherProfile.findFirst();
  const [row] = await db.update(teacherProfile).set({ photoUrl: null, updatedAt: new Date() }).where(eq(teacherProfile.id, 1)).returning();
  removeFile(old?.photoUrl);
  res.json({ teacher: row });
});

/* ---------- subjects / chapters ---------- */
async function subjectBySlug(slug: string) {
  const s = await db.query.subjects.findFirst({ where: eq(subjects.slug, slug) });
  if (!s) throw notFound('Subject not found');
  return s;
}

r.get('/subjects', async (req, res) => {
  const cls = classLevel.catch('9').parse(req.query.classLevel);
  const rows = await db.select({
    id: subjects.id, slug: subjects.slug, name: subjects.name, color: subjects.color, icon: subjects.icon,
    chapterCount: sql<number>`(select count(*)::int from chapters c where c.subject_id = "subjects"."id" and c.class_level = ${cls})`,
  }).from(subjects).orderBy(asc(subjects.sortOrder));
  res.json({ subjects: rows });
});

r.get('/subjects/:slug/chapters', async (req, res) => {
  const cls = classLevel.catch('9').parse(req.query.classLevel);
  const s = await subjectBySlug(String(req.params.slug));
  const book = await db.query.books.findFirst({ where: and(eq(books.subjectId, s.id), eq(books.classLevel, cls)) });
  const list = await db.select({
    id: chapters.id, number: chapters.number, title: chapters.title,
    notes: sql<{ fileName: string; fileUrl: string; sizeBytes: number } | null>`(select json_build_object('fileName', n.file_name, 'fileUrl', n.file_url, 'sizeBytes', n.size_bytes) from notes n where n.chapter_id = "chapters"."id")`,
    videos: sql<{ id: number; title: string; youtubeUrl: string; duration: string | null }[]>`coalesce((select json_agg(json_build_object('id', v.id, 'title', v.title, 'youtubeUrl', v.youtube_url, 'duration', v.duration) order by v.sort_order, v.id) from videos v where v.chapter_id = "chapters"."id"), '[]'::json)`,
    assessmentCount: sql<number>`(select count(*)::int from assessments a where a.chapter_id = "chapters"."id")`,
  }).from(chapters).where(and(eq(chapters.subjectId, s.id), eq(chapters.classLevel, cls))).orderBy(asc(chapters.number));
  res.json({ subject: s, classLevel: cls, book: book ?? null, chapters: list });
});

r.post('/chapters', async (req, res) => {
  const d = body(req, z.object({ subjectSlug: z.string(), classLevel, title: z.string().trim().min(2).max(160) }));
  const s = await subjectBySlug(d.subjectSlug);
  const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${chapters.number}), 0)::int` }).from(chapters)
    .where(and(eq(chapters.subjectId, s.id), eq(chapters.classLevel, d.classLevel)));
  const [row] = await db.insert(chapters).values({ subjectId: s.id, classLevel: d.classLevel, number: max + 1, title: d.title }).returning();
  res.status(201).json({ chapter: row });
});

r.patch('/chapters/:id', async (req, res) => {
  const d = body(req, z.object({ title: z.string().trim().min(2).max(160) }));
  const [row] = await db.update(chapters).set({ title: d.title }).where(eq(chapters.id, idParam(req))).returning();
  if (!row) throw notFound('Chapter not found');
  res.json({ chapter: row });
});

r.delete('/chapters/:id', async (req, res) => {
  const id = idParam(req);
  const ch = await db.query.chapters.findFirst({ where: eq(chapters.id, id) });
  if (!ch) throw notFound('Chapter not found');
  const n = await db.query.notes.findFirst({ where: eq(notes.chapterId, id) });
  await db.transaction(async (tx) => {
    await tx.delete(chapters).where(eq(chapters.id, id));
    await tx.update(chapters).set({ number: sql`${chapters.number} - 1` })
      .where(and(eq(chapters.subjectId, ch.subjectId), eq(chapters.classLevel, ch.classLevel), gt(chapters.number, ch.number)));
  });
  removeFile(n?.fileUrl);
  res.status(204).end();
});

/* ---------- notes (one PDF per chapter) ---------- */
r.post('/chapters/:id/notes', uploadPdf('notes'), async (req, res) => {
  const id = idParam(req);
  if (!req.file) throw badRequest('Please choose a PDF file');
  const ch = await db.query.chapters.findFirst({ where: eq(chapters.id, id) });
  if (!ch) { discardUpload(req.file); throw notFound('Chapter not found'); }
  const old = await db.query.notes.findFirst({ where: eq(notes.chapterId, id) });
  const values = { chapterId: id, fileUrl: await storeFile('notes', req.file), fileName: req.file.originalname, sizeBytes: req.file.size };
  const [row] = await db.insert(notes).values(values).onConflictDoUpdate({ target: notes.chapterId, set: { ...values, createdAt: new Date() } }).returning();
  removeFile(old?.fileUrl);
  res.json({ notes: row });
});

r.delete('/chapters/:id/notes', async (req, res) => {
  const id = idParam(req);
  const [old] = await db.delete(notes).where(eq(notes.chapterId, id)).returning();
  removeFile(old?.fileUrl);
  res.status(204).end();
});

/* ---------- YouTube videos (replace the whole list) ---------- */
const youtube = z.string().trim().regex(/^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\//i, 'Must be a YouTube link');
r.put('/chapters/:id/videos', async (req, res) => {
  const id = idParam(req);
  const d = body(req, z.object({
    videos: z.array(z.object({ title: z.string().trim().min(2).max(200), youtubeUrl: youtube, duration: z.string().trim().max(10).optional().nullable() })).max(50),
  }));
  if (!(await db.query.chapters.findFirst({ where: eq(chapters.id, id) }))) throw notFound('Chapter not found');
  const list = await db.transaction(async (tx) => {
    await tx.delete(videos).where(eq(videos.chapterId, id));
    if (!d.videos.length) return [];
    return tx.insert(videos).values(d.videos.map((v, i) => ({ chapterId: id, title: v.title, youtubeUrl: /^https?:/i.test(v.youtubeUrl) ? v.youtubeUrl : `https://${v.youtubeUrl}`, duration: v.duration || null, sortOrder: i }))).returning();
  });
  res.json({ videos: list });
});

/* ---------- course book (one PDF per subject + class) ---------- */
r.post('/books', uploadPdf('books'), async (req, res) => {
  if (!req.file) throw badRequest('Please choose a PDF file');
  const d = body(req, z.object({ subjectSlug: z.string(), classLevel }));
  const s = await subjectBySlug(d.subjectSlug);
  const old = await db.query.books.findFirst({ where: and(eq(books.subjectId, s.id), eq(books.classLevel, d.classLevel)) });
  const values = { subjectId: s.id, classLevel: d.classLevel, fileUrl: await storeFile('books', req.file), fileName: req.file.originalname, sizeBytes: req.file.size };
  const [row] = await db.insert(books).values(values).onConflictDoUpdate({ target: [books.subjectId, books.classLevel], set: { ...values, createdAt: new Date() } }).returning();
  removeFile(old?.fileUrl);
  res.json({ book: row });
});

r.delete('/books/:id', async (req, res) => {
  const [old] = await db.delete(books).where(eq(books.id, idParam(req))).returning();
  if (!old) throw notFound('Book not found');
  removeFile(old.fileUrl);
  res.status(204).end();
});

export default r;
