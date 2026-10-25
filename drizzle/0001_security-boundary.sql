-- Custom SQL migration file, put your code below! --
-- No Supabase Auth JWTs are used. Public Data API roles have no access.
DO $$
DECLARE table_name text; browser_role text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['user','session','account','verification','rate_limit','employee_profiles','employee_role_assignments','role_permissions','centres','organizations','customers','projects','leads','appointments','quotations','quotation_items','orders','order_items','production_loads','production_load_items','payments','dispatches','deliveries','installations','sgrip_glass_checklists','engineer_audits','handovers','service_tickets','documents','workflow_events','audit_logs']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', table_name);
    FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = browser_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, browser_role);
      END IF;
    END LOOP;
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['employee_role_assignments','role_permissions','centres','customers','projects','leads','appointments','quotations','quotation_items','orders','order_items','production_loads','production_load_items','payments','dispatches','deliveries','installations','sgrip_glass_checklists','engineer_audits','handovers','service_tickets','documents','workflow_events','audit_logs'] LOOP
    EXECUTE format('CREATE INDEX %I ON public.%I (organization_id)', table_name || '_organization_idx', table_name);
  END LOOP;
END $$;
--> statement-breakpoint
-- RLS has no browser allow policies. The server connection is a trusted boundary.
-- An owner/postgres connection bypasses RLS: service methods enforce scope explicitly.
CREATE FUNCTION public.siteflow_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit records are append-only'; END $$;
--> statement-breakpoint
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.siteflow_audit_immutable();
--> statement-breakpoint
ALTER TABLE public.documents ADD CONSTRAINT documents_scoped_path
CHECK (object_path LIKE organization_id::text || '/' || order_id::text || '/%');
--> statement-breakpoint
CREATE FUNCTION public.siteflow_validate_glass_company() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = NEW.organization_id AND slug = 's-grip') THEN
    RAISE EXCEPTION 'Glass checklists belong to S-Grip installations only';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER sgrip_company_guard BEFORE INSERT OR UPDATE ON public.sgrip_glass_checklists
FOR EACH ROW EXECUTE FUNCTION public.siteflow_validate_glass_company();
--> statement-breakpoint
CREATE FUNCTION public.siteflow_validate_load_item() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.production_loads l JOIN public.order_items i
    ON i.order_id = l.order_id AND i.organization_id = l.organization_id
    WHERE l.id = NEW.load_id AND i.id = NEW.order_item_id AND l.organization_id = NEW.organization_id
  ) THEN RAISE EXCEPTION 'Load item must belong to the same order and organization'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER production_load_order_guard BEFORE INSERT OR UPDATE ON public.production_load_items
FOR EACH ROW EXECUTE FUNCTION public.siteflow_validate_load_item();
--> statement-breakpoint
-- Usernames are globally unique and stored in normalized form by the service.
CREATE UNIQUE INDEX user_username_normalized_unique ON public."user" (lower(username));
--> statement-breakpoint
CREATE UNIQUE INDEX user_email_normalized_unique ON public."user" (lower(email));
--> statement-breakpoint
ALTER TABLE public."user" ADD CONSTRAINT username_normalized
CHECK (username IS NULL OR (username = lower(btrim(username)) AND username ~ '^[a-z0-9._-]{3,40}$'));
--> statement-breakpoint
-- Restrictive policy also defeats pre-existing permissive browser policies for
-- this dedicated bucket. Service-role Storage calls bypass RLS after app checks.
DO $$ BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY siteflow_documents_server_only ON storage.objects AS RESTRICTIVE FOR ALL TO PUBLIC USING (bucket_id <> ''siteflow-documents'') WITH CHECK (bucket_id <> ''siteflow-documents'')';
  END IF;
END $$;
