CREATE SCHEMA "notifications";
--> statement-breakpoint
CREATE TABLE "notifications"."messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"address" text NOT NULL,
	"template" text NOT NULL,
	"subject" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"context_id" uuid,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "messages_address_idx" ON "notifications"."messages" USING btree ("address","created_at");--> statement-breakpoint
CREATE INDEX "messages_context_idx" ON "notifications"."messages" USING btree ("context_id") WHERE "notifications"."messages"."context_id" is not null;--> statement-breakpoint
CREATE INDEX "messages_failed_idx" ON "notifications"."messages" USING btree ("created_at") WHERE "notifications"."messages"."status" = 'failed';