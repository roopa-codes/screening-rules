-- =====================================================================
-- rule_versions: one row per version of a rule. Rows are never edited
-- in place; an update inserts version N+1 and flips is_current on N.
-- =====================================================================
CREATE TABLE rule_versions (
    id               BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rule_id          VARCHAR(64)  NOT NULL,
    version          INTEGER      NOT NULL,
    job_id           VARCHAR(64)  NOT NULL,
    question_key     VARCHAR(128) NOT NULL,
    operator         VARCHAR(64)  NOT NULL,
    params           JSONB        NOT NULL,
    on_not_met       VARCHAR(16)  NOT NULL,
    on_missing       VARCHAR(16)  NOT NULL DEFAULT 'REVIEW',
    message_template VARCHAR(1000),
    is_current       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_by       VARCHAR(128) NOT NULL,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT uq_rule_versions_rule_version UNIQUE (rule_id, version),
    CONSTRAINT ck_rule_versions_version_positive CHECK (version >= 1),
    CONSTRAINT ck_rule_versions_on_not_met CHECK (on_not_met IN ('FAIL', 'REVIEW')),
    CONSTRAINT ck_rule_versions_on_missing CHECK (on_missing IN ('FAIL', 'REVIEW')),
    CONSTRAINT ck_rule_versions_params_object CHECK (jsonb_typeof(params) = 'object')
);

-- At most one current version per rule.
CREATE UNIQUE INDEX uq_rule_versions_one_current
    ON rule_versions (rule_id)
    WHERE is_current;

CREATE INDEX ix_rule_versions_job_rule
    ON rule_versions (job_id, rule_id);

-- =====================================================================
-- rule_audit: append-only audit trail of rule changes.
-- =====================================================================
CREATE TABLE rule_audit (
    id            BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rule_id       VARCHAR(64)  NOT NULL,
    job_id        VARCHAR(64)  NOT NULL,
    from_version  INTEGER,
    to_version    INTEGER      NOT NULL,
    user_id       VARCHAR(128) NOT NULL,
    user_name     VARCHAR(256),
    role          VARCHAR(64)  NOT NULL,
    old_value     JSONB,
    new_value     JSONB        NOT NULL,
    change_reason VARCHAR(500) NOT NULL,
    request_id    VARCHAR(64),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT ck_rule_audit_versions CHECK (from_version IS NULL OR to_version > from_version)
);

CREATE INDEX ix_rule_audit_rule_created
    ON rule_audit (rule_id, created_at DESC);

CREATE OR REPLACE FUNCTION rule_audit_reject_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'rule_audit is append-only: % is not allowed', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER trg_rule_audit_no_update_delete
    BEFORE UPDATE OR DELETE ON rule_audit
    FOR EACH ROW
    EXECUTE FUNCTION rule_audit_reject_modification();

-- Row triggers do not fire on TRUNCATE, so block it separately.
CREATE TRIGGER trg_rule_audit_no_truncate
    BEFORE TRUNCATE ON rule_audit
    FOR EACH STATEMENT
    EXECUTE FUNCTION rule_audit_reject_modification();

-- =====================================================================
-- outbox_events: transactional outbox, relayed to SQS asynchronously.
-- =====================================================================
CREATE TABLE outbox_events (
    id              UUID         PRIMARY KEY,
    job_id          VARCHAR(64)  NOT NULL,
    aggregate_id    VARCHAR(64)  NOT NULL,
    event_type      VARCHAR(64)  NOT NULL,
    payload         JSONB        NOT NULL,
    status          VARCHAR(16)  NOT NULL DEFAULT 'PENDING',
    attempts        INTEGER      NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_error      VARCHAR(2000),
    request_id      VARCHAR(64),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    sent_at         TIMESTAMPTZ,

    CONSTRAINT ck_outbox_events_status CHECK (status IN ('PENDING', 'SENT', 'DEAD')),
    CONSTRAINT ck_outbox_events_attempts CHECK (attempts >= 0),
    CONSTRAINT ck_outbox_events_sent_at CHECK (status <> 'SENT' OR sent_at IS NOT NULL)
);

CREATE INDEX ix_outbox_events_status_next_attempt
    ON outbox_events (status, next_attempt_at);
