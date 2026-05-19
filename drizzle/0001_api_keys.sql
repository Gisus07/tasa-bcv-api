CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" varchar(16) NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"purpose" text,
	"tier" varchar(16) DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"request_count" bigint DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash"),
	CONSTRAINT "api_keys_tier_check" CHECK ("api_keys"."tier" IN ('free', 'pro')),
	CONSTRAINT "api_keys_email_format" CHECK ("api_keys"."email" ~* '^[^@]+@[^@]+\.[^@]+$')
);
--> statement-breakpoint
CREATE INDEX "api_keys_email_idx" ON "api_keys" USING btree ("email");--> statement-breakpoint
CREATE INDEX "api_keys_active_idx" ON "api_keys" USING btree ("key_hash") WHERE "api_keys"."revoked_at" IS NULL;