CREATE TABLE "ingest_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_type" varchar(16) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" varchar(16) NOT NULL,
	"rows_upserted" integer DEFAULT 0 NOT NULL,
	"files_fetched" integer DEFAULT 0 NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "rates" (
	"date" date NOT NULL,
	"currency" varchar(3) NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	"source" varchar(8) DEFAULT 'BCV' NOT NULL,
	"source_file" text NOT NULL,
	"published_at" date,
	"is_propagated" boolean DEFAULT false NOT NULL,
	"propagated_from" date,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rates_date_currency_pk" PRIMARY KEY("date","currency"),
	CONSTRAINT "rates_currency_check" CHECK ("rates"."currency" IN ('USD', 'EUR')),
	CONSTRAINT "rates_rate_positive" CHECK ("rates"."rate" > 0)
);
--> statement-breakpoint
CREATE INDEX "rates_date_idx" ON "rates" USING btree ("date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "rates_currency_date_idx" ON "rates" USING btree ("currency","date" DESC NULLS LAST);