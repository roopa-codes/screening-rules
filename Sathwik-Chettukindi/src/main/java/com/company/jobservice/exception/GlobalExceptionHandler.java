package com.company.jobservice.exception;

import com.company.jobservice.dto.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.List;

/**
 * Maps exceptions to the single error body. Never returns stack traces, class names,
 * SQL or request content. 401/403 raised inside the security filter chain are handled by
 * {@link com.company.jobservice.security.JsonAuthenticationEntryPoint} and
 * {@link com.company.jobservice.security.JsonAccessDeniedHandler} with the same body.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private static final String LOCK_RETRY_AFTER_SECONDS = "1";

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApi(ApiException ex, HttpServletRequest req) {
        log.warn("Request rejected: code={} status={}", ex.getCode(), ex.getStatus().value());
        return build(ex.getStatus(), ex.getCode(), ex.getMessage(), req, List.of());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest req) {
        List<ErrorResponse.FieldError> fields = ex.getBindingResult().getFieldErrors().stream()
                .map(f -> new ErrorResponse.FieldError(f.getField(), f.getDefaultMessage()))
                .toList();
        log.warn("Validation failed: fields={}", fields.stream().map(ErrorResponse.FieldError::field).toList());
        return build(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, "Request validation failed", req, fields);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException ex, HttpServletRequest req) {
        log.warn("Malformed request body");
        return build(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED,
                "Malformed or unreadable request body", req, List.of());
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<ErrorResponse> handleMissingHeader(MissingRequestHeaderException ex, HttpServletRequest req) {
        log.warn("Missing header: {}", ex.getHeaderName());
        return build(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED,
                "Required header '" + ex.getHeaderName() + "' is missing", req, List.of());
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParam(MissingServletRequestParameterException ex,
                                                            HttpServletRequest req) {
        log.warn("Missing parameter: {}", ex.getParameterName());
        return build(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED,
                "Required parameter '" + ex.getParameterName() + "' is missing", req, List.of());
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex,
                                                            HttpServletRequest req) {
        log.warn("Invalid parameter value: {}", ex.getName());
        return build(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED,
                "Parameter '" + ex.getName() + "' has an invalid value", req, List.of());
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthentication(AuthenticationException ex, HttpServletRequest req) {
        log.warn("Authentication failed");
        return build(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED, "Authentication required", req, List.of());
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex, HttpServletRequest req) {
        log.warn("Access denied");
        return build(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, "Access denied", req, List.of());
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResource(NoResourceFoundException ex, HttpServletRequest req) {
        return build(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, "Resource not found", req, List.of());
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethod(HttpRequestMethodNotSupportedException ex,
                                                      HttpServletRequest req) {
        return build(HttpStatus.METHOD_NOT_ALLOWED, ErrorCode.METHOD_NOT_ALLOWED,
                "HTTP method not supported", req, List.of());
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMediaType(HttpMediaTypeNotSupportedException ex,
                                                         HttpServletRequest req) {
        log.warn("Unsupported content type");
        return build(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ErrorCode.UNSUPPORTED_MEDIA_TYPE,
                "Content type must be application/json", req, List.of());
    }

    @ExceptionHandler(PessimisticLockingFailureException.class)
    public ResponseEntity<ErrorResponse> handleLockTimeout(PessimisticLockingFailureException ex,
                                                           HttpServletRequest req) {
        log.warn("Lock timeout while updating rule");
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .header(HttpHeaders.RETRY_AFTER, LOCK_RETRY_AFTER_SECONDS)
                .body(ErrorResponses.of(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.LOCK_TIMEOUT,
                        "Rule is busy, retry later", req));
    }

    @ExceptionHandler({ObjectOptimisticLockingFailureException.class, DataIntegrityViolationException.class})
    public ResponseEntity<ErrorResponse> handleConflict(RuntimeException ex, HttpServletRequest req) {
        log.warn("Concurrent modification detected");
        return build(HttpStatus.CONFLICT, ErrorCode.VERSION_CONFLICT, "Rule was modified concurrently", req, List.of());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex, HttpServletRequest req) {
        log.error("Unexpected error", ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR,
                "An unexpected error occurred", req, List.of());
    }

    private static ResponseEntity<ErrorResponse> build(HttpStatus status, ErrorCode code, String message,
                                                       HttpServletRequest req,
                                                       List<ErrorResponse.FieldError> fields) {
        return ResponseEntity.status(status).body(ErrorResponses.of(status, code, message, req, fields));
    }
}
