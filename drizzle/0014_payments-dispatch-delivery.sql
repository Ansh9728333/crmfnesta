CREATE TABLE "commerce_events" (
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
CREATE TABLE "commerce_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"payment_id" uuid,
	"dispatch_id" uuid,
	"delivery_id" uuid,
	"uploaded_by" text NOT NULL,
	"name" text NOT NULL,
	"object_path" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	CONSTRAINT "commerce_files_object_path_unique" UNIQUE("object_path")
);
--> statement-breakpoint
CREATE TABLE "delivery_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"delivery_id" uuid NOT NULL,
	"dispatch_item_id" uuid NOT NULL,
	"received" numeric(12, 3) NOT NULL,
	"damaged" numeric(12, 3) DEFAULT '0' NOT NULL,
	"missing" numeric(12, 3) DEFAULT '0' NOT NULL,
	CONSTRAINT "delivery_items_delivery_id_dispatch_item_id_unique" UNIQUE("delivery_id","dispatch_item_id")
);
--> statement-breakpoint
CREATE TABLE "dispatch_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"dispatch_id" uuid NOT NULL,
	"load_item_id" uuid NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"delivered_quantity" numeric(12, 3) DEFAULT '0' NOT NULL,
	CONSTRAINT "dispatch_items_id_organization_id_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "dispatch_items_dispatch_id_load_item_id_unique" UNIQUE("dispatch_id","load_item_id"),
	CONSTRAINT "dispatch_items_id_dispatch_id_organization_id_unique" UNIQUE("id","dispatch_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"milestone_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"allocated_by" text NOT NULL,
	CONSTRAINT "payment_allocations_payment_id_milestone_id_unique" UNIQUE("payment_id","milestone_id")
);
--> statement-breakpoint
CREATE TABLE "payment_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"load_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"allocated_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"due_at" timestamp with time zone,
	"before_dispatch" boolean DEFAULT true NOT NULL,
	"contract_reference" text NOT NULL,
	"notes" text NOT NULL,
	"configured_by" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "payment_milestones_id_order_id_organization_id_unique" UNIQUE("id","order_id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payment_positive";--> statement-breakpoint
ALTER TABLE "deliveries" DROP CONSTRAINT "deliveries_dispatch_id_organization_id_dispatches_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "order_id" uuid;
UPDATE dispatches d SET order_id=l.order_id FROM production_loads l WHERE l.id=d.load_id;
ALTER TABLE dispatches ALTER COLUMN order_id SET NOT NULL;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "order_id" uuid;
UPDATE deliveries d SET order_id=s.order_id FROM dispatches s WHERE s.id=d.dispatch_id;
ALTER TABLE deliveries ALTER COLUMN order_id SET NOT NULL;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "remarks" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "confirmed_by" text;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "transporter" text;--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "vehicle_number" text;--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "expected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "recorded_payment_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "mode" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "recorded_by" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "verified_by" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "allocated_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "production_load_items" ADD COLUMN "dispatched_quantity" numeric(12, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_id_order_id_organization_id_unique" UNIQUE("id","order_id","organization_id");--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_id_organization_id_unique" UNIQUE("id","organization_id");--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_id_order_id_organization_id_unique" UNIQUE("id","order_id","organization_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_id_order_id_organization_id_unique" UNIQUE("id","order_id","organization_id");--> statement-breakpoint
ALTER TABLE "production_load_items" ADD CONSTRAINT "production_load_items_id_organization_id_unique" UNIQUE("id","organization_id");--> statement-breakpoint
ALTER TABLE "production_load_items" ADD CONSTRAINT "production_load_items_id_load_id_organization_id_unique" UNIQUE("id","load_id","organization_id");--> statement-breakpoint
ALTER TABLE "commerce_events" ADD CONSTRAINT "commerce_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_events" ADD CONSTRAINT "commerce_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_events" ADD CONSTRAINT "commerce_events_order_id_organization_id_orders_id_organization_id_fk" FOREIGN KEY ("order_id","organization_id") REFERENCES "public"."orders"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_files" ADD CONSTRAINT "commerce_files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_files" ADD CONSTRAINT "commerce_files_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_files" ADD CONSTRAINT "commerce_files_payment_id_order_id_organization_id_payments_id_order_id_organization_id_fk" FOREIGN KEY ("payment_id","order_id","organization_id") REFERENCES "public"."payments"("id","order_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_files" ADD CONSTRAINT "commerce_files_dispatch_id_order_id_organization_id_dispatches_id_order_id_organization_id_fk" FOREIGN KEY ("dispatch_id","order_id","organization_id") REFERENCES "public"."dispatches"("id","order_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_files" ADD CONSTRAINT "commerce_files_delivery_id_order_id_organization_id_deliveries_id_order_id_organization_id_fk" FOREIGN KEY ("delivery_id","order_id","organization_id") REFERENCES "public"."deliveries"("id","order_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_delivery_id_organization_id_deliveries_id_organization_id_fk" FOREIGN KEY ("delivery_id","organization_id") REFERENCES "public"."deliveries"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_dispatch_item_id_organization_id_dispatch_items_id_organization_id_fk" FOREIGN KEY ("dispatch_item_id","organization_id") REFERENCES "public"."dispatch_items"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_items" ADD CONSTRAINT "dispatch_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_items" ADD CONSTRAINT "dispatch_items_dispatch_id_organization_id_dispatches_id_organization_id_fk" FOREIGN KEY ("dispatch_id","organization_id") REFERENCES "public"."dispatches"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_items" ADD CONSTRAINT "dispatch_items_load_item_id_organization_id_production_load_items_id_organization_id_fk" FOREIGN KEY ("load_item_id","organization_id") REFERENCES "public"."production_load_items"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_allocated_by_user_id_fk" FOREIGN KEY ("allocated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_order_id_organization_id_payments_id_order_id_organization_id_fk" FOREIGN KEY ("payment_id","order_id","organization_id") REFERENCES "public"."payments"("id","order_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_milestone_id_order_id_organization_id_payment_milestones_id_order_id_organization_id_fk" FOREIGN KEY ("milestone_id","order_id","organization_id") REFERENCES "public"."payment_milestones"("id","order_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_milestones" ADD CONSTRAINT "payment_milestones_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_milestones" ADD CONSTRAINT "payment_milestones_configured_by_user_id_fk" FOREIGN KEY ("configured_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_milestones" ADD CONSTRAINT "payment_milestones_order_id_organization_id_orders_id_organization_id_fk" FOREIGN KEY ("order_id","organization_id") REFERENCES "public"."orders"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_milestones" ADD CONSTRAINT "payment_milestones_load_id_organization_id_production_loads_id_organization_id_fk" FOREIGN KEY ("load_id","organization_id") REFERENCES "public"."production_loads"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_confirmed_by_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_dispatch_id_order_id_organization_id_dispatches_id_order_id_organization_id_fk" FOREIGN KEY ("dispatch_id","order_id","organization_id") REFERENCES "public"."dispatches"("id","order_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_order_id_organization_id_orders_id_organization_id_fk" FOREIGN KEY ("order_id","organization_id") REFERENCES "public"."orders"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_verified_by_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payment_positive" CHECK ("payments"."amount">0);