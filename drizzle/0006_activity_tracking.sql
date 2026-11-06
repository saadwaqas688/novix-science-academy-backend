-- Disabled accounts, time-on-app sessions, watched lectures. Also removes the old demo students
-- that the seed used to re-create on every restart.
ALTER TYPE "public"."user_status" ADD VALUE IF NOT EXISTS 'disabled';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "active_sec" integer DEFAULT 0 NOT NULL,
  "device" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_sessions_user_idx" ON "app_sessions" USING btree ("user_id","last_seen_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "video_views" (
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "video_id" integer NOT NULL REFERENCES "videos"("id") ON DELETE cascade,
  "watched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "video_views_user_video_unique" ON "video_views" USING btree ("user_id","video_id");
--> statement-breakpoint
DELETE FROM "users" WHERE "role" = 'student' AND "email" IN ('ayesha@student.pk','hamza@student.pk','bilal@student.pk','zainab@student.pk');
