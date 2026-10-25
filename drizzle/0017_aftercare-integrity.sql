DO $$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['installation_entries','audit_punch_items','customer_feedback','aftercare_files','aftercare_events'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',n);
 EXECUTE format('REVOKE ALL ON %I FROM PUBLIC, anon, authenticated',n);
 END LOOP;
END $$;
INSERT INTO role_permissions(organization_id,role,permission) SELECT o.id,r.role,'service.manage' FROM organizations o CROSS JOIN (SELECT unnest(ARRAY['Super Admin','Admin','Post-Sales Coordinator','Service Engineer']::employee_role[]) role) r ON CONFLICT DO NOTHING;
CREATE TRIGGER aftercare_history_immutable BEFORE UPDATE OR DELETE ON aftercare_events FOR EACH ROW EXECUTE FUNCTION siteflow_audit_immutable();
CREATE TRIGGER aftercare_files_immutable BEFORE UPDATE OR DELETE ON aftercare_files FOR EACH ROW EXECUTE FUNCTION siteflow_audit_immutable();
CREATE TRIGGER installation_entries_immutable BEFORE UPDATE OR DELETE ON installation_entries FOR EACH ROW EXECUTE FUNCTION siteflow_audit_immutable();
ALTER TABLE production_load_items ADD CONSTRAINT installed_capacity CHECK(installed_quantity>=0 AND installed_quantity<=quantity);
ALTER TABLE installation_entries ADD CONSTRAINT installed_positive CHECK(quantity>0);
ALTER TABLE aftercare_files ADD CONSTRAINT aftercare_file_target CHECK(num_nonnulls(installation_id,audit_id,handover_id,ticket_id)=1 AND byte_size BETWEEN 1 AND 4194304 AND content_type IN ('application/pdf','image/jpeg','image/png') AND (kind NOT LIKE '%_photo' OR content_type<>'application/pdf') AND ((kind IN ('installation_photo','glass_template') AND installation_id IS NOT NULL) OR (kind='audit_photo' AND audit_id IS NOT NULL) OR (kind IN ('handover_certificate','installation_report','warranty_document') AND handover_id IS NOT NULL) OR (kind='ticket_photo' AND ticket_id IS NOT NULL)));
ALTER TABLE sgrip_glass_checklists ADD CONSTRAINT glass_template_file_fk FOREIGN KEY(template_file_id) REFERENCES aftercare_files(id);
ALTER TABLE installations ADD CONSTRAINT installation_status CHECK(status IN ('planned','in_progress','completed'));
ALTER TABLE engineer_audits ADD CONSTRAINT engineer_audit_status CHECK(status IN ('planned','in_progress','submitted','changes_required','approved'));
ALTER TABLE audit_punch_items ADD CONSTRAINT punch_state CHECK(status IN ('open','resolved') AND (status<>'resolved' OR (resolution IS NOT NULL AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL)));
ALTER TABLE customer_feedback ADD CONSTRAINT feedback_state CHECK(status IN ('pending','requested','received','declined','no_response') AND (rating IS NULL OR rating BETWEEN 1 AND 5));
ALTER TABLE service_tickets ADD CONSTRAINT service_state CHECK(status IN ('open','in_progress','waiting_customer','resolved','closed') AND priority IN ('low','normal','high','urgent') AND kind IN ('service','complaint') AND (status NOT IN ('resolved','closed') OR (resolution IS NOT NULL AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL)));
CREATE INDEX aftercare_order_history ON aftercare_events(order_id,created_at DESC,id DESC);
CREATE INDEX installation_entry_item ON installation_entries(load_item_id);
CREATE INDEX service_pending_due ON service_tickets(assigned_to,status,due_at);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION siteflow_allocate_load_item() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE load_order uuid; item_order uuid; load_state text;
BEGIN
 IF TG_OP='INSERT' AND (NEW.dispatched_quantity<>0 OR NEW.installed_quantity<>0) THEN RAISE EXCEPTION 'Quantity counters start at zero'; END IF;
 IF TG_OP='UPDATE' AND (NEW.dispatched_quantity<>OLD.dispatched_quantity OR NEW.installed_quantity<>OLD.installed_quantity) THEN
  IF pg_trigger_depth()<=1 OR (to_jsonb(NEW)-ARRAY['dispatched_quantity','installed_quantity']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['dispatched_quantity','installed_quantity']) THEN RAISE EXCEPTION 'Dispatch counter is internal'; END IF; RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' AND (NEW.order_item_id<>OLD.order_item_id OR NEW.load_id<>OLD.load_id OR NEW.organization_id<>OLD.organization_id) THEN RAISE EXCEPTION 'Allocation identity is immutable'; END IF;
 SELECT order_id,status INTO load_order,load_state FROM production_loads WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.load_id ELSE NEW.load_id END FOR UPDATE;
 IF load_state<>'planned' THEN RAISE EXCEPTION 'Released allocations are immutable'; END IF;
 IF TG_OP='DELETE' THEN UPDATE order_items SET allocated_quantity=allocated_quantity-OLD.quantity WHERE id=OLD.order_item_id; RETURN OLD; END IF;
 SELECT order_id INTO item_order FROM order_items WHERE id=NEW.order_item_id;
 IF item_order IS DISTINCT FROM load_order THEN RAISE EXCEPTION 'Allocation belongs to another order'; END IF;
 UPDATE order_items SET allocated_quantity=allocated_quantity+NEW.quantity-CASE WHEN TG_OP='UPDATE' THEN OLD.quantity ELSE 0 END WHERE id=NEW.order_item_id;
 RETURN NEW;
END $$;

CREATE FUNCTION siteflow_install_quantity() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE i installations; parent uuid; BEGIN
 SELECT * INTO i FROM installations WHERE id=NEW.installation_id FOR UPDATE;
 SELECT load_id INTO parent FROM production_load_items WHERE id=NEW.load_item_id;
 IF i.status<>'in_progress' OR parent IS DISTINCT FROM i.load_id OR NEW.occurred_at<i.started_at OR NEW.occurred_at>now() THEN RAISE EXCEPTION 'Invalid installation progress'; END IF;
 UPDATE production_load_items SET installed_quantity=installed_quantity+NEW.quantity WHERE id=NEW.load_item_id;
 RETURN NEW;
END $$;
CREATE TRIGGER install_quantity BEFORE INSERT ON installation_entries FOR EACH ROW EXECUTE FUNCTION siteflow_install_quantity();
CREATE FUNCTION siteflow_glass_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Preserve glass history'; END IF;
 IF TG_OP='UPDATE' AND (OLD.template_approved OR OLD.installation_id<>NEW.installation_id OR OLD.organization_id<>NEW.organization_id) THEN RAISE EXCEPTION 'Approved glass evidence and identity are immutable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM installations i JOIN organizations o ON o.id=i.organization_id WHERE i.id=NEW.installation_id AND o.slug='s-grip') THEN RAISE EXCEPTION 'Glass checklist is only for S-Grip'; END IF;
 IF NOT NEW.glass_required AND (jsonb_array_length(NEW.dimensions)>0 OR num_nonnulls(NEW.responsible_id,NEW.measured_at,NEW.prepared_by,NEW.prepared_at,NEW.template_file_id,NEW.approved_by,NEW.approved_at)>0) THEN RAISE EXCEPTION 'No glass skips the checklist'; END IF;
 IF NEW.measured_at>now() OR NEW.prepared_at>now() OR NEW.approved_at>now() OR NEW.prepared_at<NEW.measured_at OR NEW.approved_at<NEW.prepared_at THEN RAISE EXCEPTION 'Invalid glass evidence chronology'; END IF;
 IF NEW.measurement_taken AND (NEW.responsible_id IS NULL OR NEW.measured_at IS NULL OR jsonb_array_length(NEW.dimensions)=0) THEN RAISE EXCEPTION 'Glass dimensions, employee and date required'; END IF;
 IF NEW.template_prepared AND (NEW.prepared_by IS NULL OR NEW.prepared_at IS NULL OR NOT EXISTS(SELECT 1 FROM aftercare_files WHERE id=NEW.template_file_id AND installation_id=NEW.installation_id AND kind='glass_template')) THEN RAISE EXCEPTION 'Uploaded glass template and preparation identity required'; END IF;
 IF NEW.template_approved AND (NEW.approved_by IS NULL OR NEW.approved_at IS NULL) THEN RAISE EXCEPTION 'Glass approver identity required'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER glass_guard BEFORE INSERT OR UPDATE OR DELETE ON sgrip_glass_checklists FOR EACH ROW EXECUTE FUNCTION siteflow_glass_guard();
CREATE FUNCTION siteflow_install_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Preserve installation history'; END IF;
 IF TG_OP='UPDATE' AND (OLD.status='completed' OR OLD.order_id<>NEW.order_id OR OLD.load_id IS DISTINCT FROM NEW.load_id OR OLD.organization_id<>NEW.organization_id) THEN RAISE EXCEPTION 'Completed installation and identity are immutable'; END IF;
 IF NEW.load_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM production_loads WHERE id=NEW.load_id AND order_id=NEW.order_id AND organization_id=NEW.organization_id) THEN RAISE EXCEPTION 'Installation load belongs to another order'; END IF;
 IF NEW.started_at>now() OR NEW.completed_at>now() OR NEW.completed_at<NEW.started_at THEN RAISE EXCEPTION 'Invalid installation chronology'; END IF;
 IF NEW.status='in_progress' AND (TG_OP='INSERT' OR OLD.status='planned') AND NOT EXISTS(SELECT 1 FROM production_loads WHERE id=NEW.load_id AND status='delivered') THEN RAISE EXCEPTION 'Confirmed delivery required'; END IF;
 IF NEW.status='completed' THEN
  IF NEW.completed_at IS NULL OR NEW.completed_by IS NULL OR NOT EXISTS(SELECT 1 FROM production_load_items WHERE load_id=NEW.load_id) OR EXISTS(SELECT 1 FROM production_load_items WHERE load_id=NEW.load_id AND installed_quantity<>quantity) THEN RAISE EXCEPTION 'All installed quantities and completion identity required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM aftercare_files WHERE installation_id=NEW.id AND kind='installation_photo') THEN RAISE EXCEPTION 'Installation photo required'; END IF;
  IF EXISTS(SELECT 1 FROM organizations WHERE id=NEW.organization_id AND slug='s-grip') AND NOT EXISTS(SELECT 1 FROM sgrip_glass_checklists WHERE installation_id=NEW.id AND (NOT glass_required OR template_approved)) THEN RAISE EXCEPTION 'Explicit glass decision and required approval required'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER install_guard BEFORE INSERT OR UPDATE OR DELETE ON installations FOR EACH ROW EXECUTE FUNCTION siteflow_install_guard();
