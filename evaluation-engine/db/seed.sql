-- Demo data: "Pharmacist – Hyderabad" from the problem statement.

INSERT INTO roles (name) VALUES ('RECRUITER');
INSERT INTO users (role_id, full_name, email, password_hash) VALUES (1, 'Demo Recruiter', 'recruiter@example.com', 'x');

INSERT INTO rule_types (code, description) VALUES
  ('IN_LIST',    'Answer must be one of params.values'),
  ('MIN_NUMBER', 'Numeric answer >= params.min'),
  ('MAX_NUMBER', 'Numeric answer <= params.max'),
  ('BOOLEAN',    'Yes/No answer must equal params.expected');

-- label is used in reasons ("location Pune is not an allowed location"); rules.params.label can override it.
INSERT INTO questions (question_key, label, answer_type) VALUES
  ('location',             'location',         'TEXT'),
  ('experience_years',     'experience',       'NUMBER'),
  ('has_pharmacy_license', 'pharmacy license', 'BOOLEAN');

INSERT INTO forms (name) VALUES ('Pharmacist form');
INSERT INTO form_questions (form_id, question_id, display_order, is_required) VALUES
  (1, 1, 1, true), (1, 2, 2, true), (1, 3, 3, false);

INSERT INTO jobs (title, form_id, created_by) VALUES ('Pharmacist – Hyderabad', 1, 1);

INSERT INTO rule_set_versions (job_id, version_no, status, created_by) VALUES (1, 1, 'ACTIVE', 1);
INSERT INTO rules (rule_set_version_id, rule_code, question_id, rule_type_code, params, on_fail, on_missing) VALUES
  (1, 'R1', 1, 'IN_LIST',    '{"values": ["Hyderabad", "Secunderabad"]}', 'FAIL',   'REVIEW'),
  (1, 'R2', 2, 'MIN_NUMBER', '{"min": 3, "unit": "years"}',               'REVIEW', 'REVIEW'),
  (1, 'R3', 3, 'BOOLEAN',    '{"expected": true}',                         'FAIL',   'REVIEW');

INSERT INTO candidates (full_name, email) VALUES
  ('Asha',  'asha@example.com'),
  ('Ravi',  'ravi@example.com'),
  ('Meena', 'meena@example.com'),
  ('Kiran', 'kiran@example.com');

INSERT INTO applications (job_id, candidate_id) VALUES (1, 1), (1, 2), (1, 3), (1, 4);
INSERT INTO application_answers (application_id, question_id, value) VALUES
  (1, 1, '"Pune"'),      (1, 2, '5'), (1, 3, 'true'),
  (2, 1, '"Hyderabad"'), (2, 2, '2'), (2, 3, 'true'),
  (3, 1, '"Hyderabad"'), (3, 2, '6'), (3, 3, 'true'),
  (4, 1, '"Hyderabad"'), (4, 2, '4');  -- license question unanswered
