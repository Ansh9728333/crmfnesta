ALTER TABLE public.quotation_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presales_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quotation_decisions, public.sales_engagements, public.presales_attachments FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON public.quotation_decisions, public.sales_engagements, public.presales_attachments FROM %I',role_name);
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
CREATE TRIGGER quotation_versions_immutable BEFORE UPDATE OR DELETE ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.siteflow_audit_immutable();
CREATE TRIGGER quotation_items_immutable BEFORE UPDATE OR DELETE ON public.quotation_items FOR EACH ROW EXECUTE FUNCTION public.siteflow_audit_immutable();
CREATE TRIGGER quotation_decisions_immutable BEFORE UPDATE OR DELETE ON public.quotation_decisions FOR EACH ROW EXECUTE FUNCTION public.siteflow_audit_immutable();
CREATE TRIGGER sales_engagements_immutable BEFORE UPDATE OR DELETE ON public.sales_engagements FOR EACH ROW EXECUTE FUNCTION public.siteflow_audit_immutable();
CREATE TRIGGER presales_attachments_immutable BEFORE UPDATE OR DELETE ON public.presales_attachments FOR EACH ROW EXECUTE FUNCTION public.siteflow_audit_immutable();
--> statement-breakpoint
ALTER TABLE public.appointments ADD CONSTRAINT appointment_status_valid CHECK (status IN ('scheduled','confirmed','completed','cancelled','no-show'));
ALTER TABLE public.quotation_decisions ADD CONSTRAINT quotation_decision_valid CHECK (decision IN ('approved','accepted','rejected') AND length(btrim(evidence))>=3);
ALTER TABLE public.sales_engagements ADD CONSTRAINT engagement_kind_valid CHECK (kind IN ('showroom','negotiation') AND (not_required=false OR (kind='showroom' AND reason IS NOT NULL AND length(btrim(reason))>=3)));
ALTER TABLE public.quotation_items ADD CONSTRAINT quotation_item_values_valid CHECK (quantity>0 AND unit_price>=0 AND discount>=0 AND (subtotal IS NULL OR discount<=subtotal) AND (amount IS NULL OR amount>=0));
ALTER TABLE public.presales_attachments ADD CONSTRAINT presales_file_valid CHECK (byte_size BETWEEN 1 AND 4194304 AND content_type IN ('application/pdf','image/jpeg','image/png'));
CREATE INDEX appointments_lead_schedule_idx ON public.appointments(lead_id,scheduled_at DESC);
CREATE INDEX quotations_lead_revision_idx ON public.quotations(lead_id,revision DESC);
