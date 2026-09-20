CREATE TYPE "public"."card_status" AS ENUM('blank', 'written', 'assigned', 'active', 'disabled');--> statement-breakpoint
CREATE TABLE "card_batches" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"quantity" integer NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_id" uuid NOT NULL,
	"activation_code" text NOT NULL,
	"status" "card_status" DEFAULT 'blank' NOT NULL,
	"org_id" uuid,
	"profile_id" uuid,
	"written_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	CONSTRAINT "cards_id_format" CHECK ("cards"."id" ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6,8}$'),
	CONSTRAINT "cards_code_format" CHECK ("cards"."activation_code" ~ '^[0-9]{6}$')
);
--> statement-breakpoint
ALTER TABLE "card_batches" ADD CONSTRAINT "card_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_batch_id_card_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."card_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_status_idx" ON "cards" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cards_batch_idx" ON "cards" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "cards_org_idx" ON "cards" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "cards_profile_idx" ON "cards" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cards_batch_code_idx" ON "cards" USING btree ("batch_id","activation_code");