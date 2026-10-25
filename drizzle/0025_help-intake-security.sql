-- Location is descriptive ticket evidence, never an authorization branch identifier.
CREATE FUNCTION siteflow_help_location_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 -- Previous app instances omit this new field during rolling deployments.
 IF TG_OP='INSERT' AND NEW.location IS NULL THEN SELECT name INTO NEW.location FROM centres WHERE id=NEW.centre_id AND organization_id=NEW.organization_id; END IF;
 IF TG_OP='UPDATE' AND OLD.location IS DISTINCT FROM NEW.location THEN RAISE EXCEPTION 'Original ticket location is immutable'; END IF;
 IF TG_OP='INSERT' AND (NEW.location IS NULL OR length(btrim(NEW.location)) NOT BETWEEN 1 AND 200) THEN RAISE EXCEPTION 'Ticket location is required'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER help_location_guard BEFORE INSERT OR UPDATE ON help_tickets FOR EACH ROW EXECUTE FUNCTION siteflow_help_location_guard();
-- No role grants or browser policies are broadened. Company-scoped help lookup
-- and named-ticket participation are checked by the server on every operation.
