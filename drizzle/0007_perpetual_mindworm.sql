CREATE SCHEMA "intake";
--> statement-breakpoint
CREATE SEQUENCE "intake"."request_number" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1;--> statement-breakpoint
CREATE TABLE "intake"."request_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake"."requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"number" bigint DEFAULT nextval('intake.request_number') NOT NULL,
	"client_org_id" uuid NOT NULL,
	"created_by" uuid,
	"site_id" uuid,
	"source" text NOT NULL,
	"raw_text" text,
	"category_id" uuid,
	"urgency" text DEFAULT 'normal' NOT NULL,
	"address" text,
	"zone_code" text,
	"contact_name" text,
	"contact_phone" text,
	"desired_at" timestamp with time zone,
	"status" text DEFAULT 'new' NOT NULL,
	"parse_source" text,
	"parse_meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requests_source" CHECK ("intake"."requests"."source" in ('web','telegram','operator')),
	CONSTRAINT "requests_urgency" CHECK ("intake"."requests"."urgency" in ('normal','urgent','planned')),
	CONSTRAINT "requests_status" CHECK ("intake"."requests"."status" in ('new','parsed','converted','rejected')),
	CONSTRAINT "requests_parse_source" CHECK ("intake"."requests"."parse_source" is null or "intake"."requests"."parse_source" in ('ai','rules','operator'))
);
--> statement-breakpoint
ALTER TABLE "intake"."request_events" ADD CONSTRAINT "request_events_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "intake"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "request_events_idx" ON "intake"."request_events" USING btree ("request_id","id");--> statement-breakpoint
CREATE INDEX "requests_queue_idx" ON "intake"."requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "requests_client_idx" ON "intake"."requests" USING btree ("client_org_id","created_at" desc);