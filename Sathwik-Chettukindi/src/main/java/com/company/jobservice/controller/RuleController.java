package com.company.jobservice.controller;

import com.company.jobservice.dto.UpdateRuleRequest;
import com.company.jobservice.dto.UpdateRuleResponse;
import com.company.jobservice.logging.RequestIdFilter;
import com.company.jobservice.security.CurrentUser;
import com.company.jobservice.service.IfMatch;
import com.company.jobservice.service.RuleService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/jobs/{jobId}/rules/{ruleId}")
public class RuleController {

    private final RuleService ruleService;

    public RuleController(RuleService ruleService) {
        this.ruleService = ruleService;
    }

    @PutMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public UpdateRuleResponse updateRule(@PathVariable String jobId,
                                         @PathVariable String ruleId,
                                         @RequestHeader(HttpHeaders.IF_MATCH) String ifMatch,
                                         @Valid @RequestBody UpdateRuleRequest request,
                                         @AuthenticationPrincipal Jwt jwt,
                                         HttpServletRequest httpRequest) {
        int expectedVersion = IfMatch.parseVersion(ifMatch);
        CurrentUser user = CurrentUser.recruiterFrom(jwt);
        return ruleService.updateRule(jobId, ruleId, expectedVersion, request, user,
                RequestIdFilter.current(httpRequest));
    }
}
