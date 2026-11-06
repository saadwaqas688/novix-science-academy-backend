import { Router } from 'express';
import { z } from 'zod';
import { asc, eq, ilike, inArray, sql } from 'drizzle-orm';
import { db } from '../../db';
import { attendanceRecords, attendanceStudents } from '../../db/schema';
import { badRequest, body, idParam, notFound } from '../../lib/http';

/**
 * Attendance register uploaded in bulk from Excel. These students are a separate list and are
 * NOT linked to the students who sign in to the app.
 */
const r = Router();
const nameKey = (n: string) => n.trim().replace(/\s+/g, ' ').toLowerCase();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const status = z.enum(['present', 'absent', 'leave']);

/** Latest date in the register (the "today" for last-N-days stats). */
async function latestDate() {
  const [x] = await db.select({ d: sql<string | null>`max(${attendanceRecords.date})::text` }).from(attendanceRecords);
  return x?.d ?? null;
}

r.get('/students', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const latest = await latestDate();
  const since = latest ? sql`(${latest}::date - 29)` : sql`now()::date`;
  const rows = await db.select({
    id: attendanceStudents.id, name: attendanceStudents.name, groupName: attendanceStudents.groupName,
    present: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'present')::int`,
    absent: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'absent')::int`,
    leave: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'leave')::int`,
    present30: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'present' and ${attendanceRecords.date} >= ${since})::int`,
    marked30: sql<number>`count(*) filter (where ${attendanceRecords.date} >= ${since})::int`,
    lastDate: sql<string | null>`max(${attendanceRecords.date})::text`,
    recent: sql<string[] | null>`(array_agg(${attendanceRecords.status}::text order by ${attendanceRecords.date} desc) filter (where ${attendanceRecords.date} is not null))[1:10]`,
  }).from(attendanceStudents)
    .leftJoin(attendanceRecords, eq(attendanceRecords.studentId, attendanceStudents.id))
    .where(q ? ilike(attendanceStudents.name, `%${q}%`) : undefined)
    .groupBy(attendanceStudents.id)
    .orderBy(asc(attendanceStudents.name));
  const [range] = await db.select({
    first: sql<string | null>`min(${attendanceRecords.date})::text`,
    days: sql<number>`count(distinct ${attendanceRecords.date})::int`,
  }).from(attendanceRecords);
  const latestDay = latest
    ? (await db.select({ status: attendanceRecords.status, n: sql<number>`count(*)::int` }).from(attendanceRecords).where(eq(attendanceRecords.date, latest)).groupBy(attendanceRecords.status))
    : [];
  res.json({
    students: rows.map((x) => ({ ...x, recent: (x.recent ?? []).reverse() })),
    summary: {
      students: rows.length, firstDate: range.first, latestDate: latest, days: range.days,
      latestDay: Object.fromEntries(latestDay.map((x) => [x.status, x.n])) as Partial<Record<'present' | 'absent' | 'leave', number>>,
    },
  });
});

r.get('/students/:id', async (req, res) => {
  const id = idParam(req);
  const s = await db.query.attendanceStudents.findFirst({ where: eq(attendanceStudents.id, id) });
  if (!s) throw notFound('Student not found');
  const records = await db.select({ date: attendanceRecords.date, status: attendanceRecords.status })
    .from(attendanceRecords).where(eq(attendanceRecords.studentId, id)).orderBy(asc(attendanceRecords.date));
  res.json({ student: s, records, latestDate: await latestDate() });
});

