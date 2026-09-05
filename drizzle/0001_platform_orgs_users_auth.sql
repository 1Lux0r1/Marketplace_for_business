CREATE TABLE "platform"."credentials" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"secret_hash" text,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "credentials_kind" CHECK ("platform"."credentials"."kind" in ('password','email_link'))
);
--> statement-breakpoint
CREATE TABLE "platform"."login_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"ip" "inet",
	"method" text NOT NULL,
	"succeeded" boolean NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "login_attempts_method" CHECK ("platform"."login_attempts"."method" in ('password','email_link','code'))
);
--> statement-breakpoint
CREATE TABLE "platform"."login_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"purpose" text DEFAULT 'login' NOT NULL,
	"token_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "login_tokens_purpose" CHECK ("platform"."login_tokens"."purpose" in ('login','verify_email','set_password','reset_password'))
);
--> statement-breakpoint
CREATE TABLE "platform"."orgs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"legal_form" text NOT NULL,
	"is_client" boolean DEFAULT true NOT NULL,
	"is_contractor" boolean DEFAULT false NOT NULL,
	"is_platform" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"inn" text,
	"kpp" text,
	"legal_address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"inn_verified_at" timestamp with time zone,
	"inn_verification" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orgs_legal_form" CHECK ("platform"."orgs"."legal_form" in ('individual','sole_trader','company'))
);
--> statement-breakpoint
CREATE TABLE "platform"."sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"phone" text NOT NULL,
	"phone_verified_at" timestamp with time zone,
	"full_name" text NOT NULL,
	"position" text,
	"position_checked_at" timestamp with time zone,
	"position_check" jsonb,
	"role" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_role" CHECK ("platform"."users"."role" in ('owner','staff','operator','admin'))
);
--> statement-breakpoint
ALTER TABLE "platform"."credentials" ADD CONSTRAINT "credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform"."users" ADD CONSTRAINT "users_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "platform"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credentials_user_kind_key" ON "platform"."credentials" USING btree ("user_id","kind") WHERE "platform"."credentials"."is_active";--> statement-breakpoint
CREATE INDEX "login_attempts_email_idx" ON "platform"."login_attempts" USING btree (lower("email"),"at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "login_attempts_ip_idx" ON "platform"."login_attempts" USING btree ("ip","at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "login_tokens_hash_key" ON "platform"."login_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "login_tokens_email_idx" ON "platform"."login_tokens" USING btree (lower("email"),"purpose","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orgs_client_idx" ON "platform"."orgs" USING btree ("is_active") WHERE "platform"."orgs"."is_client";--> statement-breakpoint
CREATE INDEX "orgs_contractor_idx" ON "platform"."orgs" USING btree ("is_active") WHERE "platform"."orgs"."is_contractor";--> statement-breakpoint
CREATE UNIQUE INDEX "orgs_inn_key" ON "platform"."orgs" USING btree ("inn") WHERE "platform"."orgs"."inn" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "orgs_single_platform" ON "platform"."orgs" USING btree ("is_platform") WHERE "platform"."orgs"."is_platform";--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_hash_key" ON "platform"."sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "platform"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "platform"."users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_key" ON "platform"."users" USING btree ("phone") WHERE "platform"."users"."phone_verified_at" is not null;--> statement-breakpoint
CREATE INDEX "users_org_idx" ON "platform"."users" USING btree ("org_id");