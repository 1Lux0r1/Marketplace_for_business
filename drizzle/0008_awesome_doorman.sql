CREATE SCHEMA "deal";
--> statement-breakpoint
CREATE SEQUENCE "deal"."deal_number" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1;--> statement-breakpoint
CREATE TABLE "deal"."deal_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor_id" uuid,
	"actor_name" text,
	"reason" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal"."deals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"number" bigint DEFAULT nextval('deal.deal_number') NOT NULL,
	"source" text NOT NULL,
	"client_org_id" uuid NOT NULL,
	"contractor_id" uuid,
	"listing_id" uuid,
	"request_id" uuid,
	"site_id" uuid,
	"status" text DEFAULT 'new' NOT NULL,
	"price_kopecks" bigint,
	"qty" numeric,
	"unit" text,
	"title" text,
	"commission_rate" numeric,
	"commission_reason" text,
	"commission_kopecks" bigint,
	"rated_at" timestamp with time zone,
	"address" text,
	"zone_code" text,
	"scheduled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deals_source" CHECK ("deal"."deals"."source" in ('catalog','request')),
	CONSTRAINT "deals_status" CHECK ("deal"."deals"."status" in ('new','matching','quoted','accepted','paid','in_progress','act_issued','act_signed','completed','disputed','cancelled')),
	CONSTRAINT "deals_price" CHECK ("deal"."deals"."price_kopecks" is null or "deal"."deals"."price_kopecks" >= 0),
	CONSTRAINT "deals_commission" CHECK ("deal"."deals"."commission_kopecks" is null or "deal"."deals"."commission_kopecks" >= 0),
	CONSTRAINT "deals_origin" CHECK (("deal"."deals"."source" = 'catalog' and "deal"."deals"."listing_id" is not null)
          or ("deal"."deals"."source" = 'request' and "deal"."deals"."request_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "deal"."deal_events" ADD CONSTRAINT "deal_events_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "deal"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_events_idx" ON "deal"."deal_events" USING btree ("deal_id","id");--> statement-breakpoint
CREATE INDEX "deals_client_idx" ON "deal"."deals" USING btree ("client_org_id","created_at" desc);--> statement-breakpoint
CREATE INDEX "deals_contractor_idx" ON "deal"."deals" USING btree ("contractor_id","created_at" desc);--> statement-breakpoint
CREATE INDEX "deals_queue_idx" ON "deal"."deals" USING btree ("status","status_at");