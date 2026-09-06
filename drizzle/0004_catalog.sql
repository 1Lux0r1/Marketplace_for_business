CREATE SCHEMA "catalog";
--> statement-breakpoint
CREATE TABLE "catalog"."categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	CONSTRAINT "categories_kind" CHECK ("catalog"."categories"."kind" in ('service','goods'))
);
--> statement-breakpoint
CREATE TABLE "catalog"."contractor_categories" (
	"contractor_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "contractor_categories_contractor_id_category_id_pk" PRIMARY KEY("contractor_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "catalog"."contractors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"status" text NOT NULL,
	"manual_rating" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contractors_status" CHECK ("catalog"."contractors"."status" in ('draft','active','paused','blocked')),
	CONSTRAINT "contractors_rating" CHECK ("catalog"."contractors"."manual_rating" is null or "catalog"."contractors"."manual_rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "catalog"."coverage_zones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"contractor_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "coverage_zones_kind" CHECK ("catalog"."coverage_zones"."kind" in ('district','city'))
);
--> statement-breakpoint
CREATE TABLE "catalog"."listing_zones" (
	"listing_id" uuid NOT NULL,
	"zone_code" text NOT NULL,
	CONSTRAINT "listing_zones_listing_id_zone_code_pk" PRIMARY KEY("listing_id","zone_code")
);
--> statement-breakpoint
CREATE TABLE "catalog"."listings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"contractor_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"unit" text NOT NULL,
	"price_kopecks" bigint NOT NULL,
	"min_qty" numeric(12, 3) DEFAULT '1' NOT NULL,
	"lead_time_hours" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"rejection_note" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listings_price" CHECK ("catalog"."listings"."price_kopecks" > 0),
	CONSTRAINT "listings_status" CHECK ("catalog"."listings"."status" in ('draft','pending','published','rejected','archived'))
);
--> statement-breakpoint
ALTER TABLE "catalog"."contractor_categories" ADD CONSTRAINT "contractor_categories_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "catalog"."contractors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."contractor_categories" ADD CONSTRAINT "contractor_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "catalog"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."coverage_zones" ADD CONSTRAINT "coverage_zones_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "catalog"."contractors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."listing_zones" ADD CONSTRAINT "listing_zones_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "catalog"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."listings" ADD CONSTRAINT "listings_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "catalog"."contractors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."listings" ADD CONSTRAINT "listings_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "catalog"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_code_key" ON "catalog"."categories" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "contractors_org_key" ON "catalog"."contractors" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "contractors_status_idx" ON "catalog"."contractors" USING btree ("status");--> statement-breakpoint
CREATE INDEX "coverage_zones_code_idx" ON "catalog"."coverage_zones" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "coverage_zones_unique" ON "catalog"."coverage_zones" USING btree ("contractor_id","code");--> statement-breakpoint
CREATE INDEX "listings_status_category_idx" ON "catalog"."listings" USING btree ("status","category_id");--> statement-breakpoint
CREATE INDEX "listings_contractor_idx" ON "catalog"."listings" USING btree ("contractor_id","status");--> statement-breakpoint
CREATE INDEX "listings_published_price_idx" ON "catalog"."listings" USING btree ("category_id","price_kopecks") WHERE "catalog"."listings"."status" = 'published';