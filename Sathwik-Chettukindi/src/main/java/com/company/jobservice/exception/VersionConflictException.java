package com.company.jobservice.exception;

import org.springframework.http.HttpStatus;

public class VersionConflictException extends ApiException {

    public VersionConflictException(int expected, int current) {
        super(HttpStatus.CONFLICT, ErrorCode.VERSION_CONFLICT,
                "If-Match version " + expected + " does not match current version " + current);
    }

    public VersionConflictException() {
        super(HttpStatus.CONFLICT, ErrorCode.VERSION_CONFLICT, "Rule was modified concurrently");
    }
}
