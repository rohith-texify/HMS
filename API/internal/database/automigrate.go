package database

import (
	"context"
	"time"

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
		_, _ = pool.Exec(seedCtx, `
			INSERT INTO platform.roles (role_id, role_code, role_name, scope, is_system_role)
			VALUES (gen_random_uuid(), 'SUPER_ADMIN', 'Super Administrator', 'PLATFORM', true)
			ON CONFLICT (role_code) DO NOTHING;
		`)

		// Ensure platform Super Administrator accounts exist in app.users and platform.user_roles
		rohithHash := "$2a$10$6sAZAT4w7qsF.Ur951IKKO4UT.FGMvHVuVcGBJaJb4AoKNK.MxlGm" // Rohith@acet
		defaultHash := "$2a$10$B90DjDWozEnhYq7GiqDqPupzs0IFkz5hsd50TFzilTsVtTv4TNBXm" // Password@123

		if _, err := pool.Exec(seedCtx, `
			INSERT INTO app.users (user_id, email, phone, password_hash, status)
			VALUES (gen_random_uuid(), 'rohith.texify@gmail.com', '+919999999999', $1, 'ACTIVE')
			ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE'
		`, rohithHash); err != nil {
			logger.Warn("failed to upsert rohith.texify user", zap.Error(err))
		}

		if _, err := pool.Exec(seedCtx, `
			INSERT INTO platform.user_roles (user_id, role_id, status)
			SELECT u.user_id, r.role_id, 'ACTIVE'
			FROM app.users u
			CROSS JOIN platform.roles r
			WHERE LOWER(u.email) = 'rohith.texify@gmail.com'
			  AND r.role_code = 'SUPER_ADMIN'
			  AND NOT EXISTS (
				SELECT 1 FROM platform.user_roles ur
				WHERE ur.user_id = u.user_id AND ur.role_id = r.role_id
			  )
		`); err != nil {
			logger.Warn("failed to link rohith.texify super admin role", zap.Error(err))
		}

		if _, err := pool.Exec(seedCtx, `
			INSERT INTO app.users (user_id, email, phone, password_hash, status)
			VALUES (gen_random_uuid(), 'superadmin@hms.local', '+919999999999', $1, 'ACTIVE')
			ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE'
		`, defaultHash); err != nil {
			logger.Warn("failed to upsert superadmin@hms.local user", zap.Error(err))
		}

		if _, err := pool.Exec(seedCtx, `
			INSERT INTO platform.user_roles (user_id, role_id, status)
			SELECT u.user_id, r.role_id, 'ACTIVE'
			FROM app.users u
			CROSS JOIN platform.roles r
			WHERE LOWER(u.email) = 'superadmin@hms.local'
			  AND r.role_code = 'SUPER_ADMIN'
			  AND NOT EXISTS (
				SELECT 1 FROM platform.user_roles ur
				WHERE ur.user_id = u.user_id AND ur.role_id = r.role_id
			  )
		`); err != nil {
			logger.Warn("failed to link superadmin@hms.local super admin role", zap.Error(err))
		}

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
			CREATE INDEX IF NOT EXISTS idx_role_permissions_perm ON platform.role_permissions (permission_id);
			CREATE INDEX IF NOT EXISTS idx_permissions_code ON platform.permissions (permission_code);
			CREATE INDEX IF NOT EXISTS idx_permissions_module_scope ON platform.permissions (module_id, scope_type);
			CREATE INDEX IF NOT EXISTS idx_permissions_scope ON platform.permissions (scope_type);
			CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON platform.user_roles (user_id, role_id);
			CREATE INDEX IF NOT EXISTS idx_user_roles_college_role ON platform.user_roles (college_id, role_id, status);
			CREATE INDEX IF NOT EXISTS idx_college_onboarding_lookup ON platform.college_onboarding (college_id, status, step_code);
			CREATE INDEX IF NOT EXISTS idx_colleges_onboarding ON platform.colleges (status, is_active, created_at DESC);
			CREATE INDEX IF NOT EXISTS idx_approval_requests_col_stat ON platform.approval_requests (college_id, status);
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
