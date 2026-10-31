package com.company.jobservice.exception;

import com.company.jobservice.dto.ErrorResponse;
import com.company.jobservice.logging.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

/**
 * Single place that builds the error body, shared by the controller advice and the
 * Spring Security 401/403 handlers so every error looks the same.
 */
public final class ErrorResponses {

    private ErrorResponses() {
    }

    public static ErrorResponse of(HttpStatus status, ErrorCode code, String message, HttpServletRequest request) {
        return of(status, code, message, request, List.of());
    }

    public static ErrorResponse of(HttpStatus status, ErrorCode code, String message, HttpServletRequest request,
                                   List<ErrorResponse.FieldError> fieldErrors) {
        return new ErrorResponse(
                OffsetDateTime.now(ZoneOffset.UTC),
                status.value(),
                status.getReasonPhrase(),
                code.name(),
                message,
                request.getRequestURI(),
                RequestIdFilter.current(request),
                fieldErrors);
    }
}
