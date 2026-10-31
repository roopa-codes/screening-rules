package com.company.jobservice.security;

import com.company.jobservice.exception.UnauthenticatedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.util.StringUtils;

/**
 * Identity of the caller, taken only from the validated JWT.
 */
public record CurrentUser(String userId, String userName, String role) {

    public static final String RECRUITER = "RECRUITER";

    public static CurrentUser recruiterFrom(Jwt jwt) {
        if (jwt == null || !StringUtils.hasText(jwt.getSubject())) {
            throw new UnauthenticatedException("Token has no subject");
        }
        String name = jwt.getClaimAsString("name");
        return new CurrentUser(jwt.getSubject(), StringUtils.hasText(name) ? name : null, RECRUITER);
    }
}
