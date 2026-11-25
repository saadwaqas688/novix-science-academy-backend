-- Per-user highlights on notes PDFs (positions are stored as fractions of the page size).
CREATE TABLE IF NOT EXISTS "note_highlights" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"file_url" text NOT NULL,
	"page" integer NOT NULL,
	"rects" jsonb NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"color" text DEFAULT 'yellow' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "note_highlights" ADD CONSTRAINT "note_highlights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_highlights_user_file_idx" ON "note_highlights" USING btree ("user_id","file_url");
