package main

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		fmt.Println("DATABASE_URL environment variable is not set")
		return
	}
	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		fmt.Println("Error connecting:", err)
		os.Exit(1)
	}
	defer pool.Close()

	rows, err := pool.Query(context.Background(), "SELECT id, college_id FROM app.staff_profiles")
	if err != nil {
		fmt.Println("Error querying:", err)
		os.Exit(1)
	}
	defer rows.Close()

	for rows.Next() {
		var id, college string
		rows.Scan(&id, &college)
		fmt.Printf("Staff: %s, College: %s\n", id, college)
	}

	fmt.Println("---")
	var count int
	pool.QueryRow(context.Background(), "SELECT count(*) FROM app.security_assignments").Scan(&count)
	fmt.Printf("Security assignments count: %d\n", count)
}
