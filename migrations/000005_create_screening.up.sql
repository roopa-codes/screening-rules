CREATE TYPE rule_check AS ENUM ('PASS', 'FAIL', 'MISSING');

-- One screening run of an application. Which rule versions were used
-- is recorded per rule in rule_results.
CREATE TABLE screening_evaluations (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    application_id BIGINT            NOT NULL REFERENCES applications (id),
    outcome        screening_outcome NOT NULL,
    is_current     BOOLEAN           NOT NULL DEFAULT TRUE,
    evaluated_at   TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE INDEX idx_screening_evaluations_application_id ON screening_evaluations (application_id);

-- At most one current evaluation per application.
CREATE UNIQUE INDEX uq_screening_evaluations_current
    ON screening_evaluations (application_id) WHERE is_current;

-- Why the evaluation came out the way it did: one row per rule,
-- pointing at the exact rule version that was checked.
CREATE TABLE rule_results (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    evaluation_id   BIGINT     NOT NULL REFERENCES screening_evaluations (id) ON DELETE CASCADE,
    rule_version_id BIGINT     NOT NULL REFERENCES rule_versions (id),
    result          rule_check NOT NULL,
    reason          TEXT       NOT NULL,
    UNIQUE (evaluation_id, rule_version_id)
);

CREATE INDEX idx_rule_results_rule_version_id ON rule_results (rule_version_id);

-- A person changing the outcome. The evaluation itself is never edited.
CREATE TABLE overrides (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    application_id BIGINT            NOT NULL REFERENCES applications (id),
    evaluation_id  BIGINT            NOT NULL REFERENCES screening_evaluations (id),
    from_outcome   screening_outcome NOT NULL,
    to_outcome     screening_outcome NOT NULL,
    comment        TEXT              NOT NULL,
    overridden_by  BIGINT            NOT NULL REFERENCES users (id),
    is_active      BOOLEAN           NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE INDEX idx_overrides_evaluation_id ON overrides (evaluation_id);

-- At most one active override per application.
CREATE UNIQUE INDEX uq_overrides_active
    ON overrides (application_id) WHERE is_active;
