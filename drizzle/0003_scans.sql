CREATE TYPE "public"."scan_device" AS ENUM('ios', 'android', 'other');--> statement-breakpoint
CREATE TYPE "public"."scan_source" AS ENUM('nfc', 'qr', 'direct');--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"card_id" text NOT NULL,
	"profile_id" uuid,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "scan_source" NOT NULL,
	"device" "scan_device" NOT NULL,
	"country" text,
	CONSTRAINT "scans_country_format" CHECK ("scans"."country" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scans_card_time_idx" ON "scans" USING btree ("card_id","scanned_at");--> statement-breakpoint
CREATE INDEX "scans_profile_time_idx" ON "scans" USING btree ("profile_id","scanned_at");