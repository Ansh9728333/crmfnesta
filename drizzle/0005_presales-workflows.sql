CREATE TABLE "presales_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"appointment_id" uuid,
	"name" text NOT NULL,
	"object_path" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"uploaded_by" text NOT NULL,
	CONSTRAINT "presales_attachments_object_path_unique" UNIQUE("object_path")
);
--> statement-breakpoint
CREATE TABLE "quotation_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"quotation_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"evidence" text NOT NULL,
	"actor_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_engagements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"outcome" text NOT NULL,
	"not_required" boolean DEFAULT false NOT NULL,
	"reason" text,
	"notes" text NOT NULL,
	"offered_value" numeric(14, 2),
	"actor_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "status" text DEFAULT 'scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "observations" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "measurements" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "unit_price" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "amount" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "quotation_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "final_value" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "final_quantity" numeric(14, 3);--> statement-breakpoint
ALTER TABLE "quotation_items" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD COLUMN "product_company_id" uuid;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD COLUMN "discount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD COLUMN "subtotal" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "quotation_items" ADD COLUMN "amount" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "subtotal" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "discount" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "customer_notes" text;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "revision_reason" text;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "presales_attachments" ADD CONSTRAINT "presales_attachments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presales_attachments" ADD CONSTRAINT "presales_attachments_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presales_attachments" ADD CONSTRAINT "presales_attachments_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presales_attachments" ADD CONSTRAINT "presales_attachments_lead_id_organization_id_leads_id_organization_id_fk" FOREIGN KEY ("lead_id","organization_id") REFERENCES "public"."leads"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_decisions" ADD CONSTRAINT "quotation_decisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_decisions" ADD CONSTRAINT "quotation_decisions_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_decisions" ADD CONSTRAINT "quotation_decisions_quotation_id_organization_id_quotations_id_organization_id_fk" FOREIGN KEY ("quotation_id","organization_id") REFERENCES "public"."quotations"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_engagements" ADD CONSTRAINT "sales_engagements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_engagements" ADD CONSTRAINT "sales_engagements_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_engagements" ADD CONSTRAINT "sales_engagements_lead_id_organization_id_leads_id_organization_id_fk" FOREIGN KEY ("lead_id","organization_id") REFERENCES "public"."leads"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "presales_attachments_lead_id_created_at_index" ON "presales_attachments" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "quotation_decisions_quotation_id_created_at_index" ON "quotation_decisions" USING btree ("quotation_id","created_at");--> statement-breakpoint
CREATE INDEX "sales_engagements_lead_id_created_at_index" ON "sales_engagements" USING btree ("lead_id","created_at");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_project_id_organization_id_projects_id_organization_id_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "public"."projects"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_quotation_id_organization_id_quotations_id_organization_id_fk" FOREIGN KEY ("quotation_id","organization_id") REFERENCES "public"."quotations"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_product_company_id_organizations_id_fk" FOREIGN KEY ("product_company_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;