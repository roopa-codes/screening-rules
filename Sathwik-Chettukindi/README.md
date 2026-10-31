# job-service

Rule update, versioning and audit module of the Job Service.

Recruiters update screening rules for a job through a single endpoint. Every update creates a
new **immutable version** of the rule, writes an **append-only audit record**, and stores a
**`RuleUpdated` event in a transactional outbox**. All three writes happen in one
database transaction: either all of them are saved or none are.

```
Auth Service ──JWT──▶ job-service ──▶ PostgreSQL ──(outbox)──▶ SQS FIFO (+ FIFO DLQ) ──▶ Evaluation Engine
```

> **Status:** the update API, versioning, audit and outbox writing are implemented.
> The relay that publishes outbox events to SQS is **not implemented yet**: events are
> written as `PENDING` and stay there. See [Not implemented yet](#not-implemented-yet).

---

## Contents

- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Running locally](#running-locally)
- [Configuration](#configuration)
- [API](#api)
- [Errors](#errors)
- [Data model](#data-model)
- [How an update works](#how-an-update-works)
- [Event schema](#event-schema)
- [Security](#security)
- [Logging and request ids](#logging-and-request-ids)
- [Not implemented yet](#not-implemented-yet)
- [Assumptions](#assumptions)

---

## Tech stack

| Area          | Technology                                                    |
|---------------|---------------------------------------------------------------|
| Language      | Java 17                                                       |
| Framework     | Spring Boot 3.5 (Web, Data JPA, Validation, Actuator)         |
| Security      | Spring Security OAuth2 Resource Server (JWT, JWKS)            |
| Database      | PostgreSQL 16, Flyway migrations, JSONB                       |
| Messaging     | AWS SDK v2 SQS (FIFO queue + FIFO dead-letter queue)          |
| Logging       | Logback + logstash-logback-encoder (JSON)                     |
| Build         | Maven                                                         |
| Local infra   | Docker Compose: PostgreSQL + LocalStack (SQS)                 |

---

## Project structure

```
.
├── pom.xml
├── docker-compose.yml                 # PostgreSQL + LocalStack
├── localstack/init-sqs.sh             # creates FIFO queue + FIFO DLQ (maxReceiveCount=3)
└── src/main
    ├── java/com/company/jobservice
    │   ├── JobServiceApplication.java
    │   ├── config/        ClockConfig, JpaJsonConfig, SecurityConfig
    │   ├── controller/    RuleController (PUT endpoint)
    │   ├── domain/        Rule, RuleVersionSnapshot, RuleAudit, OutboxEvent, enums
    │   ├── dto/           UpdateRuleRequest, UpdateRuleResponse, ErrorResponse
    │   ├── exception/     ApiException + subclasses, ErrorCode, GlobalExceptionHandler
    │   ├── logging/       RequestIdFilter
    │   ├── mapper/        RuleMapper, RuleContent (normalization + comparison)
    │   ├── repository/    RuleRepository, RuleAuditRepository, OutboxEventRepository, DbSessionSettings
    │   ├── security/      JwtRoleConverter, CurrentUser, JSON 401/403 handlers
    │   └── service/       RuleService (the transactional update), IfMatch
    └── resources
        ├── application.yml
        ├── logback-spring.xml
        └── db/migration
            ├── V1__create_rule_versions_audit_outbox.sql
            └── V2__rules_single_row_jsonb_versions.sql
```

| Package      | Responsibility                                                                 |
|--------------|---------------------------------------------------------------------------------|
| `controller` | HTTP layer: parses `If-Match`, validates the body, extracts the user from the JWT |
| `service`    | `RuleService.updateRule`: the single `@Transactional` update                     |
| `repository` | Row locking, atomic version append, transaction-scoped DB timeouts                |
| `mapper`     | Normalizes request and stored values so "no change" can be detected reliably      |
| `domain`     | JPA entities mapped onto the Flyway schema                                        |
| `security`   | JWT role mapping, caller identity, JSON 401/403 responses                         |
| `exception`  | One error body for every failure                                                  |
| `logging`    | Request id handling, MDC                                                          |

---

## Running locally

### Prerequisites

- JDK 17
- Maven 3.9+
- Docker (with Docker Compose)
- An Auth Service that publishes a JWKS endpoint and issues JWTs (see [Security](#security))

### 1. Start PostgreSQL and LocalStack

```bash
docker compose up -d
docker compose ps        # wait until both services are "healthy"
```

LocalStack runs `localstack/init-sqs.sh` on startup and creates:

- `job-events-dlq.fifo`: FIFO dead-letter queue
- `job-events.fifo`: FIFO main queue, redrive to the DLQ after `maxReceiveCount=3`

Get the queue URL:

```bash
docker exec job-service-localstack awslocal sqs get-queue-url --queue-name job-events.fifo
```

### 2. Build

```bash
mvn clean package -DskipTests
```

### 3. Run

```bash
export DB_URL=jdbc:postgresql://localhost:5432/jobservice
export DB_USER=jobservice
export DB_PASSWORD=jobservice
export JWT_JWKS_URI=https://<auth-service>/.well-known/jwks.json
export JWT_ISSUER_URI=https://<auth-service>          # optional
export SQS_ENDPOINT=http://localhost:4566
export SQS_QUEUE_URL=<queue url from step 1>

mvn spring-boot:run
# or
java -jar target/job-service-0.0.1-SNAPSHOT.jar
```

Flyway applies the migrations on startup. The app **refuses to start** if `JWT_JWKS_URI` is not set.

On Windows PowerShell use `$env:DB_PASSWORD = "jobservice"` instead of `export`.

### 4. Create a rule to update

There is no create endpoint and no seed data. Insert a rule directly:

```bash
docker exec -it job-service-postgres psql -U jobservice -d jobservice
```

```sql
INSERT INTO rules (rule_id, job_id, current_version, versions)
VALUES ('R1', 'J-101', 1, '{
  "1": {
    "questionKey": "location",
    "operator": "in_set",
    "params": {"values": ["Hyderabad", "Secunderabad"]},
    "onNotMet": "FAIL",
    "onMissing": "REVIEW",
    "messageTemplate": null,
    "createdBy": "seed",
    "createdAt": "2026-01-01T00:00:00Z",
    "changeReason": "initial version"
  }
}');
```

### Health checks

```bash
curl http://localhost:8080/actuator/health/liveness
curl http://localhost:8080/actuator/health/readiness
```

---

## Configuration

All values come from `application.yml` and can be overridden with environment variables.
No secrets are stored in the code.

| Variable                  | Default                                        | Description                                         |
|---------------------------|------------------------------------------------|-----------------------------------------------------|
| `DB_URL`                  | `jdbc:postgresql://localhost:5432/jobservice`  | JDBC URL                                            |
| `DB_USER`                 | `jobservice`                                   | Database user                                       |
| `DB_PASSWORD`             | *(empty)*                                      | Database password                                   |
| `JWT_JWKS_URI`            | *(none, **required**)*                         | Auth Service JWKS endpoint used to verify JWTs      |
| `JWT_ISSUER_URI`          | *(empty)*                                      | If set, the token `iss` claim must equal this value |
| `DB_LOCK_TIMEOUT_MS`      | `5000`                                         | Max wait for the rule row lock                      |
| `DB_STATEMENT_TIMEOUT_MS` | `10000`                                        | Max duration of any statement in the update         |
| `AWS_REGION`              | `us-east-1`                                    | AWS region                                          |
| `SQS_ENDPOINT`            | *(empty)*                                      | SQS endpoint override (LocalStack: `http://localhost:4566`) |
| `SQS_QUEUE_URL`           | *(empty)*                                      | FIFO queue URL                                      |
| `SQS_DLQ_ARN`             | *(empty)*                                      | FIFO dead-letter queue ARN                          |

The SQS values are defined but not used yet (no relay).

---

## API

There is exactly one endpoint.

### `PUT /api/jobs/{jobId}/rules/{ruleId}`

Creates a new version of a rule.

**Requires:** `Authorization: Bearer <JWT>` with role `RECRUITER`.

#### Headers

| Header          | Required | Description                                                        |
|-----------------|----------|--------------------------------------------------------------------|
| `Authorization` | yes      | `Bearer <JWT>`                                                     |
| `Content-Type`  | yes      | `application/json`                                                 |
| `If-Match`      | yes      | Version the client is editing. Accepts `3`, `"3"` or `W/"3"`       |
| `X-Request-Id`  | no       | Correlation id, `[A-Za-z0-9_-]{1,64}`. Otherwise a UUID is generated |

#### Request body

| Field             | Type          | Required | Rules                                       |
|-------------------|---------------|----------|---------------------------------------------|
| `questionKey`     | string        | yes      | not blank, max 128                          |
| `operator`        | string        | yes      | not blank, max 64                           |
| `params`          | JSON object   | yes      | must be a JSON object                       |
| `onNotMet`        | `FAIL`\|`REVIEW` | yes   |                                             |
| `onMissing`       | `FAIL`\|`REVIEW` | no    | defaults to `REVIEW`                        |
| `messageTemplate` | string        | no       | max 1000; blank is treated as `null`        |
| `changeReason`    | string        | yes      | 1–500 characters                            |

#### Example

```bash
curl -i -X PUT http://localhost:8080/api/jobs/J-101/rules/R1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "If-Match: 1" \
  -H "X-Request-Id: req-12345" \
  -d '{
        "questionKey": "location",
        "operator": "in_set",
        "params": {"values": ["Hyderabad", "Secunderabad", "Bengaluru"]},
        "onNotMet": "FAIL",
        "onMissing": "REVIEW",
        "messageTemplate": "Candidate must be based in an allowed city",
        "changeReason": "Added Bengaluru office"
      }'
```

#### `200 OK`

```http
X-Request-Id: req-12345
Content-Type: application/json
```

```json
{
  "ruleId": "R1",
  "version": 2,
  "previousVersion": 1,
  "updatedBy": "user-123",
  "updatedAt": "2026-10-31T10:15:30.123456Z"
}
```

`updatedBy` is the JWT `sub` claim.

#### Behaviour worth knowing

| Situation                                             | Result                       |
|-------------------------------------------------------|------------------------------|
| `If-Match` ≠ current version                          | `409 VERSION_CONFLICT`       |
| Retrying a PUT that already succeeded (same `If-Match`) | `409 VERSION_CONFLICT` (never a silent extra version) |
| Body identical to the current version after normalization | `409 NO_CHANGE`          |
| `params` differ only in key order                     | `409 NO_CHANGE`              |
| Rule exists but belongs to a different job            | `404 RULE_NOT_FOUND`         |
| Two simultaneous updates with the same `If-Match`     | one `200`, the other `409`   |
| Row lock not acquired within `DB_LOCK_TIMEOUT_MS`     | `503 LOCK_TIMEOUT` + `Retry-After` |

---

## Errors

Every error, including 401 and 403 from the security layer, returns the same body:

```json
{
  "timestamp": "2026-10-31T10:15:30.123Z",
  "status": 409,
  "error": "Conflict",
  "code": "VERSION_CONFLICT",
  "message": "If-Match version 1 does not match current version 2",
  "path": "/api/jobs/J-101/rules/R1",
  "requestId": "req-12345",
  "fieldErrors": []
}
```

`fieldErrors` lists `{ "field", "message" }` pairs for validation failures. Responses never
contain stack traces, class names or SQL.

| Status | Code                     | When                                                            |
|--------|--------------------------|-----------------------------------------------------------------|
| 400    | `VALIDATION_FAILED`      | Invalid body, malformed JSON, missing/invalid `If-Match`, bad parameter |
| 400    | `INVALID_PARAMS`         | `params` is not a JSON object                                   |
| 401    | `UNAUTHENTICATED`        | Missing, malformed, expired or forged JWT; JWT without `sub`    |
| 403    | `FORBIDDEN`              | Valid JWT without role `RECRUITER`                              |
| 404    | `RULE_NOT_FOUND`         | Unknown job/rule, or rule belongs to another job                |
| 404    | `NOT_FOUND`              | Unknown path                                                    |
| 405    | `METHOD_NOT_ALLOWED`     | Wrong HTTP method                                               |
| 409    | `VERSION_CONFLICT`       | Stale `If-Match`, or concurrent modification                    |
| 409    | `NO_CHANGE`              | Update does not change anything                                 |
| 415    | `UNSUPPORTED_MEDIA_TYPE` | `Content-Type` is not `application/json`                        |
| 503    | `LOCK_TIMEOUT`           | Rule is locked by another update for too long (`Retry-After: 1`) |
| 500    | `INTERNAL_ERROR`         | Anything unexpected (details only in the server log)            |

---

## Data model

The schema is owned by Flyway. Hibernate only validates it (`ddl-auto: validate`).

### `rules`: one row per rule, all versions inside JSONB

| Column            | Type        | Notes                                        |
|-------------------|-------------|----------------------------------------------|
| `rule_id`         | TEXT PK     |                                              |
| `job_id`          | TEXT        |                                              |
| `current_version` | INT         | `>= 1`; key must exist in `versions`         |
| `versions`        | JSONB       | Object keyed by version number as a string   |
| `updated_at`      | TIMESTAMPTZ |                                              |

`versions` format:

```json
{
  "1": {
    "questionKey": "location",
    "operator": "in_set",
    "params": {"values": ["Hyderabad", "Secunderabad"]},
    "onNotMet": "FAIL",
    "onMissing": "REVIEW",
    "messageTemplate": null,
    "createdBy": "user-123",
    "createdAt": "2026-10-31T10:15:30.123456Z",
    "changeReason": "initial version"
  },
  "2": { "...": "..." }
}
```

**Immutability guard (trigger `rules_guard`):**

- `DELETE` and `TRUNCATE` are rejected.
- `UPDATE` is rejected if `rule_id` or `job_id` change, if any existing version is modified or
  removed (checked with `NEW.versions @> OLD.versions` **and** an exact per-version comparison,
  because `@>` alone allows nested arrays to grow), or if `current_version` decreases.

### `rule_audit`: append-only

`rule_id`, `job_id`, `from_version`, `to_version`, `user_id`, `user_name`, `role`,
`old_value` (JSONB), `new_value` (JSONB), `changed_fields` (JSONB array), `change_reason`,
`request_id`, `created_at`.

A trigger rejects every `UPDATE`, `DELETE` and `TRUNCATE`.

### `outbox_events`

`id` (UUID, also the event id), `job_id`, `aggregate_id` (rule id), `event_type`,
`payload` (JSONB), `status` (`PENDING` | `SENT` | `DEAD`), `attempts`, `next_attempt_at`,
`last_error`, `request_id`, `created_at`, `sent_at`.
Index on `(status, next_attempt_at)` for the relay's "due events" query.

### Migrations

| Migration | What it does |
|-----------|--------------|
| `V1` | Creates `rule_versions` (one row per version), `rule_audit` with its append-only trigger, and `outbox_events` |
| `V2` | Creates `rules`, migrates every `rule_versions` row into it (grouped by rule, `current_version` = highest version, change reasons taken from the audit table), drops `rule_versions`, adds the `rules_guard` trigger and `rule_audit.changed_fields` |

Old migrations are never edited.

---

## How an update works

`RuleService.updateRule` runs in **one transaction**:

1. **Normalize the request:** trim strings, blank `messageTemplate` → `null`, default
   `onMissing` to `REVIEW`, reject non-object `params`.
2. **Set timeouts:** `lock_timeout` and `statement_timeout` for this transaction only.
3. **Lock the rule:** `SELECT … FOR UPDATE` by `rule_id` **and** `job_id`. Not found → 404.
   Concurrent updates to the same rule queue up here.
4. **Check `If-Match`** against `current_version`. Mismatch → 409 `VERSION_CONFLICT`.
5. **Detect no-op:** compare the normalized request with the normalized current version.
   `params` are compared as JSON trees, so key order does not matter. Equal → 409 `NO_CHANGE`.
6. **Append the new version** with a single SQL statement:
   `versions = versions || {"N+1": {...}}`, `current_version = N+1`, guarded by
   `WHERE current_version = N AND NOT jsonb_exists(versions, 'N+1')`. Existing versions are
   never rewritten. (The `Rule` entity is read-only for Hibernate for this reason: saving it
   would re-serialize all versions, and any formatting drift would trip the guard trigger.)
7. **Insert the audit row:** old and new snapshot, changed fields, user id/name/role
   **from the JWT only**, change reason, request id.
8. **Insert the outbox event:** status `PENDING`, payload below.
9. Commit and return the response.

Any exception rolls back everything: no version, audit row or event is left behind.
SQS is never called inside this transaction.

---

## Event schema

Stored in `outbox_events.payload`, to be published to SQS as the message body.

```json
{
  "eventId": "3f1c6a52-6a0b-4a8e-9b1e-1f2d3c4b5a69",
  "event": "RuleUpdated",
  "schemaVersion": 1,
  "jobId": "J-101",
  "ruleId": "R1",
  "fromVersion": 1,
  "toVersion": 2,
  "changedBy": "user-123",
  "requestId": "req-12345",
  "occurredAt": "2026-10-31T10:15:30.123456Z"
}
```

- `eventId` equals `outbox_events.id`. It is created once and never regenerated.
- `occurredAt` is ISO-8601 in UTC with an offset.

**Intended SQS mapping (for the relay):**

| SQS field                | Value     |
|--------------------------|-----------|
| `MessageGroupId`         | `jobId`: keeps updates for one job in order |
| `MessageDeduplicationId` | `eventId` |
| Message attributes       | `eventType`, `jobId`, `eventId` |

SQS FIFO de-duplicates on `MessageDeduplicationId` only within a **5-minute window**.
Consumers (the Evaluation Engine) must therefore be **idempotent on `eventId`**.

### Dead-letter queue

`localstack/init-sqs.sh` sets this redrive policy on the main queue:

```json
{ "deadLetterTargetArn": "<job-events-dlq.fifo ARN>", "maxReceiveCount": "3" }
```

Equivalent infrastructure for AWS, e.g. Terraform:

```hcl
resource "aws_sqs_queue" "job_events_dlq" {
  name       = "job-events-dlq.fifo"
  fifo_queue = true
}

resource "aws_sqs_queue" "job_events" {
  name                        = "job-events.fifo"
  fifo_queue                  = true
  content_based_deduplication = false
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.job_events_dlq.arn
    maxReceiveCount     = 3
  })
}
```

---

## Security

- Every `/api/jobs/**` request needs a valid JWT signed by a key from `JWT_JWKS_URI`.
  Signature, expiry and (if `JWT_ISSUER_URI` is set) issuer are checked.
- Roles are read from the `roles` (array) and/or `role` (string) claim and mapped to
  `ROLE_<NAME>`. Only `RECRUITER` may call the API.
- Caller identity comes **only** from the validated token:

  | JWT claim | Used as                                   |
  |-----------|-------------------------------------------|
  | `sub`     | `user_id`, `createdBy`, `updatedBy`, `changedBy` (required, otherwise 401) |
  | `name`    | `user_name` in the audit row (optional)   |

- Stateless: no sessions, CSRF disabled.
- `/actuator/health/**` is public; other actuator endpoints require authentication.

Example token payload:

```json
{
  "sub": "user-123",
  "name": "Asha Recruiter",
  "roles": ["RECRUITER"],
  "iss": "https://auth.example.com",
  "exp": 1793450000
}
```

---

## Logging and request ids

- `RequestIdFilter` runs before every other filter. It accepts `X-Request-Id` only if it
  matches `[A-Za-z0-9_-]{1,64}`, otherwise generates a UUID. The id is:
  - returned in the `X-Request-Id` response header,
  - included in every error body,
  - put into the MDC so every log line carries it,
  - stored in `rule_audit.request_id`, `outbox_events.request_id` and the event payload.
- MDC is cleared in a `finally` block after every request, even if it fails.
- Logs are JSON, one object per line:

  ```json
  {"timestamp":"2026-10-31T10:15:30.456Z","message":"Rule updated: jobId=J-101 ruleId=R1 fromVersion=1 toVersion=2","logger":"com.company.jobservice.service.RuleService","thread":"http-nio-8080-exec-1","level":"INFO","requestId":"req-12345"}
  ```

- **Never logged:** JWTs, `Authorization` headers, request or response bodies, SQL bind values.
  Loggers that could print these at DEBUG/TRACE are pinned to safe levels in `logback-spring.xml`.
- Levels: `INFO` for request completion and successful updates, `WARN` for rejected requests
  (validation, conflict, no-op, auth), `ERROR` for unexpected failures.

---

## Not implemented yet

| Item | Notes |
|------|-------|
| Outbox relay | No scheduled job publishes `PENDING` events to SQS, retries with backoff, or marks events `SENT`/`DEAD`. `OutboxEventRepository.lockDuePending` (`FOR UPDATE SKIP LOCKED`) is in place for it. |
| Admin requeue | No endpoint to move `DEAD` events back to `PENDING`. |
| Job ownership | Any `RECRUITER` can update any job's rules; there is no jobs table to check ownership against. |
| Operator validation | `operator` and `params` are not validated per operator (e.g. `in_set`, `gte`, `is_true`). |
| Metrics | No custom Micrometer metrics yet; only the Actuator defaults. |
| Read endpoints | Removed on purpose; the service exposes only the update API. |
| Seed data | None; insert rules manually (see [Running locally](#running-locally)). |
| Dockerfile | The app itself is not containerized; Compose runs only PostgreSQL and LocalStack. |
| Tests | None yet. |

---

## Assumptions

- `If-Match` holds the plain version number. Quoted (`"3"`) and weak (`W/"3"`) forms are accepted.
- A missing `name` claim is allowed; `user_name` is then `null` in the audit row.
- The audit `role` is always `RECRUITER`, since that is the only role allowed to update.
- A rule id is unique across all jobs (`rule_id` is the primary key of `rules`).
- `params` are compared structurally: numbers compare by JSON type, so `3` and `3.0` are
  considered different.
- All timestamps are stored as `TIMESTAMPTZ` and returned in UTC with an offset.
