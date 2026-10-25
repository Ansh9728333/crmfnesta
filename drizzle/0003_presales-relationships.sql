ALTER TABLE "customers" DROP CONSTRAINT "customers_centre_id_centres_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_centre_id_centres_id_fk";
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_centre_id_organization_id_centres_id_organization_id_fk" FOREIGN KEY ("centre_id","organization_id") REFERENCES "public"."centres"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_centre_id_organization_id_centres_id_organization_id_fk" FOREIGN KEY ("centre_id","organization_id") REFERENCES "public"."centres"("id","organization_id") ON DELETE no action ON UPDATE no action;