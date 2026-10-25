-- Reviewed security and financial integrity. No browser role receives ledger access.
DO $$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['payment_milestones','payment_allocations','dispatch_items','delivery_items','commerce_files','commerce_events'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',n);
 EXECUTE format('REVOKE ALL ON %I FROM PUBLIC, anon, authenticated',n);
 END LOOP;
END $$;
CREATE TRIGGER commerce_events_immutable BEFORE UPDATE OR DELETE ON commerce_events FOR EACH ROW EXECUTE FUNCTION siteflow_audit_immutable();
CREATE TRIGGER commerce_files_immutable BEFORE UPDATE OR DELETE ON commerce_files FOR EACH ROW EXECUTE FUNCTION siteflow_audit_immutable();
CREATE TRIGGER payment_allocations_immutable BEFORE UPDATE OR DELETE ON payment_allocations FOR EACH ROW EXECUTE FUNCTION siteflow_audit_immutable();
CREATE TRIGGER delivery_items_immutable BEFORE UPDATE OR DELETE ON delivery_items FOR EACH ROW EXECUTE FUNCTION siteflow_audit_immutable();
CREATE UNIQUE INDEX payment_reference_unique ON payments(organization_id,lower(btrim(reference))) WHERE status<>'rejected';
ALTER TABLE payments ADD CONSTRAINT payment_state CHECK(status IN ('pending','verified','rejected'));
ALTER TABLE payments ADD CONSTRAINT payment_allocated_capacity CHECK(allocated_amount>=0 AND allocated_amount<=amount);
ALTER TABLE payments ADD CONSTRAINT payment_verified_identity CHECK((status='verified')=(verified_by IS NOT NULL AND verified_at IS NOT NULL));
ALTER TABLE payment_milestones ADD CONSTRAINT milestone_capacity CHECK(amount>=0 AND allocated_amount>=0 AND allocated_amount<=amount);
ALTER TABLE payment_allocations ADD CONSTRAINT allocation_money_positive CHECK(amount>0);
UPDATE orders o SET recorded_payment_amount=coalesce((SELECT sum(amount) FROM payments p WHERE p.order_id=o.id AND p.status<>'rejected'),0);
ALTER TABLE orders ADD CONSTRAINT order_receipt_capacity CHECK(recorded_payment_amount>=0 AND recorded_payment_amount<=coalesce(final_value,0));
ALTER TABLE production_load_items ADD CONSTRAINT dispatched_item_capacity CHECK(dispatched_quantity>=0 AND dispatched_quantity<=quantity);
ALTER TABLE dispatch_items ADD CONSTRAINT dispatch_item_capacity CHECK(quantity>0 AND delivered_quantity>=0 AND delivered_quantity<=quantity);
ALTER TABLE delivery_items ADD CONSTRAINT delivery_quantity_valid CHECK(received>=0 AND damaged>=0 AND damaged<=received AND missing>=0 AND received+missing>0);
ALTER TABLE commerce_files ADD CONSTRAINT commerce_file_target CHECK(num_nonnulls(payment_id,dispatch_id,delivery_id)=1 AND byte_size>0 AND byte_size<=4194304 AND content_type IN ('application/pdf','image/jpeg','image/png'));
ALTER TABLE dispatches ADD CONSTRAINT dispatch_state CHECK(status IN ('draft','approved','dispatched','partially_delivered','delivered','cancelled'));
ALTER TABLE deliveries ADD CONSTRAINT delivery_state CHECK(status IN ('draft','confirmed','cancelled'));
CREATE INDEX commerce_order_history ON commerce_events(order_id,created_at DESC,id DESC);
CREATE INDEX commerce_order_files ON commerce_files(order_id);
CREATE INDEX payments_order_status ON payments(order_id,status);
CREATE INDEX dispatch_load_status ON dispatches(load_id,status);
--> statement-breakpoint
CREATE FUNCTION siteflow_payment_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Preserve payment history'; END IF;
 IF TG_OP='INSERT' THEN
  UPDATE orders SET recorded_payment_amount=recorded_payment_amount+NEW.amount WHERE id=NEW.order_id;
  IF NEW.status<>'pending' OR NEW.allocated_amount<>0 THEN RAISE EXCEPTION 'Record pending receipts first'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.allocated_amount<>OLD.allocated_amount THEN
  IF pg_trigger_depth()<=1 THEN RAISE EXCEPTION 'Allocation counter is internal'; END IF;
  RETURN NEW;
 END IF;
 IF (to_jsonb(NEW)-ARRAY['status','verified_by','verified_at','rejection_reason','version','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','verified_by','verified_at','rejection_reason','version','updated_at']) THEN RAISE EXCEPTION 'Receipt financial details are immutable'; END IF;
 IF OLD.status<>'pending' OR NEW.status NOT IN ('verified','rejected') THEN RAISE EXCEPTION 'Receipt decision is immutable'; END IF;
 IF NEW.status='verified' AND NOT EXISTS(SELECT 1 FROM commerce_files WHERE payment_id=OLD.id) THEN RAISE EXCEPTION 'Receipt attachment required'; END IF;
 IF NEW.status='rejected' THEN UPDATE orders SET recorded_payment_amount=recorded_payment_amount-OLD.amount WHERE id=OLD.order_id; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER payment_guard BEFORE INSERT OR UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION siteflow_payment_guard();
CREATE FUNCTION siteflow_order_money_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.recorded_payment_amount<>OLD.recorded_payment_amount AND pg_trigger_depth()=1 THEN RAISE EXCEPTION 'Receipt counter is internal'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER order_money_guard BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION siteflow_order_money_guard();
CREATE FUNCTION siteflow_milestone_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE parent uuid; capacity numeric; BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Preserve contractual history'; END IF;
 IF TG_OP='UPDATE' AND NEW.allocated_amount<>OLD.allocated_amount THEN
  IF pg_trigger_depth()<=1 THEN RAISE EXCEPTION 'Allocation counter is internal'; END IF; RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' AND (OLD.allocated_amount>0 OR OLD.order_id<>NEW.order_id OR OLD.load_id<>NEW.load_id OR OLD.organization_id<>NEW.organization_id) THEN RAISE EXCEPTION 'Funded milestone and identity are immutable'; END IF;
 SELECT order_id INTO parent FROM production_loads WHERE id=NEW.load_id;
 IF parent IS DISTINCT FROM NEW.order_id THEN RAISE EXCEPTION 'Milestone load belongs to another order'; END IF;
 SELECT final_value INTO capacity FROM orders WHERE id=NEW.order_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM dispatches WHERE load_id=NEW.load_id AND status NOT IN ('draft','cancelled')) THEN RAISE EXCEPTION 'Approved shipment terms are immutable'; END IF;
 IF (SELECT coalesce(sum(amount),0) FROM payment_milestones WHERE order_id=NEW.order_id AND id<>NEW.id)+NEW.amount>capacity THEN RAISE EXCEPTION 'Milestones exceed order value'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER milestone_guard BEFORE INSERT OR UPDATE OR DELETE ON payment_milestones FOR EACH ROW EXECUTE FUNCTION siteflow_milestone_guard();
