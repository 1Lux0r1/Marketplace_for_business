CREATE SCHEMA "documents";
--> statement-breakpoint
CREATE TABLE "documents"."counters" (
	"kind" text NOT NULL,
	"year" integer NOT NULL,
	"next" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "counters_kind" CHECK ("documents"."counters"."kind" in ('contract','invoice','act'))
);
--> statement-breakpoint
CREATE TABLE "documents"."documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"kind" text NOT NULL,
	"deal_id" uuid NOT NULL,
	"client_org_id" uuid NOT NULL,
	"contractor_id" uuid,
	"status" text DEFAULT 'issued' NOT NULL,
	"signing_path" text NOT NULL,
	"amount_kopecks" bigint,
	"data" jsonb NOT NULL,
	"html" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"signed_at" timestamp with time zone,
	"signed_by" uuid,
	"signature" jsonb,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	CONSTRAINT "documents_kind" CHECK ("documents"."documents"."kind" in ('contract','invoice','act')),
	CONSTRAINT "documents_status" CHECK ("documents"."documents"."status" in ('issued','signed','void')),
	CONSTRAINT "documents_path" CHECK ("documents"."documents"."signing_path" in ('electronic','paper')),
	CONSTRAINT "documents_amount" CHECK ("documents"."documents"."amount_kopecks" is null or "documents"."documents"."amount_kopecks" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "counters_key" ON "documents"."counters" USING btree ("kind","year");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_number_key" ON "documents"."documents" USING btree ("number");--> statement-breakpoint
CREATE INDEX "documents_deal_idx" ON "documents"."documents" USING btree ("deal_id","issued_at");--> statement-breakpoint
CREATE INDEX "documents_client_idx" ON "documents"."documents" USING btree ("client_org_id","issued_at" desc);