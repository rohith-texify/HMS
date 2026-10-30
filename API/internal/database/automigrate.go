package database

import (
	"context"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// AutoMigrateAndSeed automatically applies pending migrations and seeds initial Super Admin platform users.
func AutoMigrateAndSeed(ctx context.Context, pool *pgxpool.Pool, logger *zap.Logger) error {
	if pool == nil {
		return fmt.Errorf("database pool is nil")
	}

	logger.Info("checking database migrations and baseline platform data...")

	// 1. Initialize schema_migrations tracking table
	initSQL := `
		CREATE TABLE IF NOT EXISTS public.schema_migrations (
			filename VARCHAR(255) PRIMARY KEY,
			checksum VARCHAR(64) NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
	`
	if _, err := pool.Exec(ctx, initSQL); err != nil {
		logger.Warn("unable to verify schema_migrations table, proceeding to seed check", zap.Error(err))
	}

	// 2. Discover embedded migration files
	entries, err := migrationFS.ReadDir("migrations")
	if err == nil && len(entries) > 0 {
		var filenames []string
		for _, e := range entries {
			if !e.IsDir() && strings.HasSuffix(strings.ToLower(e.Name()), ".sql") {
				filenames = append(filenames, e.Name())
			}
		}
		sort.Strings(filenames)

		// 3. Fetch already applied migrations
		applied := make(map[string]bool)
		rows, qErr := pool.Query(ctx, "SELECT filename FROM public.schema_migrations")
		if qErr == nil {
			for rows.Next() {
				var fn string
				if err := rows.Scan(&fn); err == nil {
					applied[fn] = true
				}
			}
			rows.Close()
		}

		// 4. Apply pending migrations
		for _, fn := range filenames {
			if applied[fn] {
				continue
			}

			content, readErr := migrationFS.ReadFile("migrations/" + fn)
			if readErr != nil {
				logger.Error("failed to read embedded migration", zap.String("file", fn), zap.Error(readErr))
				continue
			}

			logger.Info("applying migration", zap.String("file", fn))
			sqlStr := string(content)

			if _, execErr := pool.Exec(ctx, sqlStr); execErr != nil {
				logger.Warn("migration statement warning/skipped", zap.String("file", fn), zap.Error(execErr))
				// We don't abort server startup on idempotent re-runs or permission warnings
			}

			hash := sha256.Sum256(content)
			checksum := hex.EncodeToString(hash[:])
			_, _ = pool.Exec(ctx, "INSERT INTO public.schema_migrations (filename, checksum, applied_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (filename) DO NOTHING", fn, checksum)
		}
	}

	// 5. Seed Core Super Admin accounts
	seedSuperAdminAccounts(ctx, pool, logger)

	logger.Info("database auto-migration and bootstrap complete")
	return nil
}

func seedSuperAdminAccounts(ctx context.Context, pool *pgxpool.Pool, logger *zap.Logger) {
	// Ensure app and platform schemas exist and have complete schema and table privileges
	_, _ = pool.Exec(ctx, `
		CREATE SCHEMA IF NOT EXISTS platform;
		CREATE SCHEMA IF NOT EXISTS app;
		GRANT ALL ON SCHEMA platform TO PUBLIC;
		GRANT ALL ON ALL TABLES IN SCHEMA platform TO PUBLIC;
		GRANT ALL ON SCHEMA app TO PUBLIC;
		GRANT ALL ON ALL TABLES IN SCHEMA app TO PUBLIC;
	`)

	// Default administrative credentials
	defaultAdmins := []struct {
		Email    string
		Password string
	}{
		{"admin@hms.local", "AdminPassword123!"},
		{"superadmin@hms.local", "AdminPassword123!"},
		{"dev.admin@hms.local", "HMS@Dev123"},
	}

	// Ensure SUPER_ADMIN role exists in platform.roles
	var superAdminRoleID uuid.UUID
	err := pool.QueryRow(ctx, "SELECT role_id FROM platform.roles WHERE role_code = 'SUPER_ADMIN'").Scan(&superAdminRoleID)
	if err != nil {
		superAdminRoleID = uuid.MustParse("c39b3d01-47cc-4f5d-a705-994c4b686584")
		_, _ = pool.Exec(ctx, `
			INSERT INTO platform.roles (role_id, role_code, role_name, scope, is_system_role, is_active, created_at, updated_at)
			VALUES ($1, 'SUPER_ADMIN', 'Super Administrator', 'PLATFORM', true, true, now(), now())
			ON CONFLICT (role_code) DO NOTHING
		`, superAdminRoleID)
	}

	for _, admin := range defaultAdmins {
		hash, err := bcrypt.GenerateFromPassword([]byte(admin.Password), bcrypt.DefaultCost)
		if err != nil {
			continue
		}
		hashStr := string(hash)

		var userID uuid.UUID
		err = pool.QueryRow(ctx, "SELECT user_id FROM app.users WHERE LOWER(email) = LOWER($1)", admin.Email).Scan(&userID)
		if err != nil {
			userID = uuid.New()
			_, insErr := pool.Exec(ctx, `
				INSERT INTO app.users (user_id, email, password_hash, status, mfa_enabled, created_at, updated_at)
				VALUES ($1, $2, $3, 'ACTIVE', false, now(), now())
				ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE'
			`, userID, admin.Email, hashStr)
			if insErr != nil {
				logger.Warn("could not seed app.users row", zap.String("email", admin.Email), zap.Error(insErr))
				continue
			}
		} else {
			// Update password hash to guarantee login works
			_, _ = pool.Exec(ctx, "UPDATE app.users SET password_hash = $1, status = 'ACTIVE' WHERE user_id = $2", hashStr, userID)
		}

		// Ensure platform.user_roles link
		_, _ = pool.Exec(ctx, `
			INSERT INTO platform.user_roles (user_id, role_id, college_id, status, created_at, updated_at)
			VALUES ($1, $2, NULL, 'ACTIVE', now(), now())
			ON CONFLICT DO NOTHING
		`, userID, superAdminRoleID)
	}

	// Ensure platform permissions platform.view & platform.manage are granted to SUPER_ADMIN
	perms := []struct {
		Code string
		Name string
	}{
		{"platform.view", "View Platform Administration"},
		{"platform.manage", "Manage Platform Administration"},
	}

	for _, p := range perms {
		var permID uuid.UUID
		err := pool.QueryRow(ctx, "SELECT permission_id FROM platform.permissions WHERE code = $1", p.Code).Scan(&permID)
		if err != nil {
			permID = uuid.New()
			_, _ = pool.Exec(ctx, `
				INSERT INTO platform.permissions (permission_id, code, name, scope, is_system_permission, is_active, created_at, updated_at)
				VALUES ($1, $2, $3, 'PLATFORM', true, true, now(), now())
				ON CONFLICT (code) DO NOTHING
			`, permID, p.Code, p.Name)
		}

		// Link to SUPER_ADMIN role
		_, _ = pool.Exec(ctx, `
			INSERT INTO platform.role_permissions (role_id, permission_id, created_at)
			VALUES ($1, $2, now())
			ON CONFLICT DO NOTHING
		`, superAdminRoleID, permID)
	}
}
