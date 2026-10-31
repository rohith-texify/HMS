package database

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

// AutoMigrateAndSeed non-blockingly ensures baseline platform tables and roles exist.
// No dummy credentials or test accounts are created.
func AutoMigrateAndSeed(ctx context.Context, pool *pgxpool.Pool, logger *zap.Logger) {
	if pool == nil {
		return
	}

	go func() {
		// Allow HTTP server to bind to port and pass health checks first
		time.Sleep(500 * time.Millisecond)

		seedCtx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
		defer cancel()

		logger.Info("ensuring baseline schemas and platform roles...")

		// Ensure schemas exist
		_, _ = pool.Exec(seedCtx, `
			CREATE SCHEMA IF NOT EXISTS platform;
			CREATE SCHEMA IF NOT EXISTS app;
		`)

		// Ensure platform.roles table exists
		_, _ = pool.Exec(seedCtx, `
			CREATE TABLE IF NOT EXISTS platform.roles (
				role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				role_code VARCHAR(50) UNIQUE NOT NULL,
				role_name VARCHAR(100) NOT NULL,
				scope VARCHAR(20) NOT NULL DEFAULT 'PLATFORM',
				is_system_role BOOLEAN NOT NULL DEFAULT true,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
			);
		`)

		// Ensure app.users table exists and has all required columns
		_, _ = pool.Exec(seedCtx, `
			CREATE TABLE IF NOT EXISTS app.users (
				user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				email VARCHAR(255) UNIQUE NOT NULL,
				phone VARCHAR(50),
				password_hash VARCHAR(255),
				status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
				mfa_enabled BOOLEAN NOT NULL DEFAULT false,
				last_login_at TIMESTAMPTZ,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
			);
			ALTER TABLE app.users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
			ALTER TABLE app.users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
			ALTER TABLE app.users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false;
			CREATE INDEX IF NOT EXISTS idx_users_lower_email ON app.users (LOWER(email));
		`)

		// Ensure platform.user_roles table exists
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
			CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON platform.user_roles (user_id);
		`)

		// Ensure SUPER_ADMIN role exists in platform.roles
		superAdminRoleID := uuid.MustParse("54cd22f3-954e-4e10-9d5a-1d971a535422")
		_, _ = pool.Exec(seedCtx, `
			INSERT INTO platform.roles (role_id, role_code, role_name, scope, is_system_role)
			VALUES ($1, 'SUPER_ADMIN', 'Super Administrator', 'PLATFORM', true)
			ON CONFLICT (role_code) DO NOTHING;
		`, superAdminRoleID)

		// Ensure high-performance indexes across all modules (platform + app)
		_, _ = pool.Exec(seedCtx, `
			CREATE INDEX IF NOT EXISTS idx_colleges_status ON platform.colleges (status);
			CREATE INDEX IF NOT EXISTS idx_colleges_created_at ON platform.colleges (created_at DESC);
			CREATE INDEX IF NOT EXISTS idx_college_modules_college ON platform.college_modules (college_id, status);
			CREATE INDEX IF NOT EXISTS idx_modules_kind_active ON platform.modules (kind, is_active);
			CREATE INDEX IF NOT EXISTS idx_college_settings_key ON platform.college_settings (college_id, setting_key);
			CREATE INDEX IF NOT EXISTS idx_approvals_college_status ON platform.approvals (college_id, status);
			CREATE INDEX IF NOT EXISTS idx_approvals_created_at ON platform.approvals (created_at DESC);
			CREATE INDEX IF NOT EXISTS idx_audit_logs_college_created ON platform.audit_logs (college_id, created_at DESC);
			CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON platform.role_permissions (role_id);
			CREATE INDEX IF NOT EXISTS idx_permissions_code ON platform.permissions (permission_code);
		`)

		_, _ = pool.Exec(seedCtx, `
			CREATE INDEX IF NOT EXISTS idx_students_college_status ON app.students (college_id, student_status);
			CREATE INDEX IF NOT EXISTS idx_students_college_created ON app.students (college_id, created_at DESC);
			CREATE INDEX IF NOT EXISTS idx_staff_profiles_college_status ON app.staff_profiles (college_id, employment_status);
			CREATE INDEX IF NOT EXISTS idx_hostels_college_status ON app.hostels (college_id, status);
			CREATE INDEX IF NOT EXISTS idx_blocks_college_hostel ON app.blocks (college_id, hostel_id);
			CREATE INDEX IF NOT EXISTS idx_floors_college_block ON app.floors (college_id, block_id);
			CREATE INDEX IF NOT EXISTS idx_rooms_college_floor ON app.rooms (college_id, floor_id);
			CREATE INDEX IF NOT EXISTS idx_beds_college_room ON app.beds (college_id, room_id);
		`)

		logger.Info("baseline schemas, roles, and performance indexes verified")
	}()
}
