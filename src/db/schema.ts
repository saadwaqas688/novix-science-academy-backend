import {
  pgTable, pgEnum, serial, integer, text, timestamp, boolean, jsonb, uniqueIndex, index,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['student', 'admin']);
export const userStatusEnum = pgEnum('user_status', ['pending', 'approved', 'rejected']);

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

export type User = typeof users.$inferSelect;
