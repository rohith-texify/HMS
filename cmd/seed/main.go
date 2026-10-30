package main

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
)

func main() {
	// Build connection string from environment or hardcode
	dbHost := getEnv("DB_HOST", "localhost")
	dbPort := getEnv("DB_PORT", "5432")
	dbName := getEnv("DB_NAME", "HMS")
	dbUser := getEnv("DB_USER", "postgres")
	dbPassword := getEnv("DB_PASSWORD", "Rohith@acet")

	// URL encode password to handle special characters
	encodedPassword := url.QueryEscape(dbPassword)
	connStr := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		dbUser, encodedPassword, dbHost, dbPort, dbName)

	log.Println("=================================================================")
	log.Println("HMS Database Seeding - Create/Update Superadmin User")
	log.Println("=================================================================")
	log.Printf("Connecting to: %s:%s/%s as %s\n", dbHost, dbPort, dbName, dbUser)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, connStr)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer conn.Close(ctx)

	log.Println("✓ Connected to database")

	// Seed superadmin user
	email := "superadmin@hms.local"
	phone := "+919999999999"
	// Bcrypt hash of "Password@123" - Generated with bcrypt.GenerateFromPassword
	passwordHash := "$2a$10$an3BUeO0/2Mih9QiJcrEXO/X5tLxVdza0BhoP6oWnNhkJSZiirSoq"

	log.Printf("\nSeeding superadmin user: %s\n", email)

	// Insert or update user
	_, err = conn.Exec(ctx, `
		INSERT INTO app.users (email, phone, password_hash, status, created_at, updated_at)
		VALUES ($1, $2, $3, 'ACTIVE', NOW(), NOW())
		ON CONFLICT (email) DO UPDATE SET password_hash = $3, status = 'ACTIVE', updated_at = NOW();
	`, email, phone, passwordHash)

	if err != nil {
		log.Fatalf("Failed to insert/update user: %v", err)
	}
	log.Println("✓ User created/updated with correct password hash")

	// Get user ID
	var userID string
	err = conn.QueryRow(ctx, "SELECT user_id FROM app.users WHERE email = $1", email).Scan(&userID)
	if err != nil {
		log.Fatalf("Failed to fetch user ID: %v", err)
	}
	log.Printf("✓ User ID: %s\n", userID)

	// Get SUPER_ADMIN role ID
	var roleID string
	err = conn.QueryRow(ctx, "SELECT role_id FROM platform.roles WHERE role_code = 'SUPER_ADMIN'").Scan(&roleID)
	if err != nil {
		log.Fatalf("Failed to fetch SUPER_ADMIN role ID: %v", err)
	}
	log.Printf("✓ SUPER_ADMIN role ID: %s\n", roleID)

	// Delete existing role assignment if any
	_, _ = conn.Exec(ctx, "DELETE FROM platform.user_roles WHERE user_id = $1 AND role_id = $2", userID, roleID)

	// Assign role
	_, err = conn.Exec(ctx, `
		INSERT INTO platform.user_roles (user_id, role_id, college_id, status, created_at, updated_at)
		VALUES ($1, $2, NULL, 'ACTIVE', NOW(), NOW())
	`, userID, roleID)

	if err != nil {
		log.Fatalf("Failed to assign role: %v", err)
	}
	log.Println("✓ SUPER_ADMIN role assigned")

	log.Println("\n=================================================================")
	log.Println("✓ Superadmin user seeded successfully!")
	log.Println("=================================================================")
	log.Println("\nTest Credentials:")
	log.Println("  Email:    superadmin@hms.local")
	log.Println("  Password: Password@123")
	log.Println("")
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
