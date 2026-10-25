ALTER TABLE "help_tickets" DROP CONSTRAINT "help_source_required";--> statement-breakpoint
ALTER TABLE "help_tickets" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_source_required" CHECK ("help_tickets"."customer_id" is not null);