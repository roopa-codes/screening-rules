import { Application } from './application.entity';
import { ApplicationAnswer } from './application-answer.entity';
import { AuditLog } from './audit-log.entity';
import { Job } from './job.entity';
import { Override } from './override.entity';
import { Question } from './question.entity';
import { RuleResultRow } from './rule-result.entity';
import { RuleSetVersion } from './rule-set-version.entity';
import { RuleType } from './rule-type.entity';
import { Rule } from './rule.entity';
import { ScreeningEvaluation } from './screening-evaluation.entity';

export {
  Application, ApplicationAnswer, AuditLog, Job, Override, Question, Rule, RuleResultRow, RuleSetVersion, RuleType,
  ScreeningEvaluation,
};

// Only the tables the engine reads/writes. Users, roles, forms, candidates are owned by other services.
export const ENTITIES = [
  Job, Question, RuleType, RuleSetVersion, Rule, Application, ApplicationAnswer, ScreeningEvaluation, RuleResultRow,
  Override, AuditLog,
];
