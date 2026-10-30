CREATE TABLE "quiz_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"quiz_key" text NOT NULL,
	"subject_slug" text NOT NULL,
	"class_level" text NOT NULL,
	"chapter_number" integer NOT NULL,
	"chapter_title" text DEFAULT '' NOT NULL,
	"topic" text NOT NULL,
	"answers" jsonb NOT NULL,
	"score" integer NOT NULL,
	"total" integer NOT NULL,
	"duration_sec" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quiz_results" ADD CONSTRAINT "quiz_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quiz_results_user_idx" ON "quiz_results" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "quiz_results_key_idx" ON "quiz_results" USING btree ("quiz_key");