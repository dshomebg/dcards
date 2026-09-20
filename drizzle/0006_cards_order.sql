ALTER TABLE "cards" ADD COLUMN "order_id" uuid;--> statement-breakpoint
CREATE INDEX "cards_order_idx" ON "cards" USING btree ("order_id");