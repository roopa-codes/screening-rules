-- Generated from the team DBML design. Keep in sync with the shared design.

CREATE TABLE roles (
  id   serial PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE permissions (
  id   serial PRIMARY KEY,
  code text NOT NULL UNIQUE
);

CREATE TABLE role_permissions (
  role_id       bigint NOT NULL REFERENCES roles(id),
  permission_id bigint NOT NULL REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id            serial PRIMARY KEY,
  role_id       bigint NOT NULL REFERENCES roles(id),
  full_name     text NOT NULL,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamp DEFAULT now()
);
CREATE INDEX ON users (role_id);

CREATE TABLE questions (
  id           serial PRIMARY KEY,
  question_key text NOT NULL UNIQUE,
  label        text NOT NULL,
  answer_type  text NOT NULL,
  options      jsonb
);

CREATE TABLE forms (
  id   serial PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE form_questions (
  form_id       bigint NOT NULL REFERENCES forms(id),
  question_id   bigint NOT NULL REFERENCES questions(id),
  display_order int NOT NULL,
  is_required   boolean NOT NULL DEFAULT false,
  PRIMARY KEY (form_id, question_id)
);

CREATE TABLE jobs (
  id         serial PRIMARY KEY,
  title      text NOT NULL,
  form_id    bigint NOT NULL REFERENCES forms(id),
  status     text NOT NULL DEFAULT 'OPEN',
  created_by bigint REFERENCES users(id),
  created_at timestamp DEFAULT now()
);
CREATE INDEX ON jobs (form_id);
CREATE INDEX ON jobs (status);

CREATE TABLE rule_types (
  code        text PRIMARY KEY,
  description text
);

CREATE TABLE rule_set_versions (
  id         serial PRIMARY KEY,
  job_id     bigint NOT NULL REFERENCES jobs(id),
  version_no int NOT NULL,
  status     text NOT NULL DEFAULT 'DRAFT',
  created_by bigint REFERENCES users(id),
  created_at timestamp DEFAULT now(),
  UNIQUE (job_id, version_no)
);
CREATE INDEX ON rule_set_versions (job_id, status);

CREATE TABLE rules (
  id                  serial PRIMARY KEY,
  rule_set_version_id bigint NOT NULL REFERENCES rule_set_versions(id),
  rule_code           text NOT NULL,
  question_id         bigint NOT NULL REFERENCES questions(id),
  rule_type_code      text NOT NULL REFERENCES rule_types(code),
  params              jsonb NOT NULL,
  on_fail             text NOT NULL,
  on_missing          text NOT NULL DEFAULT 'REVIEW',
  UNIQUE (rule_set_version_id, rule_code)
);
CREATE INDEX ON rules (question_id);

CREATE TABLE candidates (
  id        serial PRIMARY KEY,
  full_name text NOT NULL,
  email     text NOT NULL UNIQUE
);

CREATE TABLE applications (
  id            serial PRIMARY KEY,
  job_id        bigint NOT NULL REFERENCES jobs(id),
  candidate_id  bigint NOT NULL REFERENCES candidates(id),
  final_outcome text,
  submitted_at  timestamp NOT NULL DEFAULT now(),
  UNIQUE (job_id, candidate_id)
);
CREATE INDEX ON applications (job_id, final_outcome);

CREATE TABLE application_answers (
  id             serial PRIMARY KEY,
  application_id bigint NOT NULL REFERENCES applications(id),
  question_id    bigint NOT NULL REFERENCES questions(id),
  value          jsonb,
  UNIQUE (application_id, question_id)
);

CREATE TABLE screening_evaluations (
  id                  serial PRIMARY KEY,
  application_id      bigint NOT NULL REFERENCES applications(id),
  rule_set_version_id bigint NOT NULL REFERENCES rule_set_versions(id),
  outcome             text NOT NULL,
  reason              text NOT NULL,
  is_current          boolean NOT NULL DEFAULT true,
  evaluated_at        timestamp DEFAULT now(),
  UNIQUE (application_id, rule_set_version_id)
);
CREATE INDEX ON screening_evaluations (application_id, is_current);

CREATE TABLE rule_results (
  id            serial PRIMARY KEY,
  evaluation_id bigint NOT NULL REFERENCES screening_evaluations(id),
  rule_id       bigint NOT NULL REFERENCES rules(id),
  outcome       text NOT NULL,
  actual_value  jsonb,
  reason        text NOT NULL,
  UNIQUE (evaluation_id, rule_id)
);

CREATE TABLE overrides (
  id             serial PRIMARY KEY,
  application_id bigint NOT NULL REFERENCES applications(id),
  evaluation_id  bigint NOT NULL REFERENCES screening_evaluations(id),
  from_outcome   text NOT NULL,
  to_outcome     text NOT NULL,
  comment        text NOT NULL,
  overridden_by  bigint NOT NULL REFERENCES users(id),
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamp DEFAULT now()
);
CREATE INDEX ON overrides (application_id, is_active);

CREATE TABLE audit_logs (
  id            serial PRIMARY KEY,
  actor_user_id bigint REFERENCES users(id),
  action        text NOT NULL,
  entity_type   text NOT NULL,
  entity_id     bigint NOT NULL,
  before_data   jsonb,
  after_data    jsonb,
  created_at    timestamp DEFAULT now()
);
CREATE INDEX ON audit_logs (entity_type, entity_id);
