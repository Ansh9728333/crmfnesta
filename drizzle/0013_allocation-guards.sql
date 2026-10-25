ALTER TABLE "order_items" ADD COLUMN "allocated_quantity" numeric(12, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
-- Backfill only actual historical allocations; invalid history fails the CHECK below.
UPDATE order_items i SET allocated_quantity = coalesce((SELECT sum(quantity) FROM production_load_items a WHERE a.order_item_id=i.id),0);
ALTER TABLE order_items ADD CONSTRAINT allocation_capacity CHECK (allocated_quantity >= 0 AND allocated_quantity <= quantity);
ALTER TABLE production_loads ADD CONSTRAINT load_status_valid CHECK (status IN ('planned','released','in_production','factory_ready','dispatched','delivered','installation_started','installed','audit_passed','completed'));
ALTER TABLE production_loads ADD CONSTRAINT load_completion_valid CHECK ((status='completed') = (completed_at IS NOT NULL));
ALTER TABLE production_load_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON production_load_events FROM PUBLIC, anon, authenticated;
CREATE TRIGGER production_load_events_immutable BEFORE UPDATE OR DELETE ON production_load_events FOR EACH ROW EXECUTE FUNCTION siteflow_audit_immutable();
--> statement-breakpoint
-- Atomic counter updates lock each confirmed item row. Concurrent writers cannot both consume the same remaining capacity.
CREATE FUNCTION siteflow_allocate_load_item() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE load_order uuid; item_order uuid; load_state text;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.order_item_id<>OLD.order_item_id OR NEW.load_id<>OLD.load_id OR NEW.organization_id<>OLD.organization_id) THEN
  RAISE EXCEPTION 'Allocation identity is immutable';
 END IF;
 SELECT order_id,status INTO load_order,load_state FROM production_loads WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.load_id ELSE NEW.load_id END FOR UPDATE;
 IF load_state<>'planned' THEN RAISE EXCEPTION 'Released allocations are immutable'; END IF;
 IF TG_OP='DELETE' THEN
  UPDATE order_items SET allocated_quantity=allocated_quantity-OLD.quantity WHERE id=OLD.order_item_id;
  RETURN OLD;
 END IF;
 SELECT order_id INTO item_order FROM order_items WHERE id=NEW.order_item_id;
 IF item_order IS DISTINCT FROM load_order THEN RAISE EXCEPTION 'Allocation belongs to another order'; END IF;
 UPDATE order_items SET allocated_quantity=allocated_quantity+NEW.quantity-CASE WHEN TG_OP='UPDATE' THEN OLD.quantity ELSE 0 END WHERE id=NEW.order_item_id;
 RETURN NEW;
END $$;
CREATE TRIGGER production_allocation_guard BEFORE INSERT OR UPDATE OR DELETE ON production_load_items FOR EACH ROW EXECUTE FUNCTION siteflow_allocate_load_item();
--> statement-breakpoint
CREATE FUNCTION siteflow_load_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Preserve load history'; END IF;
 IF OLD.order_id<>NEW.order_id OR OLD.organization_id<>NEW.organization_id OR OLD.load_number<>NEW.load_number THEN RAISE EXCEPTION 'Load identity is immutable'; END IF;
 IF OLD.status='completed' THEN RAISE EXCEPTION 'Completed loads are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER production_load_guard BEFORE UPDATE OR DELETE ON production_loads FOR EACH ROW EXECUTE FUNCTION siteflow_load_guard();
--> statement-breakpoint
CREATE FUNCTION siteflow_confirmed_item_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.allocated_quantity<>OLD.allocated_quantity AND pg_trigger_depth()=1 THEN RAISE EXCEPTION 'Allocated quantity is maintained by allocation triggers'; END IF;
 IF OLD.allocated_quantity>0 AND (NEW.order_id<>OLD.order_id OR NEW.organization_id<>OLD.organization_id) THEN RAISE EXCEPTION 'Allocated item parent is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER confirmed_item_guard BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION siteflow_confirmed_item_guard();
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM production_load_items a JOIN production_loads l ON l.id=a.load_id JOIN order_items i ON i.id=a.order_item_id WHERE l.order_id<>i.order_id) THEN RAISE EXCEPTION 'Review historical cross-order allocations before migration'; END IF;
END $$;
CREATE INDEX production_load_order_status ON production_loads(order_id,status);
CREATE INDEX production_allocation_item ON production_load_items(order_item_id);
CREATE INDEX production_load_history ON production_load_events(load_id,created_at DESC,id DESC);
