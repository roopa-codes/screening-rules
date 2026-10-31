package com.company.jobservice.dto;

import com.company.jobservice.domain.RuleAction;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateRuleRequest(
        @NotBlank @Size(max = 128) String questionKey,
        @NotBlank @Size(max = 64) String operator,
        @NotNull JsonNode params,
        @NotNull RuleAction onNotMet,
        RuleAction onMissing,
        @Size(max = 1000) String messageTemplate,
        @NotBlank @Size(min = 1, max = 500) String changeReason) {
}
