CREATE TABLE "help_concern_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"attachment_required" boolean DEFAULT false NOT NULL,
	"sla_hours" integer,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "help_concern_policies_organization_id_code_unique" UNIQUE("organization_id","code"),
	CONSTRAINT "help_sla_positive" CHECK ("help_concern_policies"."sla_hours" between 1 and 8760)
);
--> statement-breakpoint
CREATE TABLE "help_ticket_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"notes" text NOT NULL,
	"before" jsonb,
	"after" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "help_ticket_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"ticket_id" uuid,
	"centre_id" uuid NOT NULL,
	"source_kind" text NOT NULL,
	"source_id" uuid NOT NULL,
	"uploaded_by" text NOT NULL,
	"name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"object_path" text NOT NULL,
	"verified_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "help_ticket_files_object_path_unique" UNIQUE("object_path"),
	CONSTRAINT "help_file_size" CHECK ("help_ticket_files"."size" between 1 and 10485760),
	CONSTRAINT "help_file_type" CHECK ("help_ticket_files"."content_type" in ('application/pdf','image/png','image/jpeg')),
	CONSTRAINT "help_file_claim" CHECK ("help_ticket_files"."ticket_id" is null or "help_ticket_files"."verified_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "help_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"number" text NOT NULL,
	"centre_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"lead_id" uuid,
	"project_id" uuid,
	"created_by" text NOT NULL,
	"assigned_to" text NOT NULL,
	"concern" text NOT NULL,
	"details" text NOT NULL,
	"priority" text NOT NULL,
	"status" text DEFAULT 'raised' NOT NULL,
	"attachment_required" boolean DEFAULT false NOT NULL,
	"due_at" timestamp with time zone,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"closed_by" text,
	"closed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"request_id" uuid NOT NULL,
	CONSTRAINT "help_tickets_number_unique" UNIQUE("number"),
	CONSTRAINT "help_tickets_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "help_tickets_id_organization_id_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "help_source_required" CHECK ("help_tickets"."lead_id" is not null or "help_tickets"."project_id" is not null),
	CONSTRAINT "help_status" CHECK ("help_tickets"."status" in ('raised','in_progress','awaiting_confirmation','reopened','closed')),
	CONSTRAINT "help_priority" CHECK ("help_tickets"."priority" in ('low','normal','high','urgent')),
	CONSTRAINT "help_resolution_evidence" CHECK (("help_tickets"."status" in ('awaiting_confirmation','closed')) = ("help_tickets"."resolved_at" is not null and "help_tickets"."resolved_by" is not null)),
	CONSTRAINT "help_closure_evidence" CHECK (("help_tickets"."status"='closed') = ("help_tickets"."closed_at" is not null and "help_tickets"."closed_by" is not null))
);
--> statement-breakpoint
ALTER TABLE "help_concern_policies" ADD CONSTRAINT "help_concern_policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_ticket_events" ADD CONSTRAINT "help_ticket_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_ticket_events" ADD CONSTRAINT "help_ticket_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_ticket_events" ADD CONSTRAINT "help_ticket_events_ticket_id_organization_id_help_tickets_id_organization_id_fk" FOREIGN KEY ("ticket_id","organization_id") REFERENCES "public"."help_tickets"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_ticket_files" ADD CONSTRAINT "help_ticket_files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_ticket_files" ADD CONSTRAINT "help_ticket_files_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_ticket_files" ADD CONSTRAINT "help_ticket_files_ticket_id_organization_id_help_tickets_id_organization_id_fk" FOREIGN KEY ("ticket_id","organization_id") REFERENCES "public"."help_tickets"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_ticket_files" ADD CONSTRAINT "help_ticket_files_centre_id_organization_id_centres_id_organization_id_fk" FOREIGN KEY ("centre_id","organization_id") REFERENCES "public"."centres"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_tickets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_tickets_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_tickets_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_tickets_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_tickets_closed_by_user_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_tickets_centre_id_organization_id_centres_id_organization_id_fk" FOREIGN KEY ("centre_id","organization_id") REFERENCES "public"."centres"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_tickets_customer_id_organization_id_customers_id_organization_id_fk" FOREIGN KEY ("customer_id","organization_id") REFERENCES "public"."customers"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_tickets_lead_id_organization_id_leads_id_organization_id_fk" FOREIGN KEY ("lead_id","organization_id") REFERENCES "public"."leads"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_tickets_project_id_organization_id_projects_id_organization_id_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "public"."projects"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "help_ticket_events_ticket_id_created_at_index" ON "help_ticket_events" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "help_ticket_files_ticket_id_index" ON "help_ticket_files" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "help_tickets_organization_id_centre_id_status_created_at_index" ON "help_tickets" USING btree ("organization_id","centre_id","status","created_at");--> statement-breakpoint
CREATE INDEX "help_tickets_assigned_to_status_due_at_index" ON "help_tickets" USING btree ("assigned_to","status","due_at");--> statement-breakpoint
CREATE INDEX "help_tickets_created_by_status_index" ON "help_tickets" USING btree ("created_by","status");