package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// Migration represents a single SQL migration file
type Migration struct {
	Filename string
	FullPath string
	Checksum string
	SQL      string
}

// hasInternalTransaction inspects SQL content by skipping leading whitespace,
// single-line comments (--), and multi-line comments (/* ... */) to determine
// whether the first executable SQL command is BEGIN.
func hasInternalTransaction(sqlContent string) bool {
	s := strings.TrimSpace(sqlContent)
	for len(s) > 0 {
		if strings.HasPrefix(s, "--") {
			idx := strings.Index(s, "\n")
			if idx == -1 {
				return false
			}
			s = strings.TrimSpace(s[idx+1:])
			continue
		}

		if strings.HasPrefix(s, "/*") {
			idx := strings.Index(s, "*/")
			if idx == -1 {
				return false
			}
			s = strings.TrimSpace(s[idx+2:])
			continue
		}

		// Found first non-comment token
		upper := strings.ToUpper(s)
		return strings.HasPrefix(upper, "BEGIN")
	}
	return false
}

func main() {
	migrationsDirFlag := flag.String("dir", "", "Path to the migrations directory (defaults to DATABASE/migrations)")
	dryRunFlag := flag.Bool("dry-run", false, "Simulate execution and verify files without connecting to the database")
	flag.Parse()

	log.Println("=================================================================")
	log.Println("           HMS PostgreSQL Migration Runner (Neon Safe)           ")
	log.Println("=================================================================")

	// 1. Resolve migrations directory
	migDir := *migrationsDirFlag
	if migDir == "" {
		defaultPath := filepath.Join(".", "DATABASE", "migrations")
		if _, err := os.Stat(defaultPath); err == nil {
			migDir = defaultPath
		} else {
			altPath := filepath.Join("..", "..", "DATABASE", "migrations")
			if _, err := os.Stat(altPath); err == nil {
				migDir = altPath
			} else {
				migDir = defaultPath
			}
		}
	}

	absDir, err := filepath.Abs(migDir)
	if err != nil {
		log.Fatalf("[-] Failed to resolve migration directory path: %v", err)
	}
	log.Printf("[+] Migration directory: %s", absDir)

	// 2. Discover and sort migration files
	migrations, err := loadMigrations(absDir)
	if err != nil {
		log.Fatalf("[-] Failed to load migrations: %v", err)
	}

	log.Printf("[+] Found %d migration files to verify.", len(migrations))
	for i, m := range migrations {
		txType := "Go-Managed Transaction"
		if hasInternalTransaction(m.SQL) {
			txType = "Self-Contained Transaction (BEGIN/COMMIT)"
		}
		log.Printf("    %2d. %s [%s] (SHA-256: %s...)", i+1, m.Filename, txType, m.Checksum[:12])
	}

	// 3. Handle Dry Run mode
	if *dryRunFlag {
		log.Println("[+] Dry run complete. All migration files discovered and validated locally.")
		return
	}

	// 4. Retrieve connection string from environment
	dbURL := strings.TrimSpace(os.Getenv("NEON_MIGRATION_URL"))
	if dbURL == "" {
		dbURL = strings.TrimSpace(os.Getenv("DATABASE_URL"))
	}

	if dbURL == "" {
		log.Fatal("[-] ERROR: Environment variable NEON_MIGRATION_URL is not set.\n" +
			"    Please set the NEON_MIGRATION_URL environment variable with your Neon connection string before running.")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	// 5. Connect to PostgreSQL using pgx
	log.Println("[+] Connecting to target PostgreSQL database...")
	connConfig, err := pgx.ParseConfig(dbURL)
	if err != nil {
		log.Fatalf("[-] Failed to parse connection URL: %v", err)
	}

	conn, err := pgx.ConnectConfig(ctx, connConfig)
	if err != nil {
		log.Fatalf("[-] Failed to establish connection to PostgreSQL: %v", err)
	}
	defer conn.Close(ctx)

	log.Println("[+] Successfully connected to PostgreSQL.")

	// 6. Ensure schema_migrations tracking table exists
	if err := initTrackingTable(ctx, conn); err != nil {
		log.Fatalf("[-] Failed to initialize migration tracking table: %v", err)
	}

	// 7. Fetch already applied migrations
	applied, err := fetchAppliedMigrations(ctx, conn)
	if err != nil {
		log.Fatalf("[-] Failed to query applied migrations: %v", err)
	}
	log.Printf("[+] Tracking table contains %d previously applied migration(s).", len(applied))

	// 8. Execute pending migrations in strict order
	pendingCount := 0
	for _, m := range migrations {
		if appliedChecksum, ok := applied[m.Filename]; ok {
			// Checksum validation: Halt immediately if an already-applied file has changed on disk
			if appliedChecksum != m.Checksum {
				log.Fatalf("\n[x] SECURITY INTEGRITY ERROR: Checksum mismatch for already applied migration '%s'!\n"+
					"    Recorded Checksum : %s\n"+
					"    Disk File Checksum: %s\n"+
					"    Halting execution immediately. Modifying already-applied migration files in production is strictly forbidden.",
					m.Filename, appliedChecksum, m.Checksum)
			}
			log.Printf("[-] Skipping already applied: %s", m.Filename)
			continue
		}

		pendingCount++
		log.Printf("[>] Executing migration [%s]...", m.Filename)
		startTime := time.Now()

		if err := executeMigration(ctx, conn, m); err != nil {
			log.Fatalf("\n[x] CRITICAL FAILURE: Migration '%s' failed!\n"+
				"    Error: %v\n"+
				"    Execution halted immediately. No subsequent migrations were executed.\n"+
				"    Please investigate the failure before proceeding.", m.Filename, err)
		}

		duration := time.Since(startTime)
		log.Printf("[v] Successfully applied: %s (took %v)", m.Filename, duration.Round(time.Millisecond))
	}

	if pendingCount == 0 {
		log.Println("[+] All migrations are already up-to-date! No pending migrations to apply.")
	} else {
		log.Printf("[+] Successfully applied all %d pending migration(s)!", pendingCount)
	}
}

func loadMigrations(dir string) ([]Migration, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("reading directory %s: %w", dir, err)
	}

	var filenames []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(strings.ToLower(entry.Name()), ".sql") {
			filenames = append(filenames, entry.Name())
		}
	}

	sort.Strings(filenames)

	var migrations []Migration
	for _, fname := range filenames {
		fullPath := filepath.Join(dir, fname)
		contentBytes, err := os.ReadFile(fullPath)
		if err != nil {
			return nil, fmt.Errorf("reading migration file %s: %w", fname, err)
		}

		hash := sha256.Sum256(contentBytes)
		checksum := hex.EncodeToString(hash[:])

		migrations = append(migrations, Migration{
			Filename: fname,
			FullPath: fullPath,
			Checksum: checksum,
			SQL:      string(contentBytes),
		})
	}

	return migrations, nil
}

