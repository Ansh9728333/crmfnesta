ALTER TABLE admin_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_catalog,notification_receipts FROM PUBLIC,anon,authenticated;
ALTER TABLE admin_catalog ADD CONSTRAINT catalog_kind CHECK(kind IN ('company_profile','territory','product_category','payment_template','document_requirement','sla'));
ALTER TABLE admin_catalog ADD CONSTRAINT catalog_version CHECK(version>0);
ALTER TABLE notification_receipts ADD CONSTRAINT notification_state CHECK(state IN ('read','dismissed') AND kind IN ('follow_up','production','payment','installation','audit'));
CREATE UNIQUE INDEX catalog_name ON admin_catalog(organization_id,kind,lower(name));
CREATE INDEX lead_management_cohort ON leads(organization_id,created_at,assigned_to) WHERE archived_at IS NULL;
CREATE INDEX lead_management_dimensions ON leads(organization_id,financial_year,territory) WHERE archived_at IS NULL;
CREATE INDEX order_management_cohort ON orders(organization_id,created_at,centre_id);
CREATE INDEX payment_collection_date ON payments(order_id,status,received_at);
CREATE INDEX milestone_pending_date ON payment_milestones(order_id,due_at) WHERE allocated_amount<amount;
CREATE INDEX installation_target_date ON installations(order_id,status,planned_at);
CREATE INDEX audit_target_date ON engineer_audits(order_id,status,planned_at);
CREATE FUNCTION siteflow_catalog_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Disable settings to preserve historical references'; END IF;
 IF TG_OP='UPDATE' AND (OLD.organization_id<>NEW.organization_id OR OLD.code<>NEW.code OR OLD.kind<>NEW.kind OR NEW.version<>OLD.version+1) THEN RAISE EXCEPTION 'Setting identity is immutable and version must advance'; END IF;
 IF NEW.kind='company_profile' AND NOT EXISTS(SELECT 1 FROM organizations WHERE id=NEW.organization_id AND name=NEW.name AND slug=NEW.code) THEN RAISE EXCEPTION 'Preserve canonical company identities'; END IF;
 IF NEW.kind='sla' AND (NEW.code<>NEW.config->>'target' OR (NEW.config->>'graceHours')::int NOT BETWEEN 0 AND 720) THEN RAISE EXCEPTION 'Invalid SLA configuration'; END IF;
 IF NEW.kind='payment_template' AND ((NEW.config->>'percentage')::numeric NOT BETWEEN 0 AND 100 OR (NEW.config->>'offsetDays')::int NOT BETWEEN 0 AND 365) THEN RAISE EXCEPTION 'Invalid payment template'; END IF;
 IF NEW.kind='document_requirement' AND (NEW.config->>'stageNumber')::int NOT BETWEEN 1 AND 16 THEN RAISE EXCEPTION 'Invalid document stage'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER catalog_guard BEFORE INSERT OR UPDATE OR DELETE ON admin_catalog FOR EACH ROW EXECUTE FUNCTION siteflow_catalog_guard();
CREATE FUNCTION siteflow_document_requirement_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.requirement_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM order_stages s,jsonb_array_elements(s.document_requirements) r WHERE s.order_id=NEW.order_id AND s.organization_id=NEW.organization_id AND s.number=NEW.stage_number AND r->>'id'=NEW.requirement_id::text) THEN RAISE EXCEPTION 'Invalid company document requirement'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER document_requirement_guard BEFORE INSERT ON documents FOR EACH ROW EXECUTE FUNCTION siteflow_document_requirement_guard();

