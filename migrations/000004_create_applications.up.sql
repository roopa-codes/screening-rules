CREATE TYPE screening_outcome AS ENUM ('PASS', 'REVIEW', 'REJECT');

CREATE TABLE candidates (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name  TEXT        NOT NULL,
    email      TEXT        NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE applications (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_id        BIGINT            NOT NULL REFERENCES jobs (id),
    candidate_id  BIGINT            NOT NULL REFERENCES candidates (id),
    final_outcome screening_outcome,
    submitted_at  TIMESTAMPTZ       NOT NULL DEFAULT now(),
    UNIQUE (job_id, candidate_id)
);

CREATE INDEX idx_applications_job_id_final_outcome ON applications (job_id, final_outcome);
CREATE INDEX idx_applications_candidate_id ON applications (candidate_id);

-- One answer per question. Exactly one value column is filled, chosen by questions.type:
--   TEXT -> text_value, NUMBER -> number_value, BOOLEAN -> bool_value,
--   DATE -> date_value, SINGLE_CHOICE / MULTI_CHOICE -> choice_values
-- A question left blank has no row.
CREATE TABLE application_answers (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    application_id BIGINT      NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
    question_id    BIGINT      NOT NULL REFERENCES questions (id),
    text_value     TEXT,
    number_value   NUMERIC,
    bool_value     BOOLEAN,
    date_value     DATE,
    choice_values  TEXT[],
    answered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (application_id, question_id),
    CONSTRAINT application_answers_one_value CHECK (
        num_nonnulls(text_value, number_value, bool_value, date_value, choice_values) = 1
    )
);

CREATE INDEX idx_application_answers_question_id ON application_answers (question_id);
