CREATE TYPE question_type AS ENUM (
    'TEXT',
    'NUMBER',
    'BOOLEAN',
    'DATE',
    'SINGLE_CHOICE',
    'MULTI_CHOICE'
);

CREATE TABLE questions (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    text       TEXT          NOT NULL,
    type       question_type NOT NULL,
    options    TEXT[],
    created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
    -- Choice questions must list their options; other types must not.
    CONSTRAINT questions_options_match_type CHECK (
        (type IN ('SINGLE_CHOICE', 'MULTI_CHOICE')) = (COALESCE(cardinality(options), 0) > 0)
    )
);

CREATE TABLE forms (
    id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE form_questions (
    form_id       BIGINT  NOT NULL REFERENCES forms (id) ON DELETE CASCADE,
    question_id   BIGINT  NOT NULL REFERENCES questions (id),
    display_order INT     NOT NULL,
    is_required   BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (form_id, question_id)
);

CREATE INDEX idx_form_questions_question_id ON form_questions (question_id);
