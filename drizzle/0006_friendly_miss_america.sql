CREATE SCHEMA "admin";
--> statement-breakpoint
CREATE TABLE "admin"."audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_name" text NOT NULL,
	"actor_role" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_label" text,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_log_recent_idx" ON "admin"."audit_log" USING btree ("created_at" desc);--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "admin"."audit_log" USING btree ("entity","entity_id","created_at" desc);--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "admin"."audit_log" USING btree ("actor_id","created_at" desc);