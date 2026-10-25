CREATE TABLE "production_load_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"load_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"notes" text NOT NULL,
	"before" jsonb,
	"after" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "production_loads" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "production_loads" ADD COLUMN "site_ready" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "production_loads" ADD COLUMN "data" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "production_loads" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "production_load_events" ADD CONSTRAINT "production_load_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_load_events" ADD CONSTRAINT "production_load_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_load_events" ADD CONSTRAINT "production_load_events_load_id_organization_id_production_loads_id_organization_id_fk" FOREIGN KEY ("load_id","organization_id") REFERENCES "public"."production_loads"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_load_items" ADD CONSTRAINT "production_load_items_load_id_order_item_id_unique" UNIQUE("load_id","order_item_id");--> statement-breakpoint
ALTER TABLE "production_load_items" ADD CONSTRAINT "positive_load_allocation" CHECK ("production_load_items"."quantity" > 0);