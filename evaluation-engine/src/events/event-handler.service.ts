import { Injectable, Logger } from '@nestjs/common';
import { EvaluationTrigger } from '../common/enums';
import { EvaluationService } from '../evaluation/evaluation.service';
import { EngineEvent } from './event.types';

@Injectable()
export class EventHandlerService {
  private readonly logger = new Logger(EventHandlerService.name);

  constructor(private readonly evaluation: EvaluationService) {}

  async handle(event: EngineEvent) {
    this.logger.log(`Handling ${JSON.stringify(event)}`);
    switch (event.type) {
      case 'APPLICATION_SUBMITTED':
        return this.evaluation.evaluateApplication(event.applicationId, EvaluationTrigger.APPLICATION_SUBMITTED);
      case 'RULES_UPDATED': {
        const jobId = event.jobId ?? (await this.evaluation.jobIdForRuleSet(event.ruleSetVersionId!));
        return this.evaluation.reevaluateJob(jobId, EvaluationTrigger.RULES_UPDATED);
      }
    }
  }
}
