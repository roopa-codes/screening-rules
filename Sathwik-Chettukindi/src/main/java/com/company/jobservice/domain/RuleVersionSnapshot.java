package com.company.jobservice.domain;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * One immutable version of a rule, stored as a value inside rules.versions.
 */
public record RuleVersionSnapshot(
        String questionKey,
        String operator,
        Map<String, Object> params,
        RuleAction onNotMet,
        RuleAction onMissing,
        String messageTemplate,
        String createdBy,
        OffsetDateTime createdAt,
        String changeReason) {
}
