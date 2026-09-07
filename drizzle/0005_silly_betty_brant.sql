CREATE TABLE "platform"."org_sites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"zone_code" text NOT NULL,
	"contact_name" text,
	"contact_phone" text,
	"note" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform"."org_sites" ADD CONSTRAINT "org_sites_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "platform"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "org_sites_org_idx" ON "platform"."org_sites" USING btree ("org_id","created_at") WHERE "platform"."org_sites"."archived_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "org_sites_name_key" ON "platform"."org_sites" USING btree ("org_id",lower("name")) WHERE "platform"."org_sites"."archived_at" is null;