CREATE FUNCTION siteflow_payment_allocate() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE state text; BEGIN
 SELECT status INTO state FROM payments WHERE id=NEW.payment_id FOR UPDATE;
 IF state<>'verified' THEN RAISE EXCEPTION 'Only verified receipts can be allocated'; END IF;
 UPDATE payments SET allocated_amount=allocated_amount+NEW.amount WHERE id=NEW.payment_id;
 UPDATE payment_milestones SET allocated_amount=allocated_amount+NEW.amount WHERE id=NEW.milestone_id;
 RETURN NEW;
END $$;
CREATE TRIGGER payment_allocate BEFORE INSERT ON payment_allocations FOR EACH ROW EXECUTE FUNCTION siteflow_payment_allocate();
--> statement-breakpoint
-- Extend the prior allocation guard to allow only nested shipping-counter updates.
CREATE OR REPLACE FUNCTION siteflow_allocate_load_item() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE load_order uuid; item_order uuid; load_state text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.dispatched_quantity<>OLD.dispatched_quantity THEN
  IF pg_trigger_depth()<=1 OR (to_jsonb(NEW)-'dispatched_quantity') IS DISTINCT FROM (to_jsonb(OLD)-'dispatched_quantity') THEN RAISE EXCEPTION 'Dispatch counter is internal'; END IF; RETURN NEW;
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
CREATE FUNCTION siteflow_dispatch_item_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE shipment dispatches; parent uuid; BEGIN
 IF TG_OP='UPDATE' AND NEW.delivered_quantity<>OLD.delivered_quantity AND pg_trigger_depth()>1 AND (to_jsonb(NEW)-'delivered_quantity')=(to_jsonb(OLD)-'delivered_quantity') THEN RETURN NEW; END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Shipment lines are immutable'; END IF;
 SELECT * INTO shipment FROM dispatches WHERE id=NEW.dispatch_id FOR UPDATE;
 SELECT load_id INTO parent FROM production_load_items WHERE id=NEW.load_item_id;
 IF shipment.status<>'draft' OR shipment.load_id IS DISTINCT FROM parent THEN RAISE EXCEPTION 'Invalid shipment load item'; END IF;
 UPDATE production_load_items SET dispatched_quantity=dispatched_quantity+NEW.quantity WHERE id=NEW.load_item_id;
 RETURN NEW;
