-- A role carries its permissions as a list, e.g. {'JOB_CREATE','RULES_PUBLISH'}.
-- Check with: 'RULES_PUBLISH' = ANY(roles.permissions)
CREATE TABLE roles (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        TEXT   NOT NULL UNIQUE,
    permissions TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_id       BIGINT      NOT NULL REFERENCES roles (id),
    full_name     TEXT        NOT NULL,
    email         TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role_id ON users (role_id);