CREATE FUNCTION siteflow_audit_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Preserve audit history'; END IF;
 IF TG_OP='UPDATE' AND (OLD.status='approved' OR OLD.order_id<>NEW.order_id OR OLD.installation_id IS DISTINCT FROM NEW.installation_id OR OLD.organization_id<>NEW.organization_id) THEN RAISE EXCEPTION 'Approved audit and identity are immutable'; END IF;
 IF NEW.status IN ('submitted','approved') THEN
  IF NOT EXISTS(SELECT 1 FROM installations WHERE id=NEW.installation_id AND status='completed') OR NEW.inspection_at IS NULL OR jsonb_array_length(NEW.checklist)<>7 OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.checklist) c WHERE c->>'result' NOT IN ('pass','not_applicable') OR (c->>'result'='not_applicable' AND btrim(c->>'notes')='')) OR EXISTS(SELECT 1 FROM audit_punch_items WHERE audit_id=NEW.id AND status<>'resolved') OR NOT EXISTS(SELECT 1 FROM aftercare_files WHERE audit_id=NEW.id AND kind='audit_photo') THEN RAISE EXCEPTION 'Installation, passing checks, resolved punch list and photos required'; END IF;
  IF NEW.status='approved' AND (NEW.approved_by IS NULL OR NEW.completed_at IS NULL) THEN RAISE EXCEPTION 'Audit approval identity required'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER engineer_audit_guard BEFORE INSERT OR UPDATE OR DELETE ON engineer_audits FOR EACH ROW EXECUTE FUNCTION siteflow_audit_guard();
