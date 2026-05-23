DROP INDEX "api_key_usage_daily_key_idx";--> statement-breakpoint
DROP INDEX "rates_date_idx";--> statement-breakpoint
ALTER TABLE "api_key_usage_daily" ADD CONSTRAINT "api_key_usage_daily_key_id_api_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;