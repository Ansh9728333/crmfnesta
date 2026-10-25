CREATE TABLE "order_stage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_id" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"before" jsonb,
	"after" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_stage_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"owner_role" "employee_role" NOT NULL,
	"approver_role" "employee_role" NOT NULL,
	"required_fields" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"changed_by" text NOT NULL,
	CONSTRAINT "order_stage_policies_organization_id_number_unique" UNIQUE("organization_id","number"),
	CONSTRAINT "policy_stage_range" CHECK ("order_stage_policies"."number" between 1 and 16)
);
--> statement-breakpoint
CREATE TABLE "order_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"owner_role" "employee_role" NOT NULL,
	"approver_role" "employee_role" NOT NULL,
	"required_fields" jsonb NOT NULL,
	"assigned_to" text,
	"planned_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"submitted_by" text,
	"completed_at" timestamp with time zone,
	"approved_by" text,
	"notes" text DEFAULT '' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "order_stages_order_id_number_unique" UNIQUE("order_id","number"),
	CONSTRAINT "order_stages_order_id_number_organization_id_unique" UNIQUE("order_id","number","organization_id"),
	CONSTRAINT "order_stages_id_order_id_organization_id_unique" UNIQUE("id","order_id","organization_id"),
	CONSTRAINT "order_stage_number" CHECK ("order_stages"."number" between 1 and 16)
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "stage_number" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_stage_events" ADD CONSTRAINT "order_stage_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stage_events" ADD CONSTRAINT "order_stage_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stage_events" ADD CONSTRAINT "order_stage_events_stage_id_order_id_organization_id_order_stages_id_order_id_organization_id_fk" FOREIGN KEY ("stage_id","order_id","organization_id") REFERENCES "public"."order_stages"("id","order_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stage_policies" ADD CONSTRAINT "order_stage_policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stage_policies" ADD CONSTRAINT "order_stage_policies_changed_by_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stages" ADD CONSTRAINT "order_stages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stages" ADD CONSTRAINT "order_stages_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stages" ADD CONSTRAINT "order_stages_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stages" ADD CONSTRAINT "order_stages_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stages" ADD CONSTRAINT "order_stages_order_id_organization_id_orders_id_organization_id_fk" FOREIGN KEY ("order_id","organization_id") REFERENCES "public"."orders"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_stage_events_order_id_created_at_index" ON "order_stage_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_stages_assigned_to_status_planned_at_index" ON "order_stages" USING btree ("assigned_to","status","planned_at");