/** Bulk import from a parsed Excel sheet. Existing marks for the same student + date are replaced. */
r.post('/import', async (req, res) => {
  const d = body(req, z.object({
    rows: z.array(z.object({
      name: z.string().trim().min(1).max(120),
      group: z.string().trim().max(60).optional(),
      records: z.array(z.object({ date: isoDate, status })).max(400),
    })).min(1, 'The sheet has no students').max(3000),
  }));
  const byKey = new Map<string, { name: string; group?: string; records: Map<string, 'present' | 'absent' | 'leave'> }>();
  for (const row of d.rows) {
    const k = nameKey(row.name);
    const cur = byKey.get(k) ?? { name: row.name.trim().replace(/\s+/g, ' '), group: row.group, records: new Map() };
    row.records.forEach((x) => cur.records.set(x.date, x.status));
    if (row.group) cur.group = row.group;
    byKey.set(k, cur);
  }
  const totalRecords = [...byKey.values()].reduce((n, x) => n + x.records.size, 0);
  if (totalRecords > 200_000) throw badRequest('The sheet is too large. Please upload at most 200,000 marks at a time.');

  const result = await db.transaction(async (tx) => {
    const keys = [...byKey.keys()];
    const existing = new Map<string, number>();
    for (let i = 0; i < keys.length; i += 1000) {
      const part = await tx.select({ id: attendanceStudents.id, nameKey: attendanceStudents.nameKey }).from(attendanceStudents).where(inArray(attendanceStudents.nameKey, keys.slice(i, i + 1000)));
      part.forEach((x) => existing.set(x.nameKey, x.id));
    }
    const toCreate = keys.filter((k) => !existing.has(k));
    for (let i = 0; i < toCreate.length; i += 500) {
      const made = await tx.insert(attendanceStudents)
        .values(toCreate.slice(i, i + 500).map((k) => ({ name: byKey.get(k)!.name, nameKey: k, groupName: byKey.get(k)!.group ?? '' })))
        .returning({ id: attendanceStudents.id, nameKey: attendanceStudents.nameKey });
      made.forEach((x) => existing.set(x.nameKey, x.id));
    }
    for (const k of keys) {
      const g = byKey.get(k)!.group;
      if (g && !toCreate.includes(k)) await tx.update(attendanceStudents).set({ groupName: g }).where(eq(attendanceStudents.id, existing.get(k)!));
    }
    const all = keys.flatMap((k) => [...byKey.get(k)!.records].map(([date, st]) => ({ studentId: existing.get(k)!, date, status: st })));
    for (let i = 0; i < all.length; i += 2000) {
      await tx.insert(attendanceRecords).values(all.slice(i, i + 2000))
        .onConflictDoUpdate({ target: [attendanceRecords.studentId, attendanceRecords.date], set: { status: sql`excluded.status` } });
    }
    return { studentsCreated: toCreate.length, studentsUpdated: keys.length - toCreate.length, marksSaved: all.length };
  });
  res.status(201).json(result);
});

r.patch('/students/:id', async (req, res) => {
  const d = body(req, z.object({ name: z.string().trim().min(1).max(120).optional(), groupName: z.string().trim().max(60).optional() }));
  const patch: Partial<typeof attendanceStudents.$inferInsert> = {};
  if (d.name) { patch.name = d.name.replace(/\s+/g, ' '); patch.nameKey = nameKey(d.name); }
  if (d.groupName !== undefined) patch.groupName = d.groupName;
  if (!Object.keys(patch).length) throw badRequest('Nothing to update');
  try {
    const [row] = await db.update(attendanceStudents).set(patch).where(eq(attendanceStudents.id, idParam(req))).returning();
    if (!row) throw notFound('Student not found');
    res.json({ student: row });
  } catch (e) {
    if ((e as { code?: string })?.code === '23505' || String((e as { cause?: { code?: string } })?.cause?.code) === '23505') throw badRequest('Another student already has this name');
    throw e;
  }
});

/** Change or clear one day's mark. */
r.put('/students/:id/records/:date', async (req, res) => {
  const id = idParam(req);
  const day = isoDate.parse(req.params.date);
  const d = body(req, z.object({ status: status.nullable() }));
  if (d.status === null) {
    await db.delete(attendanceRecords).where(sql`${attendanceRecords.studentId} = ${id} and ${attendanceRecords.date} = ${day}`);
  } else {
    await db.insert(attendanceRecords).values({ studentId: id, date: day, status: d.status })
      .onConflictDoUpdate({ target: [attendanceRecords.studentId, attendanceRecords.date], set: { status: d.status } });
  }
  res.status(204).end();
});

r.delete('/students/:id', async (req, res) => {
  await db.delete(attendanceStudents).where(eq(attendanceStudents.id, idParam(req)));
  res.status(204).end();
});

/** Remove the whole register. */
r.delete('/', async (_req, res) => {
  await db.delete(attendanceStudents);
  res.status(204).end();
});

export default r;
