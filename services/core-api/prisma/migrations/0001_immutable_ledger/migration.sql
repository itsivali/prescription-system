-- Enforce append-only semantics on LedgerTransaction at the database layer.
-- Application code cannot bypass this even with raw SQL access.

CREATE OR REPLACE FUNCTION reject_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'LedgerTransaction is append-only (op=%, id=%)',
    TG_OP, COALESCE(OLD.id, NEW.id);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_no_update ON "LedgerTransaction";
CREATE TRIGGER ledger_no_update
  BEFORE UPDATE OR DELETE ON "LedgerTransaction"
  FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

-- Defense-in-depth: revoke UPDATE/DELETE from the application role too.
-- Replace `hospital_app` with whatever role your DATABASE_URL connects as.
REVOKE UPDATE, DELETE ON "LedgerTransaction" FROM PUBLIC;
