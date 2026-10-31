-- One row per change. The app writes it in the same transaction as the change.
CREATE TABLE audit_logs (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_user_id BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    action        TEXT        NOT NULL,
    entity_type   TEXT        NOT NULL,
    entity_id     BIGINT      NOT NULL,
    before_data   JSONB,
    after_data    JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
