import {
  customType, pgTable, pgEnum, serial, integer, text, timestamp, boolean, jsonb, uniqueIndex, index, date,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['student', 'admin']);
export const userStatusEnum = pgEnum('user_status', ['pending', 'approved', 'rejected', 'disabled']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull().default(''),
  classLevel: text('class_level').notNull().default('9'),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('student'),
  status: userStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('users_email_unique').on(t.email)]);

export const teacherProfile = pgTable('teacher_profile', {
  id: integer('id').primaryKey().default(1),
  name: text('name').notNull(),
  title: text('title').notNull().default(''),
  intro: text('intro').notNull().default(''),
  highlights: jsonb('highlights').$type<string[]>().notNull().default([]),
  years: text('years').notNull().default(''),
  students: text('students').notNull().default(''),
  results: text('results').notNull().default(''),
  photoUrl: text('photo_url'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const subjects = pgTable('subjects', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [uniqueIndex('subjects_slug_unique').on(t.slug)]);

export const books = pgTable('books', {
  id: serial('id').primaryKey(),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  classLevel: text('class_level').notNull(),
  fileUrl: text('file_url').notNull(),
  fileName: text('file_name').notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('books_subject_class_unique').on(t.subjectId, t.classLevel)]);

export const chapters = pgTable('chapters', {
  id: serial('id').primaryKey(),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  classLevel: text('class_level').notNull(),
  number: integer('number').notNull(),
  title: text('title').notNull(),
}, (t) => [index('chapters_subject_class_idx').on(t.subjectId, t.classLevel)]);

export const notes = pgTable('notes', {
  id: serial('id').primaryKey(),
  chapterId: integer('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  fileUrl: text('file_url').notNull(),
  fileName: text('file_name').notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('notes_chapter_unique').on(t.chapterId)]);

export const videos = pgTable('videos', {
  id: serial('id').primaryKey(),
  chapterId: integer('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  youtubeUrl: text('youtube_url').notNull(),
  duration: text('duration'),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [index('videos_chapter_idx').on(t.chapterId)]);

export const assessments = pgTable('assessments', {
  id: serial('id').primaryKey(),
  chapterId: integer('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  topic: text('topic').notNull(),
  published: boolean('published').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('assessments_chapter_idx').on(t.chapterId)]);

export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  assessmentId: integer('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull(),
  text: text('text').notNull(),
  options: jsonb('options').$type<string[]>().notNull(),
  correctIndex: integer('correct_index').notNull(),
}, (t) => [index('questions_assessment_idx').on(t.assessmentId)]);

export const attempts = pgTable('attempts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assessmentId: integer('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
  answers: jsonb('answers').$type<(number | null)[]>().notNull(),
  score: integer('score').notNull(),
  total: integer('total').notNull(),
  durationSec: integer('duration_sec').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('attempts_user_idx').on(t.userId), index('attempts_assessment_idx').on(t.assessmentId)]);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

/** Uploaded files when FILE_STORAGE=db (hosts without a persistent disk). */
export const files = pgTable('files', {
  id: serial('id').primaryKey(),
  folder: text('folder').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  data: bytea('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Results of quizzes whose questions live in the frontend (public/quizzes/...). */
export const quizResults = pgTable('quiz_results', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  quizKey: text('quiz_key').notNull(),
  subjectSlug: text('subject_slug').notNull(),
  classLevel: text('class_level').notNull(),
  chapterNumber: integer('chapter_number').notNull(),
  chapterTitle: text('chapter_title').notNull().default(''),
  topic: text('topic').notNull(),
  answers: jsonb('answers').$type<(number | null)[]>().notNull(),
  score: integer('score').notNull(),
  total: integer('total').notNull(),
  durationSec: integer('duration_sec').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('quiz_results_user_idx').on(t.userId), index('quiz_results_key_idx').on(t.quizKey)]);

/** Time spent in the app: one row per visit, extended by heartbeats while the app is open on screen. */
export const appSessions = pgTable('app_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  activeSec: integer('active_sec').notNull().default(0),
  device: text('device').notNull().default(''),
}, (t) => [index('app_sessions_user_idx').on(t.userId, t.lastSeenAt)]);

/** Lectures a student has watched (or marked as watched). */
export const videoViews = pgTable('video_views', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  videoId: integer('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
  watchedAt: timestamp('watched_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('video_views_user_video_unique').on(t.userId, t.videoId)]);

/* ---------- Attendance (separate register; NOT linked to app accounts) ---------- */
export const attendanceStatusEnum = pgEnum('attendance_status', ['present', 'absent', 'leave']);

export const attendanceStudents = pgTable('attendance_students', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  nameKey: text('name_key').notNull(),
  groupName: text('group_name').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('attendance_students_name_key_unique').on(t.nameKey)]);

export const attendanceRecords = pgTable('attendance_records', {
  studentId: integer('student_id').notNull().references(() => attendanceStudents.id, { onDelete: 'cascade' }),
  date: date('date', { mode: 'string' }).notNull(),
  status: attendanceStatusEnum('status').notNull(),
}, (t) => [uniqueIndex('attendance_records_student_date_unique').on(t.studentId, t.date), index('attendance_records_date_idx').on(t.date)]);

export type User = typeof users.$inferSelect;
