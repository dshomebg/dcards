ALTER TABLE "scans" ALTER COLUMN "card_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "org_id" uuid;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scans_org_time_idx" ON "scans" USING btree ("org_id","scanned_at");--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_source_card" CHECK (("scans"."source" = 'nfc') = ("scans"."card_id" IS NOT NULL));--> statement-breakpoint
-- Ръчно добавен data backfill (ANL-2): старите nfc редове получават org-а на картата си.
-- Единственото ръчно SQL в миграция; drizzle-kit не генерира UPDATE.
UPDATE "scans" SET "org_id" = "cards"."org_id" FROM "cards" WHERE "cards"."id" = "scans"."card_id" AND "scans"."org_id" IS NULL;
