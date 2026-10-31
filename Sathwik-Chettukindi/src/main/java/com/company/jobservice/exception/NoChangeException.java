package com.company.jobservice.exception;

import org.springframework.http.HttpStatus;

public class NoChangeException extends ApiException {

    public NoChangeException() {
        super(HttpStatus.CONFLICT, ErrorCode.NO_CHANGE, "Update does not change the rule");
    }
}
