package com.company.jobservice.service;

import com.company.jobservice.exception.BadRequestException;
import com.company.jobservice.exception.ErrorCode;

/**
 * Parses an If-Match header holding a rule version: 3, "3" or W/"3".
 */
public final class IfMatch {

    private IfMatch() {
    }

    public static int parseVersion(String header) {
        if (header == null || header.isBlank()) {
            throw new BadRequestException(ErrorCode.VALIDATION_FAILED, "If-Match header is required");
        }
        String value = header.trim();
        if (value.startsWith("W/")) {
            value = value.substring(2);
        }
        if (value.length() >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
            value = value.substring(1, value.length() - 1);
        }
        if (!value.matches("\\d{1,9}")) {
            throw new BadRequestException(ErrorCode.VALIDATION_FAILED, "If-Match must be a positive version number");
        }
        int version = Integer.parseInt(value);
        if (version < 1) {
            throw new BadRequestException(ErrorCode.VALIDATION_FAILED, "If-Match must be a positive version number");
        }
        return version;
    }
}
