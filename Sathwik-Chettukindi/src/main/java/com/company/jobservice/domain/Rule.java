package com.company.jobservice.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * One row per rule; every version lives in {@link #versions}, keyed by version number.
 *
 * Read-only for Hibernate ({@link Immutable}): new versions are appended with
 * {@link com.company.jobservice.repository.RuleRepository#appendVersion}, a single SQL
 * statement that adds one key with jsonb ||. Hibernate therefore never re-serializes and
 * rewrites existing versions, so they cannot drift (e.g. timestamp formatting) and trip
 * the immutability trigger.
 */
@Entity
@Immutable
@Table(name = "rules")
@Getter
@Setter
@NoArgsConstructor
public class Rule {

    @Id
    @Column(name = "rule_id", nullable = false, columnDefinition = "text")
    private String ruleId;

    @Column(name = "job_id", nullable = false, columnDefinition = "text")
    private String jobId;

    @Column(name = "current_version", nullable = false)
    private int currentVersion;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "versions", nullable = false, columnDefinition = "jsonb")
    private Map<String, RuleVersionSnapshot> versions = new LinkedHashMap<>();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public RuleVersionSnapshot version(int version) {
        return versions.get(Integer.toString(version));
    }

    public RuleVersionSnapshot currentSnapshot() {
        return version(currentVersion);
    }
}
