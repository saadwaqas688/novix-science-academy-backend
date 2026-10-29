import bcrypt from 'bcryptjs';
import { and, eq, sql } from 'drizzle-orm';
import { db } from './index';
import * as t from './schema';
import { config } from '../config';
import {
  SUBJECTS, CHAPTERS, TEACHER, DEMO_ASSESSMENTS, DEMO_VIDEOS, DEMO_STUDENTS, DEMO_STUDENT_PASSWORD,
} from './seed-data';

/** Idempotent: safe to run on every start. Only inserts what is missing. */
export async function seed() {
  // 1. admin account
  const admin = await db.query.users.findFirst({ where: eq(t.users.email, config.admin.email) });
  if (!admin) {
    await db.insert(t.users).values({
      name: config.admin.name, email: config.admin.email, phone: '', classLevel: '-',
      passwordHash: await bcrypt.hash(config.admin.password, 10), role: 'admin', status: 'approved',
    });
    console.log(`Created admin account ${config.admin.email}`);
  }

  // 2. teacher profile
  const prof = await db.query.teacherProfile.findFirst();
  if (!prof) await db.insert(t.teacherProfile).values({ id: 1, ...TEACHER });

  // 3. subjects + chapters
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(t.subjects);
  if (count === 0) {
    for (const s of SUBJECTS) {
      const [row] = await db.insert(t.subjects).values(s).returning();
      for (const [cls, titles] of Object.entries(CHAPTERS[s.slug] || {})) {
        if (titles.length) await db.insert(t.chapters).values(titles.map((title, i) => ({ subjectId: row.id, classLevel: cls, number: i + 1, title })));
      }
    }
    console.log('Seeded subjects and chapters');
  }

  if (!config.seedDemo) return;

  // 4. demo assessments + videos (only once)
  const [{ count: aCount }] = await db.select({ count: sql<number>`count(*)::int` }).from(t.assessments);
  if (aCount === 0) {
    const firstChapter = async (slug: string) => {
      const [r] = await db.select({ id: t.chapters.id }).from(t.chapters)
        .innerJoin(t.subjects, eq(t.subjects.id, t.chapters.subjectId))
        .where(and(eq(t.subjects.slug, slug), eq(t.chapters.classLevel, '9'), eq(t.chapters.number, 1)));
      return r?.id;
    };
    for (const a of DEMO_ASSESSMENTS) {
      const chapterId = await firstChapter(a.subject);
      if (!chapterId) continue;
      const [row] = await db.insert(t.assessments).values({ chapterId, topic: a.topic }).returning();
      await db.insert(t.questions).values(a.questions.map((q, i) => ({ assessmentId: row.id, sortOrder: i, ...q })));
    }
    const phy1 = await firstChapter('physics');
    if (phy1) await db.insert(t.videos).values(DEMO_VIDEOS.map((v, i) => ({ chapterId: phy1, sortOrder: i, ...v })));
    console.log('Seeded demo assessments and videos');
  }

  // 5. demo students + a few attempts for the first one
  for (const s of DEMO_STUDENTS) {
    const exists = await db.query.users.findFirst({ where: eq(t.users.email, s.email) });
    if (exists) continue;
    const [u] = await db.insert(t.users).values({ ...s, passwordHash: await bcrypt.hash(DEMO_STUDENT_PASSWORD, 10) }).returning();
    if (s.email === 'ayesha@student.pk') {
      const all = await db.select({ id: t.assessments.id }).from(t.assessments).orderBy(t.assessments.id);
      const scores = [6, 7, 5, 8, 8, 7, 9, 10];
      for (let i = 0; i < Math.min(scores.length, all.length * 2); i++) {
        const a = all[i % all.length];
        const created = new Date(Date.now() - (scores.length - i) * 3 * 86400000);
        await db.insert(t.attempts).values({ userId: u.id, assessmentId: a.id, answers: Array(10).fill(null), score: scores[i], total: 10, durationSec: 300 + i * 20, createdAt: created });
      }
    }
  }
}
