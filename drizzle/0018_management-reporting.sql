CREATE TABLE "admin_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"config" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"changed_by" text NOT NULL,
	CONSTRAINT "admin_catalog_id_organization_id_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "admin_catalog_organization_id_kind_code_unique" UNIQUE("organization_id","kind","code")
);
--> statement-breakpoint
CREATE TABLE "notification_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"state" text NOT NULL,
	CONSTRAINT "notification_receipts_user_id_kind_entity_id_unique" UNIQUE("user_id","kind","entity_id")
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "requirement_id" uuid;--> statement-breakpoint
ALTER TABLE "admin_catalog" ADD CONSTRAINT "admin_catalog_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_catalog" ADD CONSTRAINT "admin_catalog_changed_by_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_receipts" ADD CONSTRAINT "notification_receipts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_receipts" ADD CONSTRAINT "notification_receipts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_catalog_organization_id_kind_active_index" ON "admin_catalog" USING btree ("organization_id","kind","active");--> statement-breakpoint
CREATE INDEX "notification_receipts_user_id_state_index" ON "notification_receipts" USING btree ("user_id","state");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_requirement_id_organization_id_admin_catalog_id_organization_id_fk" FOREIGN KEY ("requirement_id","organization_id") REFERENCES "public"."admin_catalog"("id","organization_id") ON DELETE no action ON UPDATE no action;