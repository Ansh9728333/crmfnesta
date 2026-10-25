CREATE TABLE "lead_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"changes" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"assigned_to" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"action" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"completion_notes" text,
	"created_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "centre_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "client_name" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "mobile" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "booking_month" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "financial_year" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "brand" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "cse_id" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "site_address" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "territory" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "soe" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "customer_type" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "building_type" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "order_type" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "finalised_value" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "order_qty" numeric(12, 3);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "pleated_mesh_qty" numeric(12, 3);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "material" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "discount_offered" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "priority" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "expected_value" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "next_follow_up" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "next_action" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "remarks" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "loss_reason" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "centre_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "assigned_to" text;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_organization_id_leads_id_organization_id_fk" FOREIGN KEY ("lead_id","organization_id") REFERENCES "public"."leads"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD CONSTRAINT "lead_follow_ups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD CONSTRAINT "lead_follow_ups_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD CONSTRAINT "lead_follow_ups_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD CONSTRAINT "lead_follow_ups_lead_id_organization_id_leads_id_organization_id_fk" FOREIGN KEY ("lead_id","organization_id") REFERENCES "public"."leads"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_activities_lead_id_created_at_index" ON "lead_activities" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "lead_follow_ups_lead_id_state_due_at_index" ON "lead_follow_ups" USING btree ("lead_id","state","due_at");--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_centre_id_centres_id_fk" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_cse_id_user_id_fk" FOREIGN KEY ("cse_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_centre_id_centres_id_fk" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;