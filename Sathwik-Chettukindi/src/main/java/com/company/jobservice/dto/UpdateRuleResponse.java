package com.company.jobservice.dto;

import java.time.OffsetDateTime;

public record UpdateRuleResponse(
        String ruleId,
        int version,
        int previousVersion,
        String updatedBy,
        OffsetDateTime updatedAt) {
}