func initTrackingTable(ctx context.Context, conn *pgx.Conn) error {
	createTableSQL := `
	CREATE TABLE IF NOT EXISTS public.schema_migrations (
		filename VARCHAR(255) PRIMARY KEY,
		checksum VARCHAR(64) NOT NULL,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
	);
	`
	_, err := conn.Exec(ctx, createTableSQL)
	return err
}

func fetchAppliedMigrations(ctx context.Context, conn *pgx.Conn) (map[string]string, error) {
	rows, err := conn.Query(ctx, "SELECT filename, checksum FROM public.schema_migrations ORDER BY filename")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	applied := make(map[string]string)
	for rows.Next() {
		var filename, checksum string
		if err := rows.Scan(&filename, &checksum); err != nil {
			return nil, err
		}
		applied[filename] = checksum
	}

	return applied, rows.Err()
}

func executeMigration(ctx context.Context, conn *pgx.Conn, m Migration) error {
	// If migration manages its own internal transaction (has BEGIN/COMMIT),
	// execute it directly without an outer Go transaction to prevent nested transaction collision.
	if hasInternalTransaction(m.SQL) {
		_, err := conn.Exec(ctx, m.SQL)
		if err != nil {
			return err
		}

		// Record in tracking table strictly after SQL execution succeeds
		recordSQL := "INSERT INTO public.schema_migrations (filename, checksum, applied_at) VALUES ($1, $2, CURRENT_TIMESTAMP);"
		_, err = conn.Exec(ctx, recordSQL, m.Filename, m.Checksum)
		return err
	}

	// For migrations without internal BEGIN/COMMIT (e.g. 012 and 013),
	// wrap both the migration SQL and the tracking record inside a single atomic Go transaction.
	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, m.SQL); err != nil {
		return fmt.Errorf("executing SQL: %w", err)
	}

	recordSQL := "INSERT INTO public.schema_migrations (filename, checksum, applied_at) VALUES ($1, $2, CURRENT_TIMESTAMP);"
	if _, err := tx.Exec(ctx, recordSQL, m.Filename, m.Checksum); err != nil {
		return fmt.Errorf("recording migration: %w", err)
	}

	return tx.Commit(ctx)
}
