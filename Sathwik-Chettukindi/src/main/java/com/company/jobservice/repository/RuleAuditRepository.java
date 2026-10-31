package com.company.jobservice.repository;

import com.company.jobservice.domain.RuleAudit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RuleAuditRepository extends JpaRepository<RuleAudit, Long> {

    Page<RuleAudit> findByJobIdAndRuleIdOrderByCreatedAtDesc(String jobId, String ruleId, Pageable pageable);

    List<RuleAudit> findByRequestId(String requestId);
}
