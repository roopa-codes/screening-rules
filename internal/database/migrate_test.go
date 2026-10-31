package database

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TestMigrationsRoundTrip checks that every migration applies, rolls back
// without leaving anything behind, and applies again. It runs against
// TEST_DATABASE_URL and wipes that database, so never point it at real data.
func TestMigrationsRoundTrip(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()

	pool, err := Connect(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	// Start from an empty schema (migrate's Drop leaves enum types behind).
	if _, err := pool.Exec(ctx, `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`); err != nil {
		t.Fatalf("reset schema: %v", err)
	}

	m, err := NewMigrator(url)
	if err != nil {
		t.Fatal(err)
	}
	defer m.Close()

	run(t, "up", m.Up)
	assertCounts(t, pool, 15, 7)

	run(t, "down", m.Down)
	assertCounts(t, pool, 0, 0)

	run(t, "up again", m.Up)
	assertCounts(t, pool, 15, 7)
}

func run(t *testing.T, name string, fn func() error) {
	t.Helper()
	if err := fn(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		t.Fatalf("%s: %v", name, err)
	}
}

func assertCounts(t *testing.T, pool *pgxpool.Pool, wantTables, wantEnums int) {
	t.Helper()
	var tables, enums int
	err := pool.QueryRow(context.Background(), `
		SELECT
		  (SELECT count(*) FROM information_schema.tables
		    WHERE table_schema = 'public' AND table_name <> 'schema_migrations'),
		  (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
		    WHERE n.nspname = 'public' AND t.typtype = 'e')`).Scan(&tables, &enums)
	if err != nil {
		t.Fatal(err)
	}
	if tables != wantTables || enums != wantEnums {
		t.Errorf("got %d tables and %d enums, want %d and %d", tables, enums, wantTables, wantEnums)
	}
}
