CREATE TABLE "aftercare_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"notes" text NOT NULL,
	"before" jsonb,
	"after" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aftercare_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"installation_id" uuid,
	"audit_id" uuid,
	"handover_id" uuid,
	"ticket_id" uuid,
	"kind" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"name" text NOT NULL,
	"object_path" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	CONSTRAINT "aftercare_files_object_path_unique" UNIQUE("object_path")
);
--> statement-breakpoint
CREATE TABLE "audit_punch_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"audit_id" uuid NOT NULL,
	"description" text NOT NULL,
	"assigned_to" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"google_requested_at" timestamp with time zone,
	"testimonial_requested_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"received_at" timestamp with time zone,
	"comments" text DEFAULT '' NOT NULL,
	"testimonial" text,
	"review_url" text,
	"rating" integer,
	"publication_consent" boolean DEFAULT false NOT NULL,
	"recorded_by" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "customer_feedback_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "installation_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"installation_id" uuid NOT NULL,
	"load_item_id" uuid NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_by" text NOT NULL,
	"remarks" text NOT NULL,
	"request_id" uuid NOT NULL,
	CONSTRAINT "installation_entries_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
ALTER TABLE "engineer_audits" ADD COLUMN "installation_id" uuid;--> statement-breakpoint
ALTER TABLE "engineer_audits" ADD COLUMN "planned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "engineer_audits" ADD COLUMN "inspection_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "engineer_audits" ADD COLUMN "status" text DEFAULT 'planned' NOT NULL;--> statement-breakpoint
ALTER TABLE "engineer_audits" ADD COLUMN "checklist" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "engineer_audits" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "engineer_audits" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "handovers" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "handovers" ADD COLUMN "customer_accepted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "handovers" ADD COLUMN "customer_representative" text;--> statement-breakpoint
ALTER TABLE "handovers" ADD COLUMN "acceptance_reference" text;--> statement-breakpoint
ALTER TABLE "handovers" ADD COLUMN "confirmed_by" text;--> statement-breakpoint
ALTER TABLE "handovers" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "handovers" ADD COLUMN "notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "handovers" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "installations" ADD COLUMN "load_id" uuid;--> statement-breakpoint
ALTER TABLE "installations" ADD COLUMN "team_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "installations" ADD COLUMN "team_members" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "installations" ADD COLUMN "planned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "installations" ADD COLUMN "status" text DEFAULT 'planned' NOT NULL;--> statement-breakpoint
ALTER TABLE "installations" ADD COLUMN "remarks" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "installations" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "installations" ADD COLUMN "completed_by" text;--> statement-breakpoint
ALTER TABLE "production_load_items" ADD COLUMN "installed_quantity" numeric(12, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "title" text DEFAULT 'Service request' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "kind" text DEFAULT 'service' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "priority" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "resolution" text;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "resolved_by" text;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sgrip_glass_checklists" ADD COLUMN "dimensions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sgrip_glass_checklists" ADD COLUMN "responsible_id" text;--> statement-breakpoint
ALTER TABLE "sgrip_glass_checklists" ADD COLUMN "measured_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sgrip_glass_checklists" ADD COLUMN "prepared_by" text;--> statement-breakpoint
ALTER TABLE "sgrip_glass_checklists" ADD COLUMN "prepared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sgrip_glass_checklists" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "sgrip_glass_checklists" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sgrip_glass_checklists" ADD COLUMN "notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sgrip_glass_checklists" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "engineer_audits" ADD CONSTRAINT "engineer_audits_id_organization_id_unique" UNIQUE("id","organization_id");--> statement-breakpoint
ALTER TABLE "engineer_audits" ADD CONSTRAINT "engineer_audits_id_order_id_organization_id_unique" UNIQUE("id","order_id","organization_id");--> statement-breakpoint
ALTER TABLE "engineer_audits" ADD CONSTRAINT "engineer_audits_installation_id_unique" UNIQUE("installation_id");--> statement-breakpoint
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_order_id_unique" UNIQUE("order_id");--> statement-breakpoint
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_id_order_id_organization_id_unique" UNIQUE("id","order_id","organization_id");--> statement-breakpoint
ALTER TABLE "installations" ADD CONSTRAINT "installations_id_order_id_organization_id_unique" UNIQUE("id","order_id","organization_id");--> statement-breakpoint
ALTER TABLE "installations" ADD CONSTRAINT "installations_load_id_unique" UNIQUE("load_id");--> statement-breakpoint
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_id_order_id_organization_id_unique" UNIQUE("id","order_id","organization_id");
--> statement-breakpoint
ALTER TABLE "aftercare_events" ADD CONSTRAINT "aftercare_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aftercare_events" ADD CONSTRAINT "aftercare_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aftercare_events" ADD CONSTRAINT "aftercare_events_order_id_organization_id_orders_id_organization_id_fk" FOREIGN KEY ("order_id","organization_id") REFERENCES "public"."orders"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aftercare_files" ADD CONSTRAINT "aftercare_files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aftercare_files" ADD CONSTRAINT "aftercare_files_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aftercare_files" ADD CONSTRAINT "aftercare_files_installation_id_order_id_organization_id_installations_id_order_id_organization_id_fk" FOREIGN KEY ("installation_id","order_id","organization_id") REFERENCES "public"."installations"("id","order_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aftercare_files" ADD CONSTRAINT "aftercare_files_audit_id_order_id_organization_id_engineer_audits_id_order_id_organization_id_fk" FOREIGN KEY ("audit_id","order_id","organization_id") REFERENCES "public"."engineer_audits"("id","order_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aftercare_files" ADD CONSTRAINT "aftercare_files_handover_id_order_id_organization_id_handovers_id_order_id_organization_id_fk" FOREIGN KEY ("handover_id","order_id","organization_id") REFERENCES "public"."handovers"("id","order_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aftercare_files" ADD CONSTRAINT "aftercare_files_ticket_id_order_id_organization_id_service_tickets_id_order_id_organization_id_fk" FOREIGN KEY ("ticket_id","order_id","organization_id") REFERENCES "public"."service_tickets"("id","order_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_punch_items" ADD CONSTRAINT "audit_punch_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_punch_items" ADD CONSTRAINT "audit_punch_items_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_punch_items" ADD CONSTRAINT "audit_punch_items_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_punch_items" ADD CONSTRAINT "audit_punch_items_audit_id_order_id_organization_id_engineer_audits_id_order_id_organization_id_fk" FOREIGN KEY ("audit_id","order_id","organization_id") REFERENCES "public"."engineer_audits"("id","order_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_feedback" ADD CONSTRAINT "customer_feedback_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_feedback" ADD CONSTRAINT "customer_feedback_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_feedback" ADD CONSTRAINT "customer_feedback_order_id_organization_id_orders_id_organization_id_fk" FOREIGN KEY ("order_id","organization_id") REFERENCES "public"."orders"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installation_entries" ADD CONSTRAINT "installation_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installation_entries" ADD CONSTRAINT "installation_entries_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installation_entries" ADD CONSTRAINT "installation_entries_installation_id_order_id_organization_id_installations_id_order_id_organization_id_fk" FOREIGN KEY ("installation_id","order_id","organization_id") REFERENCES "public"."installations"("id","order_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installation_entries" ADD CONSTRAINT "installation_entries_load_item_id_organization_id_production_load_items_id_organization_id_fk" FOREIGN KEY ("load_item_id","organization_id") REFERENCES "public"."production_load_items"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineer_audits" ADD CONSTRAINT "engineer_audits_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineer_audits" ADD CONSTRAINT "engineer_audits_installation_id_order_id_organization_id_installations_id_order_id_organization_id_fk" FOREIGN KEY ("installation_id","order_id","organization_id") REFERENCES "public"."installations"("id","order_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_confirmed_by_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installations" ADD CONSTRAINT "installations_completed_by_user_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installations" ADD CONSTRAINT "installations_load_id_organization_id_production_loads_id_organization_id_fk" FOREIGN KEY ("load_id","organization_id") REFERENCES "public"."production_loads"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sgrip_glass_checklists" ADD CONSTRAINT "sgrip_glass_checklists_responsible_id_user_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sgrip_glass_checklists" ADD CONSTRAINT "sgrip_glass_checklists_prepared_by_user_id_fk" FOREIGN KEY ("prepared_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sgrip_glass_checklists" ADD CONSTRAINT "sgrip_glass_checklists_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE sgrip_glass_checklists ADD COLUMN template_file_id uuid;
