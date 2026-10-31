package com.company.jobservice.exception;

import org.springframework.http.HttpStatus;

public class RuleNotFoundException extends ApiException {

    public RuleNotFoundException() {
        this("Rule not found for this job");
    }

    public RuleNotFoundException(String message) {
        super(HttpStatus.NOT_FOUND, ErrorCode.RULE_NOT_FOUND, message);
    }
}
