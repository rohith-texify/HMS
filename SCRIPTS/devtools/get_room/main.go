package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	connString := os.Getenv("HMS_DEV_DATABASE_URL")
	if connString == "" {
		log.Fatal("Error: HMS_DEV_DATABASE_URL environment variable is not set. Please set it to a valid connection string.")
	}

	pool, err := pgxpool.New(context.Background(), connString)
	if err != nil {
		log.Fatal("Failed to parse connection string:", err)
	}
	defer pool.Close()

	var roomID string
	// The original query was "SELECT room_id FROM college.rooms LIMIT 1"
	// However, the HMS schema uses the "app" schema, and the table is "rooms"
	// with the primary key column "id" (not room_id).
	err = pool.QueryRow(context.Background(), "SELECT id FROM app.rooms LIMIT 1").Scan(&roomID)
	if err != nil {
		log.Fatal("Query failed:", err)
	}
	fmt.Print(roomID)
}
