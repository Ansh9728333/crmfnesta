ALTER TABLE "appointments" ADD CONSTRAINT "appointments_id_lead_id_organization_id_unique" UNIQUE("id","lead_id","organization_id");
--> statement-breakpoint
ALTER TABLE "presales_attachments" DROP CONSTRAINT "presales_attachments_appointment_id_appointments_id_fk";
--> statement-breakpoint
ALTER TABLE "presales_attachments" ADD CONSTRAINT "presales_attachments_appointment_id_lead_id_organization_id_appointments_id_lead_id_organization_id_fk" FOREIGN KEY ("appointment_id","lead_id","organization_id") REFERENCES "public"."appointments"("id","lead_id","organization_id") ON DELETE no action ON UPDATE no action;
