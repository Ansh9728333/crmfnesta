ALTER TABLE "order_stages" ADD COLUMN "document_requirements" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE FUNCTION siteflow_document_snapshot_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.document_requirements IS DISTINCT FROM OLD.document_requirements THEN RAISE EXCEPTION 'Order document rules are immutable snapshots'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER document_snapshot_guard BEFORE UPDATE ON order_stages FOR EACH ROW EXECUTE FUNCTION siteflow_document_snapshot_guard();
CREATE FUNCTION siteflow_notification_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.organization_id<>NEW.organization_id OR OLD.user_id<>NEW.user_id OR OLD.kind<>NEW.kind OR OLD.entity_id<>NEW.entity_id THEN RAISE EXCEPTION 'Notification receipt identity is immutable'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER notification_identity BEFORE UPDATE ON notification_receipts FOR EACH ROW EXECUTE FUNCTION siteflow_notification_identity();
