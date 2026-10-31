package database

import (
	"database/sql"
	"errors"
	"fmt"
	"log"

	"github.com/golang-migrate/migrate/v4"
	pgxmigrate "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "github.com/jackc/pgx/v5/stdlib"

	"screening-rules/migrations"
)

// NewMigrator builds a migrator that reads the embedded SQL files.
// Callers must Close it when done.
func NewMigrator(databaseURL string) (*migrate.Migrate, error) {
	src, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return nil, fmt.Errorf("load embedded migrations: %w", err)
	}

	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	driver, err := pgxmigrate.WithInstance(db, &pgxmigrate.Config{})
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("init migrate driver: %w", err)
	}

	m, err := migrate.NewWithInstance("iofs", src, "pgx5", driver)
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("init migrator: %w", err)
	}
	m.Log = migrateLogger{}
	return m, nil
}

// MigrateUp applies all pending migrations. Use it at app startup.
func MigrateUp(databaseURL string) error {
	m, err := NewMigrator(databaseURL)
	if err != nil {
		return err
	}
	defer m.Close()

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate up: %w", err)
	}
	return nil
}

type migrateLogger struct{}

func (migrateLogger) Printf(format string, v ...any) { log.Printf("migrate: "+format, v...) }
func (migrateLogger) Verbose() bool                  { return false }
