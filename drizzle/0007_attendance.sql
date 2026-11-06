-- Attendance register uploaded from Excel. Separate from app accounts.
DO $$ BEGIN
  CREATE TYPE "public"."attendance_status" AS ENUM('present', 'absent', 'leave');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attendance_students" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "name_key" text NOT NULL,
  "group_name" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_students_name_key_unique" ON "attendance_students" USING btree ("name_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attendance_records" (
  "student_id" integer NOT NULL REFERENCES "attendance_students"("id") ON DELETE cascade,
  "date" date NOT NULL,
  "status" "attendance_status" NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_records_student_date_unique" ON "attendance_records" USING btree ("student_id","date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_records_date_idx" ON "attendance_records" USING btree ("date");
