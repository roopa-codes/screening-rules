package com.company.jobservice.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;

/**
 * Append-only audit entry. {@link Immutable} stops Hibernate from issuing UPDATEs;
 * the database trigger rejects UPDATE/DELETE/TRUNCATE regardless.
 */
@Entity
@Immutable
@Table(name = "rule_audit")
@Getter
@Setter
@NoArgsConstructor
public class RuleAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false, nullable = false)
    private Long id;

    @Column(name = "rule_id", nullable = false, length = 64)
    private String ruleId;

    @Column(name = "job_id", nullable = false, length = 64)
    private String jobId;

    @Column(name = "from_version")
    private Integer fromVersion;

    @Column(name = "to_version", nullable = false)
    private Integer toVersion;

    @Column(name = "user_id", nullable = false, length = 128)
    private String userId;

    @Column(name = "user_name", length = 256)
    private String userName;

    @Column(name = "role", nullable = false, length = 64)
    private String role;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "old_value", columnDefinition = "jsonb")
    private String oldValue;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "new_value", nullable = false, columnDefinition = "jsonb")
    private String newValue;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "changed_fields", columnDefinition = "jsonb")
    private List<String> changedFields;

    @Column(name = "change_reason", nullable = false, length = 500)
    private String changeReason;

    @Column(name = "request_id", length = 64)
    private String requestId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
