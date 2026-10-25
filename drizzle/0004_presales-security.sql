-- Custom SQL migration file, put your code below! --
-- New pre-sales records are accessed only through verified server services.
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.lead_follow_ups ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON public.lead_activities, public.lead_follow_ups FROM PUBLIC;
--> statement-breakpoint
DO $$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON public.lead_activities, public.lead_follow_ups FROM %I',role_name);
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
CREATE TRIGGER lead_activities_immutable BEFORE UPDATE OR DELETE ON public.lead_activities
FOR EACH ROW EXECUTE FUNCTION public.siteflow_audit_immutable();
--> statement-breakpoint
ALTER TABLE public.leads ADD CONSTRAINT lead_priority_valid CHECK (priority IN ('low','normal','high','urgent'));
--> statement-breakpoint
ALTER TABLE public.leads ADD CONSTRAINT lead_mobile_valid CHECK (mobile IS NULL OR mobile ~ '^\+91[6-9][0-9]{9}$');
--> statement-breakpoint
ALTER TABLE public.leads ADD CONSTRAINT lead_booking_month_valid CHECK (booking_month IS NULL OR booking_month BETWEEN 1 AND 12);
--> statement-breakpoint
ALTER TABLE public.leads ADD CONSTRAINT lead_values_nonnegative CHECK ((expected_value IS NULL OR expected_value >= 0) AND (finalised_value IS NULL OR finalised_value >= 0) AND (order_qty IS NULL OR order_qty >= 0) AND (pleated_mesh_qty IS NULL OR pleated_mesh_qty >= 0));
--> statement-breakpoint
-- NOT VALID preserves unknown legacy stage-7 rows without inventing their outcome.
-- PostgreSQL still enforces these constraints on every new insert/update.
ALTER TABLE public.leads ADD CONSTRAINT lead_final_outcome_required CHECK ((stage < 7 AND outcome IS NULL) OR (stage = 7 AND outcome IS NOT NULL)) NOT VALID;
--> statement-breakpoint
ALTER TABLE public.leads ADD CONSTRAINT lead_lost_reason_required CHECK (outcome IS DISTINCT FROM 'lost' OR (loss_reason IS NOT NULL AND length(btrim(loss_reason)) >= 3)) NOT VALID;
--> statement-breakpoint
ALTER TABLE public.lead_follow_ups ADD CONSTRAINT follow_up_state_valid CHECK (state IN ('pending','completed','cancelled'));
--> statement-breakpoint
CREATE INDEX leads_assigned_pipeline_idx ON public.leads(organization_id,centre_id,assigned_to,stage,created_at DESC);
--> statement-breakpoint
CREATE INDEX leads_next_follow_up_idx ON public.leads(next_follow_up) WHERE archived_at IS NULL AND outcome IS NULL;
--> statement-breakpoint
CREATE INDEX leads_mobile_idx ON public.leads(organization_id,mobile);
--> statement-breakpoint
CREATE INDEX lead_activities_organization_idx ON public.lead_activities(organization_id);
--> statement-breakpoint
CREATE INDEX lead_follow_ups_organization_idx ON public.lead_follow_ups(organization_id);
--> statement-breakpoint
CREATE INDEX customers_owner_idx ON public.customers(organization_id,centre_id,assigned_to);
--> statement-breakpoint
CREATE INDEX projects_owner_idx ON public.projects(organization_id,centre_id,assigned_to);
