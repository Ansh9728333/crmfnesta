ALTER TABLE help_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_ticket_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_concern_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON help_tickets,help_ticket_events,help_ticket_files,help_concern_policies FROM PUBLIC,anon,authenticated;
CREATE TRIGGER help_events_immutable BEFORE UPDATE OR DELETE ON help_ticket_events FOR EACH ROW EXECUTE FUNCTION siteflow_audit_immutable();
CREATE FUNCTION siteflow_help_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Help tickets retain all history'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (OLD.id,OLD.organization_id,OLD.centre_id,OLD.customer_id,OLD.lead_id,OLD.project_id,OLD.created_by,OLD.request_id,OLD.number,OLD.concern,OLD.details,OLD.priority,OLD.attachment_required,OLD.created_at,OLD.due_at) IS DISTINCT FROM (NEW.id,NEW.organization_id,NEW.centre_id,NEW.customer_id,NEW.lead_id,NEW.project_id,NEW.created_by,NEW.request_id,NEW.number,NEW.concern,NEW.details,NEW.priority,NEW.attachment_required,NEW.created_at,NEW.due_at) OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Ticket identity and original concern are immutable; version must advance'; END IF;
  IF NOT ((OLD.status IN ('raised','reopened') AND NEW.status IN ('in_progress','awaiting_confirmation','raised')) OR (OLD.status='in_progress' AND NEW.status IN ('awaiting_confirmation','raised')) OR (OLD.status='awaiting_confirmation' AND NEW.status IN ('closed','reopened','raised')) OR (OLD.status='closed' AND NEW.status='reopened')) THEN RAISE EXCEPTION 'Invalid help ticket transition'; END IF;
 END IF;
 IF TG_OP='INSERT' AND NEW.lead_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM leads l WHERE l.id=NEW.lead_id AND l.organization_id=NEW.organization_id AND l.centre_id=NEW.centre_id AND l.customer_id=NEW.customer_id AND l.project_id IS NOT DISTINCT FROM NEW.project_id) THEN RAISE EXCEPTION 'Ticket lead context mismatch'; END IF;
 IF TG_OP='INSERT' AND NEW.project_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM projects p WHERE p.id=NEW.project_id AND p.organization_id=NEW.organization_id AND p.customer_id=NEW.customer_id AND p.centre_id=NEW.centre_id) THEN RAISE EXCEPTION 'Ticket project context mismatch'; END IF;
 IF NEW.closed_by IS NOT NULL AND (NEW.closed_by=NEW.resolved_by OR (NEW.created_by=NEW.assigned_to AND NOT EXISTS(SELECT 1 FROM employee_role_assignments e WHERE e.user_id=NEW.closed_by AND e.organization_id=NEW.organization_id AND e.role IN ('Admin','Super Admin')))) THEN RAISE EXCEPTION 'Independent confirmation required'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER help_ticket_guard BEFORE INSERT OR UPDATE OR DELETE ON help_tickets FOR EACH ROW EXECUTE FUNCTION siteflow_help_guard();
CREATE FUNCTION siteflow_help_file_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' OR OLD.ticket_id IS NOT NULL THEN RAISE EXCEPTION 'Claimed help evidence is immutable'; END IF;
 IF (OLD.id,OLD.organization_id,OLD.centre_id,OLD.uploaded_by,OLD.name,OLD.content_type,OLD.size,OLD.object_path,OLD.source_kind,OLD.source_id,OLD.expires_at,OLD.created_at) IS DISTINCT FROM (NEW.id,NEW.organization_id,NEW.centre_id,NEW.uploaded_by,NEW.name,NEW.content_type,NEW.size,NEW.object_path,NEW.source_kind,NEW.source_id,NEW.expires_at,NEW.created_at) THEN RAISE EXCEPTION 'Upload lease identity is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER help_file_guard BEFORE UPDATE OR DELETE ON help_ticket_files FOR EACH ROW EXECUTE FUNCTION siteflow_help_file_guard();
CREATE FUNCTION siteflow_help_policy_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Disable concern types instead of deleting'; END IF;
 IF TG_OP='UPDATE' AND ((OLD.id,OLD.organization_id,OLD.code) IS DISTINCT FROM (NEW.id,NEW.organization_id,NEW.code) OR NEW.version<>OLD.version+1) THEN RAISE EXCEPTION 'Policy identity is immutable; version must advance'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER help_policy_guard BEFORE UPDATE OR DELETE ON help_concern_policies FOR EACH ROW EXECUTE FUNCTION siteflow_help_policy_guard();
ALTER TABLE notification_receipts DROP CONSTRAINT notification_state;
ALTER TABLE notification_receipts ADD CONSTRAINT notification_state CHECK(state IN ('read','dismissed') AND kind IN ('follow_up','production','payment','installation','audit','help_ticket'));
-- Default intake stays with existing sales roles; service staff receive assigned tickets only.
-- These permissions do not grant access to other employees' leads, orders or financial data.
INSERT INTO role_permissions(organization_id,role,permission) SELECT o.id,r.role::employee_role,p.permission FROM organizations o CROSS JOIN (VALUES ('Sales Manager'),('CSE'),('Sales Executive')) r(role) CROSS JOIN (VALUES ('help.read'),('help.raise')) p(permission) ON CONFLICT DO NOTHING;
INSERT INTO role_permissions(organization_id,role,permission) SELECT o.id,r.role::employee_role,p.permission FROM organizations o CROSS JOIN (VALUES ('Service Engineer'),('Post-Sales Coordinator')) r(role) CROSS JOIN (VALUES ('help.read'),('help.resolve')) p(permission) ON CONFLICT DO NOTHING;
INSERT INTO help_concern_policies(organization_id,code,name) SELECT o.id,c.code,c.name FROM organizations o CROSS JOIN (VALUES ('quotation','Quotation'),('site_visit','Site Visit'),('payment','Payment'),('production','Production'),('delivery','Delivery'),('installation','Installation'),('service','Service'),('other','Other')) c(code,name) ON CONFLICT DO NOTHING;
DO $$ BEGIN IF to_regclass('storage.objects') IS NOT NULL THEN
 EXECUTE 'CREATE POLICY siteflow_help_files_server_only ON storage.objects AS RESTRICTIVE FOR ALL TO PUBLIC USING (bucket_id <> ''siteflow-help-ticket-files'') WITH CHECK (bucket_id <> ''siteflow-help-ticket-files'')';
END IF; END $$;