CREATE FUNCTION siteflow_punch_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Preserve punch history'; END IF;
 IF EXISTS(SELECT 1 FROM engineer_audits WHERE id=NEW.audit_id AND status='approved') OR (TG_OP='UPDATE' AND (OLD.status='resolved' OR OLD.audit_id<>NEW.audit_id OR OLD.order_id<>NEW.order_id OR OLD.organization_id<>NEW.organization_id)) THEN RAISE EXCEPTION 'Punch item is locked'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER punch_guard BEFORE INSERT OR UPDATE OR DELETE ON audit_punch_items FOR EACH ROW EXECUTE FUNCTION siteflow_punch_guard();
--> statement-breakpoint
CREATE FUNCTION siteflow_handover_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Preserve handover history'; END IF;
 IF TG_OP='UPDATE' AND (OLD.status='confirmed' OR OLD.order_id<>NEW.order_id OR OLD.organization_id<>NEW.organization_id) THEN RAISE EXCEPTION 'Confirmed handover and identity are immutable'; END IF;
 IF NEW.status='confirmed' THEN
  IF NOT NEW.customer_accepted OR NEW.customer_representative IS NULL OR NEW.acceptance_reference IS NULL OR NEW.completed_at IS NULL OR NEW.confirmed_by IS NULL OR NEW.confirmed_at IS NULL THEN RAISE EXCEPTION 'Customer acceptance and handover identity required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND stage=15) OR (SELECT count(*) FROM order_stages WHERE order_id=NEW.order_id AND number<15 AND status='completed' AND approved_by IS NOT NULL)<>14 THEN RAISE EXCEPTION 'Approve preceding workflow stages'; END IF;
  IF NOT EXISTS(SELECT 1 FROM production_loads WHERE order_id=NEW.order_id) OR EXISTS(SELECT 1 FROM order_items WHERE order_id=NEW.order_id AND quantity<>allocated_quantity) OR EXISTS(SELECT 1 FROM production_loads l WHERE l.order_id=NEW.order_id AND EXISTS(SELECT 1 FROM production_load_items li WHERE li.load_id=l.id) AND (l.status<>'completed' OR NOT EXISTS(SELECT 1 FROM installations i JOIN engineer_audits a ON a.installation_id=i.id WHERE i.load_id=l.id AND i.status='completed' AND a.status='approved'))) THEN RAISE EXCEPTION 'Complete all loads, installation and audits'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['handover_certificate','installation_report','warranty_document']) kind WHERE NOT EXISTS(SELECT 1 FROM aftercare_files f WHERE f.handover_id=NEW.id AND f.kind=kind)) THEN RAISE EXCEPTION 'Mandatory handover documents required'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER handover_guard BEFORE INSERT OR UPDATE OR DELETE ON handovers FOR EACH ROW EXECUTE FUNCTION siteflow_handover_guard();
CREATE FUNCTION siteflow_after_handover() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Preserve aftercare history'; END IF;
 IF NOT EXISTS(SELECT 1 FROM handovers WHERE order_id=NEW.order_id AND status='confirmed') THEN RAISE EXCEPTION 'Confirmed customer handover required'; END IF;
 IF TG_OP='UPDATE' AND (OLD.order_id<>NEW.order_id OR OLD.organization_id<>NEW.organization_id) THEN RAISE EXCEPTION 'Aftercare identity is immutable'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER feedback_handover BEFORE INSERT OR UPDATE OR DELETE ON customer_feedback FOR EACH ROW EXECUTE FUNCTION siteflow_after_handover();
CREATE TRIGGER ticket_handover BEFORE INSERT OR UPDATE OR DELETE ON service_tickets FOR EACH ROW EXECUTE FUNCTION siteflow_after_handover();


