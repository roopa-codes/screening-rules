package com.company.jobservice.repository;

import com.company.jobservice.domain.Rule;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface RuleRepository extends JpaRepository<Rule, String> {

    /** SELECT ... FOR UPDATE: concurrent updates of the same rule serialize on this row. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Rule r where r.ruleId = :ruleId and r.jobId = :jobId")
    Optional<Rule> findForUpdate(@Param("ruleId") String ruleId, @Param("jobId") String jobId);

    /**
     * Adds exactly one new key to versions and advances current_version. Existing keys
     * are untouched by construction (jsonb ||, and the WHERE refuses an existing key).
     * Returns 0 if current_version is no longer the expected one.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            UPDATE rules
               SET versions        = versions || jsonb_build_object(CAST(:newKey AS text), CAST(:snapshot AS jsonb)),
                   current_version = :newVersion,
                   updated_at      = :updatedAt
             WHERE rule_id = :ruleId
               AND job_id = :jobId
               AND current_version = :expectedVersion
               AND NOT jsonb_exists(versions, CAST(:newKey AS text))
            """, nativeQuery = true)
    int appendVersion(@Param("ruleId") String ruleId,
                      @Param("jobId") String jobId,
                      @Param("expectedVersion") int expectedVersion,
                      @Param("newVersion") int newVersion,
                      @Param("newKey") String newKey,
                      @Param("snapshot") String snapshotJson,
                      @Param("updatedAt") Instant updatedAt);
}
