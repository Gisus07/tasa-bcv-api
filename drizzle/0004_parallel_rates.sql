CREATE TABLE "parallel_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"buy" numeric(18, 8) NOT NULL,
	"sell" numeric(18, 8) NOT NULL,
	"average" numeric(18, 8) NOT NULL,
	"source" varchar(16) DEFAULT 'binance_p2p' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "parallel_rates_timestamp_idx" ON "parallel_rates" USING btree ("timestamp" DESC NULLS LAST);