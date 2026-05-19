CREATE TABLE "api_key_usage_daily" (
	"key_id" integer NOT NULL,
	"date" date NOT NULL,
	"count" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "api_key_usage_daily_key_id_date_pk" PRIMARY KEY("key_id","date")
);
--> statement-breakpoint
CREATE INDEX "api_key_usage_daily_key_idx" ON "api_key_usage_daily" USING btree ("key_id","date" DESC NULLS LAST);