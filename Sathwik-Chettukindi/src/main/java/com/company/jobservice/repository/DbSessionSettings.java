package com.company.jobservice.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Applies transaction-scoped PostgreSQL timeouts (SET LOCAL semantics) so a blocked
 * row lock fails fast instead of hanging. Must be called inside a transaction.
 */
@Component
public class DbSessionSettings {

    @PersistenceContext
    private EntityManager entityManager;

    private final long lockTimeoutMs;
    private final long statementTimeoutMs;

    public DbSessionSettings(@Value("${app.db.lock-timeout-ms:5000}") long lockTimeoutMs,
                             @Value("${app.db.statement-timeout-ms:10000}") long statementTimeoutMs) {
        this.lockTimeoutMs = lockTimeoutMs;
        this.statementTimeoutMs = statementTimeoutMs;
    }

    public void applyTimeouts() {
        entityManager.createNativeQuery(
                        "SELECT set_config('lock_timeout', :lock, true), set_config('statement_timeout', :stmt, true)")
                .setParameter("lock", lockTimeoutMs + "ms")
                .setParameter("stmt", statementTimeoutMs + "ms")
                .getSingleResult();
    }
}