END $$;
CREATE TRIGGER dispatch_item_guard BEFORE INSERT OR UPDATE OR DELETE ON dispatch_items FOR EACH ROW EXECUTE FUNCTION siteflow_dispatch_item_guard();
CREATE FUNCTION siteflow_dispatch_funded(shipment_id uuid) RETURNS void LANGUAGE plpgsql AS $$ DECLARE shipment dispatches; due numeric; BEGIN
 SELECT * INTO shipment FROM dispatches WHERE id=shipment_id;
 IF NOT EXISTS(SELECT 1 FROM production_loads WHERE id=shipment.load_id AND status IN ('factory_ready','dispatched')) THEN RAISE EXCEPTION 'Factory readiness required'; END IF;
 SELECT (data->>'dueBeforeDispatch')::numeric INTO due FROM order_stages WHERE order_id=shipment.order_id AND number=2 AND status='completed';
 IF due IS NULL THEN RAISE EXCEPTION 'Approved contract required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payment_milestones WHERE load_id=shipment.load_id AND before_dispatch) OR EXISTS(SELECT 1 FROM payment_milestones WHERE load_id=shipment.load_id AND before_dispatch AND allocated_amount<amount) THEN RAISE EXCEPTION 'Unfunded load payment milestone'; END IF;
 IF (SELECT coalesce(sum(amount),0) FROM payments WHERE order_id=shipment.order_id AND status='verified')<due THEN RAISE EXCEPTION 'Contractual cumulative payment is unverified'; END IF;
 IF NOT EXISTS(SELECT 1 FROM commerce_files WHERE dispatch_id=shipment.id) THEN RAISE EXCEPTION 'Delivery challan required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM dispatch_items WHERE dispatch_id=shipment.id) THEN RAISE EXCEPTION 'Dispatch items required'; END IF;
END $$;
CREATE FUNCTION siteflow_dispatch_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Preserve shipment history'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'draft' OR NOT EXISTS(SELECT 1 FROM production_loads WHERE id=NEW.load_id AND order_id=NEW.order_id) THEN RAISE EXCEPTION 'Invalid shipment identity'; END IF; RETURN NEW;
 END IF;
 IF (to_jsonb(NEW)-ARRAY['status','dispatched_at','approved_by','approved_at','version','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','dispatched_at','approved_by','approved_at','version','updated_at']) THEN RAISE EXCEPTION 'Shipment details are immutable'; END IF;
 IF NEW.status='cancelled' AND OLD.status IN ('draft','approved') THEN
  UPDATE production_load_items i SET dispatched_quantity=i.dispatched_quantity-x.quantity FROM dispatch_items x WHERE x.dispatch_id=OLD.id AND i.id=x.load_item_id;
 ELSIF OLD.status='draft' AND NEW.status='approved' THEN
  PERFORM siteflow_dispatch_funded(OLD.id); IF NEW.approved_by IS NULL OR NEW.approved_at IS NULL THEN RAISE EXCEPTION 'Approval identity required'; END IF;
 ELSIF OLD.status='approved' AND NEW.status='dispatched' THEN
  PERFORM siteflow_dispatch_funded(OLD.id); IF NEW.dispatched_at IS NULL THEN RAISE EXCEPTION 'Dispatch date required'; END IF;
 ELSIF OLD.status IN ('dispatched','partially_delivered') AND NEW.status IN ('partially_delivered','delivered') AND pg_trigger_depth()>1 THEN NULL;
 ELSE RAISE EXCEPTION 'Invalid dispatch transition'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER dispatch_guard BEFORE INSERT OR UPDATE OR DELETE ON dispatches FOR EACH ROW EXECUTE FUNCTION siteflow_dispatch_guard();
