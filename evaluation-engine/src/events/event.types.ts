import { BadRequestException } from '@nestjs/common';

// Contract with the jobs / application services that publish to SQS.
export type EngineEvent =
  | { type: 'APPLICATION_SUBMITTED'; applicationId: number }
  /** jobId or ruleSetVersionId (or both). The engine always uses the job's currently active rule set. */
  | { type: 'RULES_UPDATED'; jobId?: number; ruleSetVersionId?: number };

function toId(v: unknown): number | undefined {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : undefined;
}

export function parseEvent(raw: unknown): EngineEvent {
  const body = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!body || typeof body !== 'object') throw new BadRequestException('Event must be an object');
  const e = body as Record<string, unknown>;

  switch (e.type) {
    case 'APPLICATION_SUBMITTED': {
      const applicationId = toId(e.applicationId);
      if (!applicationId) throw new BadRequestException('applicationId is required');
      return { type: e.type, applicationId };
    }
    case 'RULES_UPDATED': {
      const jobId = toId(e.jobId);
      const ruleSetVersionId = toId(e.ruleSetVersionId);
      if (!jobId && !ruleSetVersionId) throw new BadRequestException('jobId or ruleSetVersionId is required');
      return { type: e.type, jobId, ruleSetVersionId };
    }
    default:
      throw new BadRequestException(`Unknown event type: ${String(e.type)}`);
  }
}
