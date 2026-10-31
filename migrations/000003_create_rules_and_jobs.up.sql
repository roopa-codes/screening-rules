CREATE TYPE version_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- How a rule compares the candidate's answer with rule_versions.value:
--   EQ, NEQ           value = 5 / true / "Hyderabad"
--   GT, GTE, LT, LTE  value = 3
--   BETWEEN           value = [2, 8]  (inclusive)
--   IN, NOT_IN        value = ["Hyderabad", "Bangalore"]
CREATE TYPE rule_operator AS ENUM ('EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IN', 'NOT_IN');

CREATE TYPE rule_action AS ENUM ('REJECT', 'REVIEW');

CREATE TYPE job_status AS ENUM ('OPEN', 'CLOSED');

-- The rule on a question. It applies in every form that uses the question.
-- This row never changes; what it checks lives in rule_versions.
CREATE TABLE rules (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    question_id BIGINT      NOT NULL UNIQUE REFERENCES questions (id),
    created_by  BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Each edit of a rule is a new version. A published version is never changed:
-- add the next version_no, publish it, and archive the old one.
CREATE TABLE rule_versions (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rule_id      BIGINT         NOT NULL REFERENCES rules (id) ON DELETE CASCADE,
    version_no   INT            NOT NULL,
    operator     rule_operator  NOT NULL,
    value        JSONB          NOT NULL,
    on_fail      rule_action    NOT NULL DEFAULT 'REJECT',
    on_missing   rule_action    NOT NULL DEFAULT 'REVIEW',
    status       version_status NOT NULL DEFAULT 'DRAFT',
    created_by   BIGINT         REFERENCES users (id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    UNIQUE (rule_id, version_no)
);

-- At most one published version per rule; that is the one screening uses.
CREATE UNIQUE INDEX uq_rule_versions_published
    ON rule_versions (rule_id) WHERE status = 'PUBLISHED';

-- A job's rules: job -> form -> form_questions -> rules -> published version.
CREATE TABLE jobs (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title      TEXT        NOT NULL,
    form_id    BIGINT      NOT NULL REFERENCES forms (id),
    status     job_status  NOT NULL DEFAULT 'OPEN',
    created_by BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_form_id ON jobs (form_id);
CREATE INDEX idx_jobs_status ON jobs (status);
