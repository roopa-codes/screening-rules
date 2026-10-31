package com.company.jobservice.exception;

import org.springframework.http.HttpStatus;

public class UnauthenticatedException extends ApiException {

    public UnauthenticatedException(String message) {
        super(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED, message);
    }
}
