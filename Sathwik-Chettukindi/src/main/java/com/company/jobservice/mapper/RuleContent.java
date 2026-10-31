package com.company.jobservice.mapper;

import com.company.jobservice.domain.RuleAction;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * Normalized, comparable rule content. JsonNode equality is structural, so params that
 * differ only in key order are equal.
 */
public record RuleContent(
        String questionKey,
        String operator,
        JsonNode params,
        RuleAction onNotMet,
        RuleAction onMissing,
        String messageTemplate) {
}
