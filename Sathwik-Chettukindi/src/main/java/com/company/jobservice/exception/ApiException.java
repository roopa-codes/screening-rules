package com.company.jobservice.exception;

import org.springframework.http.HttpStatus;

/**
 * Base for expected errors. The message must be safe to return to clients.
 */
public abstract class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final ErrorCode code;

    protected ApiException(HttpStatus status, ErrorCode code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public ErrorCode getCode() {
        return code;
    }
}
