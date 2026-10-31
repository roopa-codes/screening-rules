-- =====================================================================
-- V2: replace rule_versions (one row per version) with rules (one row per
-- rule, all versions inside a JSONB object keyed by version number).
-- =====================================================================

CREATE TABLE rules (
    rule_id         TEXT        PRIMARY KEY,
    job_id          TEXT        NOT NULL,
    current_version INT         NOT NULL CHECK (current_version >= 1),
    versions        JSONB       NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_rules_versions_object CHECK (jsonb_typeof(versions) = 'object'),
    -- jsonb_exists(a, b) is the function behind the "a ? b" operator; used so no '?'
    -- reaches the JDBC driver, which treats it as a bind placeholder.
    CONSTRAINT ck_rules_current_version_present CHECK (jsonb_exists(versions, current_version::text))
);

CREATE INDEX ix_rules_job_id ON rules (job_id);

-- ---------------------------------------------------------------------
-- Migrate existing data. A rule_id spread over several job_ids cannot be
-- represented in one row, so the migration fails loudly instead of guessing.
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM rule_versions GROUP BY rule_id HAVING count(DISTINCT job_id) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot migrate: a rule_id belongs to more than one job_id';
    END IF;
END;
$$;

INSERT INTO rules (rule_id, job_id, current_version, versions, updated_at)
SELECT rv.rule_id,
       min(rv.job_id),
       max(rv.version),
       jsonb_object_agg(
           rv.version::text,
           jsonb_build_object(
               'questionKey',     rv.question_key,
               'operator',        rv.operator,
               'params',          rv.params,
               'onNotMet',        rv.on_not_met,
               'onMissing',       rv.on_missing,
               'messageTemplate', rv.message_template,
               'createdBy',       rv.created_by,
               'createdAt',       to_char(rv.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
               'changeReason',    reason.change_reason)),
       max(rv.created_at)
FROM rule_versions rv
LEFT JOIN LATERAL (
    SELECT a.change_reason
    FROM rule_audit a
    WHERE a.rule_id = rv.rule_id AND a.to_version = rv.version
    ORDER BY a.created_at DESC
    LIMIT 1
) reason ON TRUE
GROUP BY rv.rule_id;

DROP TABLE rule_versions;

-- ---------------------------------------------------------------------
-- Immutability guard: existing versions can never change or disappear,
-- current_version never goes backwards, identity columns never change,
-- and rows cannot be deleted or truncated.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rules_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
        RAISE EXCEPTION 'rules: % is not allowed', TG_OP
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NEW.rule_id IS DISTINCT FROM OLD.rule_id OR NEW.job_id IS DISTINCT FROM OLD.job_id THEN
        RAISE EXCEPTION 'rules: rule_id and job_id are immutable'
            USING ERRCODE = 'check_violation';
    END IF;

    IF NOT (NEW.versions @> OLD.versions) THEN
        RAISE EXCEPTION 'rules: existing versions must not be modified or removed'
            USING ERRCODE = 'check_violation';
    END IF;

    -- @> is containment, not equality: for nested arrays it accepts additions
    -- (e.g. ["a"] -> ["a","b"]). This check requires each old version to be identical.
    IF EXISTS (
        SELECT 1 FROM jsonb_each(OLD.versions) AS o
        WHERE NEW.versions -> o.key IS DISTINCT FROM o.value
    ) THEN
        RAISE EXCEPTION 'rules: existing versions must not be modified or removed'
            USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.current_version < OLD.current_version THEN
        RAISE EXCEPTION 'rules: current_version cannot decrease'
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rules_guard_update
    BEFORE UPDATE ON rules
    FOR EACH ROW
    EXECUTE FUNCTION rules_guard();

CREATE TRIGGER trg_rules_guard_delete
    BEFORE DELETE ON rules
    FOR EACH ROW
    EXECUTE FUNCTION rules_guard();

CREATE TRIGGER trg_rules_guard_truncate
    BEFORE TRUNCATE ON rules
    FOR EACH STATEMENT
    EXECUTE FUNCTION rules_guard();

-- ---------------------------------------------------------------------
-- rule_audit gains changed_fields (JSON array of field names).
-- ADD COLUMN does not fire the append-only row trigger.
-- ---------------------------------------------------------------------
ALTER TABLE rule_audit ADD COLUMN changed_fields JSONB;
