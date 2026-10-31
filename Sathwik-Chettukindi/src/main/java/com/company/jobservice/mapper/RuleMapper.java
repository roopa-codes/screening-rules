package com.company.jobservice.mapper;

import com.company.jobservice.domain.RuleAction;
import com.company.jobservice.domain.RuleVersionSnapshot;
import com.company.jobservice.dto.UpdateRuleRequest;
import com.company.jobservice.exception.BadRequestException;
import com.company.jobservice.exception.ErrorCode;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Component
public class RuleMapper {

    private static final TypeReference<Map<String, Object>> PARAMS_TYPE = new TypeReference<>() {
    };

    private final ObjectMapper objectMapper;

    public RuleMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public RuleContent fromRequest(UpdateRuleRequest req) {
        JsonNode params = req.params();
        if (params == null || !params.isObject()) {
            throw new BadRequestException(ErrorCode.INVALID_PARAMS, "params must be a JSON object");
        }
        return new RuleContent(
                req.questionKey().trim(),
                req.operator().trim(),
                params,
                req.onNotMet(),
                req.onMissing() != null ? req.onMissing() : RuleAction.REVIEW,
                normalizeOptional(req.messageTemplate()));
    }

    /** Normalized content of a stored version; params become a JsonNode for structural comparison. */
    public RuleContent fromSnapshot(RuleVersionSnapshot s) {
        return new RuleContent(
                trimOrNull(s.questionKey()),
                trimOrNull(s.operator()),
                objectMapper.valueToTree(s.params() != null ? s.params() : Map.of()),
                s.onNotMet(),
                s.onMissing() != null ? s.onMissing() : RuleAction.REVIEW,
                normalizeOptional(s.messageTemplate()));
    }

    public RuleVersionSnapshot newSnapshot(RuleContent content, String createdBy, OffsetDateTime createdAt,
                                           String changeReason) {
        return new RuleVersionSnapshot(
                content.questionKey(),
                content.operator(),
                objectMapper.convertValue(content.params(), PARAMS_TYPE),
                content.onNotMet(),
                content.onMissing(),
                content.messageTemplate(),
                createdBy,
                createdAt,
                changeReason);
    }

    /** Names of the fields that differ between two versions, in a stable order. */
    public List<String> changedFields(RuleContent before, RuleContent after) {
        List<String> changed = new ArrayList<>();
        if (!Objects.equals(before.questionKey(), after.questionKey())) {
            changed.add("questionKey");
        }
        if (!Objects.equals(before.operator(), after.operator())) {
            changed.add("operator");
        }
        if (!Objects.equals(before.params(), after.params())) {
            changed.add("params");
        }
        if (before.onNotMet() != after.onNotMet()) {
            changed.add("onNotMet");
        }
        if (before.onMissing() != after.onMissing()) {
            changed.add("onMissing");
        }
        if (!Objects.equals(before.messageTemplate(), after.messageTemplate())) {
            changed.add("messageTemplate");
        }
        return changed;
    }

    public static OffsetDateTime toUtc(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }

    public String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize JSON", e);
        }
    }

    private static String trimOrNull(String value) {
        return value == null ? null : value.trim();
    }

    private static String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
