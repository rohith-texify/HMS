package database

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

// AutoMigrateAndSeed non-blockingly ensures platform tables and Super Admin credentials exist.
func AutoMigrateAndSeed(ctx context.Context, pool *pgxpool.Pool, logger *zap.Logger) {
	if pool == nil {
		return
	}

	go func() {
		// Allow the HTTP server to bind to port and pass health checks first
		time.Sleep(500 * time.Millisecond)

		seedCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		logger.Info("ensuring baseline schemas and administrative credentials...")

		// Ensure schemas exist
		_, _ = pool.Exec(seedCtx, `
			CREATE SCHEMA IF NOT EXISTS platform;
			CREATE SCHEMA IF NOT EXISTS app;
			GRANT ALL ON SCHEMA platform TO PUBLIC;
			GRANT ALL ON ALL TABLES IN SCHEMA platform TO PUBLIC;
			GRANT ALL ON SCHEMA app TO PUBLIC;
			GRANT ALL ON ALL TABLES IN SCHEMA app TO PUBLIC;
		`)

		// Ensure roles table exists
		_, _ = pool.Exec(seedCtx, `
			CREATE TABLE IF NOT EXISTS platform.roles (
				role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				role_code VARCHAR(50) UNIQUE NOT NULL,
				role_name VARCHAR(100) NOT NULL,
				scope VARCHAR(20) NOT NULL DEFAULT 'PLATFORM',
				is_system_role BOOLEAN NOT NULL DEFAULT true,
				is_active BOOLEAN NOT NULL DEFAULT true,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
			);
		`)

		// Ensure users table exists
		_, _ = pool.Exec(seedCtx, `
			CREATE TABLE IF NOT EXISTS app.users (
				user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				email VARCHAR(255) UNIQUE NOT NULL,
				phone VARCHAR(50),
				password_hash VARCHAR(255),
				status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
				mfa_enabled BOOLEAN NOT NULL DEFAULT false,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
			);
		`)

		// Ensure user_roles table exists
		_, _ = pool.Exec(seedCtx, `
			CREATE TABLE IF NOT EXISTS platform.user_roles (
				user_role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				user_id UUID NOT NULL,
				role_id UUID NOT NULL,
				college_id UUID,
				status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
				assigned_by UUID,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
			);
		`)

		// Ensure SUPER_ADMIN role exists
		superAdminRoleID := uuid.MustParse("c39b3d01-47cc-4f5d-a705-994c4b686584")
		_, _ = pool.Exec(seedCtx, `
			INSERT INTO platform.roles (role_id, role_code, role_name, scope, is_system_role, is_active)
			VALUES ($1, 'SUPER_ADMIN', 'Super Administrator', 'PLATFORM', true, true)
			ON CONFLICT (role_code) DO NOTHING
		`, superAdminRoleID)

		// Seed Super Admin accounts with bcrypt hash
		defaultAdmins := []struct {
			Email    string
			Password string
		}{
			{"admin@hms.local", "AdminPassword123!"},
			{"superadmin@hms.local", "AdminPassword123!"},
			{"dev.admin@hms.local", "HMS@Dev123"},
		}

		for _, admin := range defaultAdmins {
			hash, err := bcrypt.GenerateFromPassword([]byte(admin.Password), bcrypt.DefaultCost)
			if err != nil {
				continue
			}
			hashStr := string(hash)

			var userID uuid.UUID
			err = pool.QueryRow(seedCtx, "SELECT user_id FROM app.users WHERE LOWER(email) = LOWER($1)", admin.Email).Scan(&userID)
			if err != nil {
				userID = uuid.New()
				_, _ = pool.Exec(seedCtx, `
					INSERT INTO app.users (user_id, email, password_hash, status, mfa_enabled)
					VALUES ($1, $2, $3, 'ACTIVE', false)
					ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE'
				`, userID, admin.Email, hashStr)
			} else {
				_, _ = pool.Exec(seedCtx, "UPDATE app.users SET password_hash = $1, status = 'ACTIVE' WHERE user_id = $2", hashStr, userID)
			}

			// Ensure user_roles entry
			var userRoleExists bool
			_ = pool.QueryRow(seedCtx, "SELECT EXISTS(SELECT 1 FROM platform.user_roles WHERE user_id = $1 AND role_id = $2)", userID, superAdminRoleID).Scan(&userRoleExists)
			if !userRoleExists {
				_, _ = pool.Exec(seedCtx, `
					INSERT INTO platform.user_roles (user_id, role_id, college_id, status)
					VALUES ($1, $2, NULL, 'ACTIVE')
				`, userID, superAdminRoleID)
			}
		}

		logger.Info("baseline schemas and administrative credentials ready")
	}()
}