--> statement-breakpoint
CREATE FUNCTION siteflow_delivery_item_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE parent uuid; actual uuid; state text; BEGIN
 SELECT dispatch_id,status INTO parent,state FROM deliveries WHERE id=NEW.delivery_id;
 SELECT dispatch_id INTO actual FROM dispatch_items WHERE id=NEW.dispatch_item_id;
 IF state<>'draft' OR parent IS DISTINCT FROM actual THEN RAISE EXCEPTION 'Invalid delivery line'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER delivery_item_guard BEFORE INSERT ON delivery_items FOR EACH ROW EXECUTE FUNCTION siteflow_delivery_item_guard();
CREATE FUNCTION siteflow_delivery_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE line record; shipped numeric; consumed numeric; BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Preserve delivery history'; END IF;
 IF TG_OP='INSERT' THEN IF NEW.status<>'draft' THEN RAISE EXCEPTION 'Create draft delivery first'; END IF; RETURN NEW; END IF;
 IF OLD.status='draft' AND NEW.status='cancelled' AND (to_jsonb(NEW)-ARRAY['status','version','updated_at'])=(to_jsonb(OLD)-ARRAY['status','version','updated_at']) THEN RETURN NEW; END IF;
 IF OLD.status<>'draft' OR NEW.status<>'confirmed' OR NEW.confirmed_by IS NULL OR NEW.confirmed_at IS NULL THEN RAISE EXCEPTION 'Invalid delivery confirmation'; END IF;
 IF (to_jsonb(NEW)-ARRAY['status','confirmed_by','confirmed_at','version','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','confirmed_by','confirmed_at','version','updated_at']) THEN RAISE EXCEPTION 'Delivery evidence is immutable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM dispatches WHERE id=NEW.dispatch_id AND status IN ('dispatched','partially_delivered')) OR NOT EXISTS(SELECT 1 FROM commerce_files WHERE delivery_id=NEW.id) OR NOT EXISTS(SELECT 1 FROM delivery_items WHERE delivery_id=NEW.id) THEN RAISE EXCEPTION 'Shipment and proof of delivery required'; END IF;
 FOR line IN SELECT * FROM delivery_items WHERE delivery_id=NEW.id ORDER BY dispatch_item_id LOOP
  SELECT quantity,delivered_quantity INTO shipped,consumed FROM dispatch_items WHERE id=line.dispatch_item_id FOR UPDATE;
  IF line.received+line.missing>shipped-consumed THEN RAISE EXCEPTION 'Delivery exceeds remaining shipped quantity'; END IF;
  UPDATE dispatch_items SET delivered_quantity=delivered_quantity+line.received WHERE id=line.dispatch_item_id;
 END LOOP;
 UPDATE dispatches SET status=CASE WHEN EXISTS(SELECT 1 FROM dispatch_items WHERE dispatch_id=NEW.dispatch_id AND delivered_quantity<quantity) THEN 'partially_delivered' ELSE 'delivered' END,version=version+1,updated_at=now() WHERE id=NEW.dispatch_id;
 RETURN NEW;
END $$;
CREATE TRIGGER delivery_guard BEFORE INSERT OR UPDATE OR DELETE ON deliveries FOR EACH ROW EXECUTE FUNCTION siteflow_delivery_guard();
