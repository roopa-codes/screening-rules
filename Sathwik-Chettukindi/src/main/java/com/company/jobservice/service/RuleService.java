package com.company.jobservice.service;

import com.company.jobservice.domain.OutboxEvent;
import com.company.jobservice.domain.OutboxStatus;
import com.company.jobservice.domain.Rule;
import com.company.jobservice.domain.RuleAudit;
import com.company.jobservice.domain.RuleVersionSnapshot;
import com.company.jobservice.dto.UpdateRuleRequest;
import com.company.jobservice.dto.UpdateRuleResponse;
import com.company.jobservice.exception.NoChangeException;
import com.company.jobservice.exception.RuleNotFoundException;
import com.company.jobservice.exception.VersionConflictException;
import com.company.jobservice.mapper.RuleContent;
import com.company.jobservice.mapper.RuleMapper;
import com.company.jobservice.repository.DbSessionSettings;
import com.company.jobservice.repository.OutboxEventRepository;
import com.company.jobservice.repository.RuleAuditRepository;
import com.company.jobservice.repository.RuleRepository;
import com.company.jobservice.security.CurrentUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
public class RuleService {

    public static final String EVENT_TYPE = "RuleUpdated";
    public static final int SCHEMA_VERSION = 1;

    private static final Logger log = LoggerFactory.getLogger(RuleService.class);

    private final RuleRepository rules;
    private final RuleAuditRepository audits;
    private final OutboxEventRepository outbox;
    private final DbSessionSettings dbSessionSettings;
    private final RuleMapper mapper;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public RuleService(RuleRepository rules, RuleAuditRepository audits, OutboxEventRepository outbox,
                       DbSessionSettings dbSessionSettings, RuleMapper mapper, ObjectMapper objectMapper,
                       Clock clock) {
        this.rules = rules;
        this.audits = audits;
        this.outbox = outbox;
        this.dbSessionSettings = dbSessionSettings;
        this.mapper = mapper;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    /**
     * Appends a new version to the rule and writes its audit row and outbox event in one
     * transaction. Any exception rolls back all three.
     */
    @Transactional
    public UpdateRuleResponse updateRule(String jobId, String ruleId, int expectedVersion,
                                         UpdateRuleRequest request, CurrentUser user, String requestId) {
        RuleContent requested = mapper.fromRequest(request);

        dbSessionSettings.applyTimeouts();
        Rule rule = rules.findForUpdate(ruleId, jobId).orElseThrow(RuleNotFoundException::new);

        int currentVersion = rule.getCurrentVersion();
        if (currentVersion != expectedVersion) {
            throw new VersionConflictException(expectedVersion, currentVersion);
        }

        RuleVersionSnapshot previousSnapshot = rule.currentSnapshot();
        if (previousSnapshot == null) {
            throw new IllegalStateException("Current version missing from versions");
        }
        RuleContent previous = mapper.fromSnapshot(previousSnapshot);
        if (previous.equals(requested)) {
            throw new NoChangeException();
        }

        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        OffsetDateTime nowUtc = RuleMapper.toUtc(now);
        int newVersion = currentVersion + 1;
        String changeReason = request.changeReason().trim();
        RuleVersionSnapshot newSnapshot = mapper.newSnapshot(requested, user.userId(), nowUtc, changeReason);

        int updated = rules.appendVersion(ruleId, jobId, currentVersion, newVersion,
                Integer.toString(newVersion), mapper.writeJson(newSnapshot), now);
        if (updated != 1) {
            // Unreachable while the row lock is held; defensive guard against a silent no-op.
            throw new VersionConflictException();
        }

        audits.save(buildAudit(ruleId, jobId, currentVersion, newVersion, previousSnapshot, newSnapshot,
                mapper.changedFields(previous, requested), user, changeReason, requestId, now));
        outbox.save(buildOutboxEvent(jobId, ruleId, currentVersion, newVersion, user, requestId, now));

        log.info("Rule updated: jobId={} ruleId={} fromVersion={} toVersion={}",
                jobId, ruleId, currentVersion, newVersion);

        return new UpdateRuleResponse(ruleId, newVersion, currentVersion, user.userId(), nowUtc);
    }

    private RuleAudit buildAudit(String ruleId, String jobId, int fromVersion, int toVersion,
                                 RuleVersionSnapshot oldSnapshot, RuleVersionSnapshot newSnapshot,
                                 List<String> changedFields, CurrentUser user, String changeReason,
                                 String requestId, Instant now) {
        RuleAudit audit = new RuleAudit();
        audit.setRuleId(ruleId);
        audit.setJobId(jobId);
        audit.setFromVersion(fromVersion);
        audit.setToVersion(toVersion);
        audit.setUserId(user.userId());
        audit.setUserName(user.userName());
        audit.setRole(user.role());
        audit.setOldValue(mapper.writeJson(oldSnapshot));
        audit.setNewValue(mapper.writeJson(newSnapshot));
        audit.setChangedFields(changedFields);
        audit.setChangeReason(changeReason);
        audit.setRequestId(requestId);
        audit.setCreatedAt(now);
        return audit;
    }

    private OutboxEvent buildOutboxEvent(String jobId, String ruleId, int fromVersion, int toVersion,
                                         CurrentUser user, String requestId, Instant now) {
        UUID eventId = UUID.randomUUID();

        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("eventId", eventId.toString());
        payload.put("event", EVENT_TYPE);
        payload.put("schemaVersion", SCHEMA_VERSION);
        payload.put("jobId", jobId);
        payload.put("ruleId", ruleId);
        payload.put("fromVersion", fromVersion);
        payload.put("toVersion", toVersion);
        payload.put("changedBy", user.userId());
        payload.put("requestId", requestId);
        payload.put("occurredAt", RuleMapper.toUtc(now).toString());

        OutboxEvent event = new OutboxEvent();
        event.setId(eventId);
        event.setJobId(jobId);
        event.setAggregateId(ruleId);
        event.setEventType(EVENT_TYPE);
        event.setPayload(mapper.writeJson(payload));
        event.setStatus(OutboxStatus.PENDING);
        event.setAttempts(0);
        event.setNextAttemptAt(now);
        event.setRequestId(requestId);
        event.setCreatedAt(now);
        return event;
    }
}
