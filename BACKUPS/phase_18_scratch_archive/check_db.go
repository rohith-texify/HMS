package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(".env"); err != nil {
		log.Fatal("Error loading .env file")
	}

	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	user := os.Getenv("DB_USER")
	pass := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")
	sslmode := os.Getenv("DB_SSLMODE")

	if host == "" || user == "" || dbname == "" {
		log.Fatal("Missing database connection variables in .env")
	}
	if sslmode == "" {
		sslmode = "disable"
	}

	dbUrl := fmt.Sprintf("user=%s password=%s host=%s port=%s dbname=%s sslmode=%s", user, pass, host, port, dbname, sslmode)

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbUrl)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}
	defer pool.Close()

	fmt.Println("--- DATABASE INSPECTION ---")

	var dbName, currentUser string
	var isSuperuser bool

	err = pool.QueryRow(ctx, "SELECT current_database(), current_user, rolsuper FROM pg_roles WHERE rolname = current_user").Scan(&dbName, &currentUser, &isSuperuser)

	if err != nil {
		log.Fatalf("Query failed: %v", err)
	}
	fmt.Printf("Current Database: %s\n", dbName)
	fmt.Printf("Current User: %s\n", currentUser)
	fmt.Printf("Is Superuser: %v\n", isSuperuser)

	fmt.Println("\n--- SCHEMAS ---")
	for _, schema := range []string{"platform", "app"} {
		var exists bool
		err = pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)", schema).Scan(&exists)
		fmt.Printf("Schema '%s' exists: %v\n", schema, exists)
	}

	tablesToCheck := []string{
		"attendance_cards", "attendance_records", "entry_exit_records", "record_corrections",
		"departments", "programs", "courses", "batches", "academic_years", "semesters", "users",
	}

	fmt.Println("\n--- APP TABLES ---")
	for _, table := range tablesToCheck {
		var exists bool
		err = pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'app' AND table_name = $1)", table).Scan(&exists)
		if exists {
			var rls bool
			var forced bool
			err = pool.QueryRow(ctx, "SELECT relrowsecurity, relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'app' AND c.relname = $1", table).Scan(&rls, &forced)
			fmt.Printf("app.%s exists: %v (RLS enabled: %v, Forced: %v)\n", table, exists, rls, forced)

			// Get PK
			pkQuery := `
			SELECT a.attname
			FROM   pg_index i
			JOIN   pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
			WHERE  i.indrelid = ('app.' || $1)::regclass
			AND    i.indisprimary;`
			rows, _ := pool.Query(ctx, pkQuery, table)
			var pks []string
			for rows.Next() {
				var pk string
				rows.Scan(&pk)
				pks = append(pks, pk)
			}
			rows.Close()
			fmt.Printf("  PK: %s\n", strings.Join(pks, ", "))

		} else {
			fmt.Printf("app.%s exists: %v\n", table, exists)
		}
	}

	fmt.Println("\n--- PLATFORM TABLES ---")
	for _, table := range []string{"colleges"} {
		var exists bool
		err = pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'platform' AND table_name = $1)", table).Scan(&exists)
		if exists {
			var rls bool
			var forced bool
			err = pool.QueryRow(ctx, "SELECT relrowsecurity, relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'platform' AND c.relname = $1", table).Scan(&rls, &forced)
			fmt.Printf("platform.%s exists: %v (RLS enabled: %v, Forced: %v)\n", table, exists, rls, forced)

			// Get PK
			pkQuery := `
			SELECT a.attname
			FROM   pg_index i
			JOIN   pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
			WHERE  i.indrelid = ('platform.' || $1)::regclass
			AND    i.indisprimary;`
			rows, _ := pool.Query(ctx, pkQuery, table)
			var pks []string
			for rows.Next() {
				var pk string
				rows.Scan(&pk)
				pks = append(pks, pk)
			}
			rows.Close()
			fmt.Printf("  PK: %s\n", strings.Join(pks, ", "))

		} else {
			fmt.Printf("platform.%s exists: %v\n", table, exists)
		}
	}
}
