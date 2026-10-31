# screening-rules

Go + PostgreSQL backend for rule-based candidate screening.

## Setup

Needs Go 1.25+ (an older `go` downloads it automatically) and Docker.

```sh
docker compose up -d          # Postgres 16 on localhost:5433
go run ./cmd/migrate up       # create the schema
```

The connection string comes from `DATABASE_URL`. If it isn't set, the
docker-compose database is used (see `.env.example`).

## Migrations

SQL files live in `migrations/` as `NNNNNN_name.up.sql` / `NNNNNN_name.down.sql`
pairs. They are embedded into the binary, so a deployed app needs no extra files.
Applied versions are tracked in the `schema_migrations` table.

| Command | What it does |
| --- | --- |
| `go run ./cmd/migrate up` | Apply all pending migrations |
| `go run ./cmd/migrate down` | Roll back the last migration |
| `go run ./cmd/migrate down 3` / `down all` | Roll back 3 / all migrations |
| `go run ./cmd/migrate goto 4` | Move to version 4 (up or down) |
| `go run ./cmd/migrate version` | Show the current version |
| `go run ./cmd/migrate force 4` | Mark version 4 clean after a failed migration |
| `go run ./cmd/migrate create add_job_location` | Create the next empty up/down pair |

An app can also call `database.MigrateUp(url)` on startup.

### Changing the schema

1. **Never edit a migration that has already run on a shared database.** Add a new one:
   `go run ./cmd/migrate create add_job_location`.
2. Write the change in the `.up.sql` file and the exact reverse in `.down.sql`.
3. Run `go run ./cmd/migrate up`, then `down`, then `up` again to check both directions.
4. Run the tests (below) before committing.

If a migration fails partway, the version is marked `dirty`. Fix the database
by hand, then `force` the last version that applied cleanly.

## Tests

```sh
TEST_DATABASE_URL=postgres://screening:screening@localhost:5433/screening_test?sslmode=disable go test ./...
```

The migration test drops everything in `TEST_DATABASE_URL`, then runs up → down → up.
docker-compose creates the `screening_test` database for this. Without the variable,
the test is skipped.
