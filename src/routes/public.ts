import { Router } from 'express';
import { asc, sql } from 'drizzle-orm';
import { db } from '../db';
import { subjects } from '../db/schema';
import { classLevel } from '../lib/http';

const r = Router();

r.get('/teacher', async (_req, res) => {
  const p = await db.query.teacherProfile.findFirst();
  res.json({ teacher: p ?? null });
});

r.get('/subjects', async (req, res) => {
  const cls = classLevel.catch('9').parse(req.query.classLevel);
  const rows = await db.select({
    id: subjects.id, slug: subjects.slug, name: subjects.name, color: subjects.color, icon: subjects.icon,
    chapterCount: sql<number>`(select count(*)::int from chapters c where c.subject_id = "subjects"."id" and c.class_level = ${cls})`,
    hasBook: sql<boolean>`exists(select 1 from books b where b.subject_id = "subjects"."id" and b.class_level = ${cls})`,
  }).from(subjects).orderBy(asc(subjects.sortOrder));
  res.json({ classLevel: cls, subjects: rows });
});

export default r;
