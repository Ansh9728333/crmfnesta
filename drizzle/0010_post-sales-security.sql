ALTER TABLE public.order_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_stage_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_stage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_stages,public.order_stage_policies,public.order_stage_events FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON public.order_stages,public.order_stage_policies,public.order_stage_events FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE public.order_stages ADD CONSTRAINT order_stage_status CHECK(status IN ('pending','in_progress','awaiting_approval','changes_requested','completed'));
ALTER TABLE public.order_stages ADD CONSTRAINT approved_stage_evidence CHECK((status='completed' AND approved_by IS NOT NULL AND completed_at IS NOT NULL AND submitted_at IS NOT NULL AND started_at IS NOT NULL) OR (status<>'completed' AND approved_by IS NULL AND completed_at IS NULL));
CREATE TRIGGER order_stage_events_immutable BEFORE UPDATE OR DELETE ON public.order_stage_events FOR EACH ROW EXECUTE FUNCTION public.siteflow_audit_immutable();
CREATE OR REPLACE FUNCTION public.siteflow_completed_stage_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' OR OLD.status='completed' THEN RAISE EXCEPTION 'Completed workflow records are immutable'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER completed_stage_immutable BEFORE UPDATE OR DELETE ON public.order_stages FOR EACH ROW EXECUTE FUNCTION public.siteflow_completed_stage_immutable();
--> statement-breakpoint
INSERT INTO public.role_permissions(organization_id,role,permission)
SELECT o.id,r.role::public.employee_role,'orders.read' FROM public.organizations o CROSS JOIN (VALUES ('Survey Engineer'),('Installation Team'),('Service Engineer')) r(role)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.siteflow_stage_document_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN IF OLD.stage_number IS NOT NULL THEN RAISE EXCEPTION 'Stage document history is immutable'; END IF; RETURN OLD; END IF;
 IF OLD.stage_number IS NOT NULL OR NEW.stage_number IS NOT NULL THEN RAISE EXCEPTION 'Stage document history is immutable'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER stage_document_immutable BEFORE UPDATE OR DELETE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.siteflow_stage_document_immutable();
