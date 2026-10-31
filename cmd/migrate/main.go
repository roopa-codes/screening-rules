// Command migrate manages the database schema.
//
//	go run ./cmd/migrate up             apply all pending migrations
//	go run ./cmd/migrate down [N|all]   roll back N migrations (default 1)
//	go run ./cmd/migrate goto V         migrate up or down to version V
//	go run ./cmd/migrate version        print the current version
//	go run ./cmd/migrate force V        mark version V as clean after a failed migration
//	go run ./cmd/migrate create NAME    add a new empty up/down migration pair
//
// The database is read from DATABASE_URL.
package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"

	"github.com/golang-migrate/migrate/v4"

	"screening-rules/internal/database"
)

const migrationsDir = "migrations"

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		return errors.New("usage: migrate <up|down [N|all]|goto V|version|force V|create NAME>")
	}
	cmd, rest := args[0], args[1:]

	if cmd == "create" {
		if len(rest) != 1 {
			return errors.New("usage: migrate create NAME")
		}
		return create(rest[0])
	}

	m, err := database.NewMigrator(database.URLFromEnv())
	if err != nil {
		return err
	}
	defer m.Close()

	switch cmd {
	case "up":
		err = m.Up()
	case "down":
		switch {
		case len(rest) == 0:
			err = m.Steps(-1)
		case rest[0] == "all":
			err = m.Down()
		default:
			n, convErr := strconv.Atoi(rest[0])
			if convErr != nil || n < 1 {
				return fmt.Errorf("invalid step count %q", rest[0])
			}
			err = m.Steps(-n)
		}
	case "goto":
		v, convErr := versionArg(rest)
		if convErr != nil {
			return convErr
		}
		err = m.Migrate(v)
	case "force":
		v, convErr := versionArg(rest)
		if convErr != nil {
			return convErr
		}
		err = m.Force(int(v))
	case "version":
		// Reported below.
	default:
		return fmt.Errorf("unknown command %q", cmd)
	}

	if errors.Is(err, migrate.ErrNoChange) {
		fmt.Println("no change")
		err = nil
	}
	if err != nil {
		return err
	}
	return printVersion(m)
}

func versionArg(rest []string) (uint, error) {
	if len(rest) != 1 {
		return 0, errors.New("expected a version number")
	}
	v, err := strconv.ParseUint(rest[0], 10, 32)
	if err != nil {
		return 0, fmt.Errorf("invalid version %q", rest[0])
	}
	return uint(v), nil
}

func printVersion(m *migrate.Migrate) error {
	v, dirty, err := m.Version()
	if errors.Is(err, migrate.ErrNilVersion) {
		fmt.Println("version: none (empty database)")
		return nil
	}
	if err != nil {
		return err
	}
	fmt.Printf("version: %d dirty: %t\n", v, dirty)
	return nil
}

var (
	versionPrefix = regexp.MustCompile(`^(\d+)_`)
	validName     = regexp.MustCompile(`^[a-z0-9_]+$`)
)

// create writes the next sequential NNNNNN_name.{up,down}.sql pair.
func create(name string) error {
	if !validName.MatchString(name) {
		return fmt.Errorf("name %q must be lower_snake_case", name)
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("read %s (run from the repo root): %w", migrationsDir, err)
	}
	next := 1
	for _, e := range entries {
		if match := versionPrefix.FindStringSubmatch(e.Name()); match != nil {
			if n, _ := strconv.Atoi(match[1]); n >= next {
				next = n + 1
			}
		}
	}

	base := fmt.Sprintf("%06d_%s", next, name)
	for _, dir := range []string{"up", "down"} {
		path := filepath.Join(migrationsDir, base+"."+dir+".sql")
		if err := os.WriteFile(path, nil, 0o644); err != nil {
			return err
		}
		fmt.Println("created", path)
	}
	return nil
}
