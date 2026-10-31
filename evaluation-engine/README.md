# Evaluation Engine

Part of the Knockout Screening Rules service. Consumes events (from SQS or `POST /events`), evaluates
applications against a job's knockout rules, and stores **PASS / REVIEW / FAIL** with a plain-language reason.

```
Jobs service ──(RULES_UPDATED)──┐
                                ├─► SQS ─► Evaluation engine ─► PostgreSQL
Applications ─(APPLICATION_SUBMITTED)┘
```

## Run

```bash
cp .env.example .env          # set DB_* (and SQS_QUEUE_URL if using SQS)
docker compose up -d          # or any local Postgres
npm install
npm run start:dev             # http://localhost:3002
npm test
```

## Events

```json
{ "type": "APPLICATION_SUBMITTED", "applicationId": "<uuid>" }
{ "type": "RULES_UPDATED", "jobId": "<uuid>", "rulesVersion": 2 }
```
SNS→SQS envelopes are unwrapped automatically.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/events` | Same as an SQS message (local/demo) |
| POST | `/evaluate/preview` | Dry-run rules + answers, nothing saved |
| POST | `/applications/:id/evaluate` | Manually (re)evaluate one application |
| POST | `/jobs/:id/reevaluate` | Manually re-run a whole job |
| GET | `/applications/:id/evaluation` | Final outcome, computed result, active override |
| GET | `/applications/:id/evaluation/history` | All results + overrides (audit) |
| POST | `/applications/:id/override` | `{ outcome, comment, recruiterId }` |

## Design decisions

- **Extensible rules**: `rules.type` + `rules.params` (jsonb). New rule kind = new `RuleType` + evaluator
  class registered in `src/evaluation/evaluators/registry.ts`. No schema change.
- **Deterministic**: `evaluation.engine.ts` is a pure function (no DB/clock/randomness), rules sorted by
  `position, code`. Each result stores the rules + answers snapshot so it can be replayed.
- **Combining**: any FAIL → FAIL; else any REVIEW → REVIEW; else PASS. The reason lists every rule at the
  deciding severity, each prefixed with its code (`R1: ...`).
- **Unanswered question → REVIEW** (configurable per rule via `onMissing`). Missing data isn't evidence the
  candidate fails; auto-rejecting would be unfair and hard to undo, while a quick human look is cheap.
- **Bad data / bad config → REVIEW**, never an automatic FAIL.
- **Rules change (e.g. R2 3→2 years after 200 applications)**: jobs service bumps `jobs.rules_version` and
  emits `RULES_UPDATED`. Every application is re-evaluated and gets a **new** result row; the old one is
  kept with `is_current = false`. Results are unique per `(application_id, rules_version)`, so SQS
  redelivery is a no-op.
- **Overrides are never silently undone**: overrides are append-only. While one is active, re-evaluation
  still records the new computed result but does **not** change `applications.final_outcome`; if they disagree
  the result is flagged `conflicts_with_override = true` so the recruiter can be prompted.

## Entities

`src/entities/` holds placeholder entities. Replace them with the shared ones; the engine only depends on
the `RuleDefinition` shape (`toDefinition` in `evaluation.service.ts`) and on `answers` being a key→value map.
