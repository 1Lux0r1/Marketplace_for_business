CREATE TABLE "platform"."outbox" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"aggregate" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "platform"."outbox" USING btree ("available_at","id") WHERE "platform"."outbox"."processed_at" is null;--> statement-breakpoint
CREATE INDEX "outbox_aggregate_idx" ON "platform"."outbox" USING btree ("aggregate","aggregate_id");--> statement-breakpoint
CREATE INDEX "outbox_type_idx" ON "platform"."outbox" USING btree ("type","occurred_at");