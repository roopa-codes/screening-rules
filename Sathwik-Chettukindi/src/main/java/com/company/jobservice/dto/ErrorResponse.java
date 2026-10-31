package com.company.jobservice.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record ErrorResponse(
        OffsetDateTime timestamp,
        int status,
        String error,
        String code,
        String message,
        String path,
        String requestId,
        List<FieldError> fieldErrors) {

    public record FieldError(String field, String message) {
    }
}
