CREATE TABLE "interventions" (
	"date" date PRIMARY KEY NOT NULL,
	"intervention_number" varchar(16) NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	"source" varchar(16) DEFAULT 'bcv' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interventions_rate_positive" CHECK ("interventions"."rate" > 0)
);
--> statement-breakpoint
CREATE INDEX "interventions_date_idx" ON "interventions" USING btree ("date" DESC NULLS LAST);