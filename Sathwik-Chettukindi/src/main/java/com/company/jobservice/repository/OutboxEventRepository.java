package com.company.jobservice.repository;

import com.company.jobservice.domain.OutboxEvent;
import com.company.jobservice.domain.OutboxStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, UUID> {

    /**
     * Claims due PENDING events. SKIP LOCKED lets several relay instances run
     * concurrently without picking the same rows. Must be called inside a transaction.
     */
    @Query(value = """
            SELECT * FROM outbox_events
            WHERE status = 'PENDING' AND next_attempt_at <= :now
            ORDER BY next_attempt_at, created_at
            LIMIT :batchSize
            FOR UPDATE SKIP LOCKED
            """, nativeQuery = true)
    List<OutboxEvent> lockDuePending(@Param("now") Instant now, @Param("batchSize") int batchSize);

    long countByStatus(OutboxStatus status);

    List<OutboxEvent> findByRequestId(String requestId);
}
