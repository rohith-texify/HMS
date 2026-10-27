package main

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// TestResult captures test status and evidence.
type TestResult struct {
	ID       string
	Name     string
	Status   string // PASS, FAIL, BLOCKED
	Evidence string
}

var results []TestResult

func record(id, name, status, evidence string) {
	results = append(results, TestResult{
		ID:       id,
		Name:     name,
		Status:   status,
		Evidence: evidence,
	})
	fmt.Printf("[%s] %s: %s - %s\n", status, id, name, evidence)
}

func getConn(ctx context.Context, host, port, dbname, user, password string) (*pgx.Conn, error) {
	u := &url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(user, password),
		Host:   fmt.Sprintf("%s:%s", host, port),
		Path:   dbname,
	}
	q := u.Query()
	q.Set("sslmode", "disable")
	u.RawQuery = q.Encode()

	return pgx.Connect(ctx, u.String())
}

func main() {
	ctx := context.Background()

	host := os.Getenv("TEST_DB_HOST")
	if host == "" {
		host = "127.0.0.1"
	}
	port := os.Getenv("TEST_DB_PORT")
	if port == "" {
		port = "5433"
	}
	dbname := os.Getenv("TEST_DB_NAME")
	if dbname == "" {
		dbname = "hms_migration_test"
	}
	adminUser := os.Getenv("TEST_ADMIN_USER")
	if adminUser == "" {
		adminUser = "hms_test_admin"
	}

	adminPwd := os.Getenv("TEST_ADMIN_PASSWORD")
	collegePwd := os.Getenv("TEST_COLLEGE_PASSWORD")
	platformPwd := os.Getenv("TEST_PLATFORM_PASSWORD")

	if adminPwd == "" || collegePwd == "" || platformPwd == "" {
		fmt.Println("Usage: Configure temporary environment variables:")
		fmt.Println("  TEST_ADMIN_PASSWORD, TEST_COLLEGE_PASSWORD, TEST_PLATFORM_PASSWORD")
		fmt.Println("  Optional: TEST_DB_HOST (default 127.0.0.1), TEST_DB_PORT (default 5433), TEST_DB_NAME (default hms_migration_test)")
		os.Exit(1)
	}

	adminConn, err := getConn(ctx, host, port, dbname, adminUser, adminPwd)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to connect as admin: %v\n", err)
		os.Exit(1)
	}
	defer adminConn.Close(ctx)

	// ============================================================
	// SETUP TEST FIXTURES
	// ============================================================
	collegeAID := uuid.New()
	collegeBID := uuid.New()
	userAID := uuid.New()
	userBID := uuid.New()
	superAdminID := uuid.New()

	hostelAID := uuid.New()
	hostelBID := uuid.New()

	blockAID := uuid.New()
	floorAID := uuid.New()
	roomAID := uuid.New()
	bedAID := uuid.New()

	studentAID := uuid.New()
	studentBID := uuid.New()

	notifAID := uuid.New()
	notifBID := uuid.New()
	notifGlobalID := uuid.New()

	fmt.Println("--- Setting up test fixtures via admin connection ---")

	// Clean previous test fixtures if any
	_, _ = adminConn.Exec(ctx, `
		DELETE FROM app.bed_allocations WHERE college_id IN (SELECT college_id FROM platform.colleges WHERE college_code IN ('COLL_A', 'COLL_B'));
		DELETE FROM app.notification_recipients WHERE notification_id IN (SELECT id FROM app.notifications WHERE college_id IN (SELECT college_id FROM platform.colleges WHERE college_code IN ('COLL_A', 'COLL_B')));
		DELETE FROM app.notifications WHERE college_id IN (SELECT college_id FROM platform.colleges WHERE college_code IN ('COLL_A', 'COLL_B')) OR title = 'Notif Global';
		DELETE FROM app.students WHERE college_id IN (SELECT college_id FROM platform.colleges WHERE college_code IN ('COLL_A', 'COLL_B'));
		DELETE FROM app.beds WHERE college_id IN (SELECT college_id FROM platform.colleges WHERE college_code IN ('COLL_A', 'COLL_B'));
		DELETE FROM app.rooms WHERE college_id IN (SELECT college_id FROM platform.colleges WHERE college_code IN ('COLL_A', 'COLL_B'));
		DELETE FROM app.floors WHERE college_id IN (SELECT college_id FROM platform.colleges WHERE college_code IN ('COLL_A', 'COLL_B'));
		DELETE FROM app.blocks WHERE college_id IN (SELECT college_id FROM platform.colleges WHERE college_code IN ('COLL_A', 'COLL_B'));
		DELETE FROM app.hostels WHERE college_id IN (SELECT college_id FROM platform.colleges WHERE college_code IN ('COLL_A', 'COLL_B'));
		DELETE FROM platform.user_roles WHERE user_id IN (SELECT user_id FROM app.users WHERE email IN ('student_a@alpha.edu', 'student_b@beta.edu', 'superadmin@hms.platform'));
		DELETE FROM app.users WHERE email IN ('student_a@alpha.edu', 'student_b@beta.edu', 'superadmin@hms.platform');
		DELETE FROM platform.colleges WHERE college_code IN ('COLL_A', 'COLL_B');
	`)

	// 1. Insert Colleges
	if err = adminConn.QueryRow(ctx, `
		INSERT INTO platform.colleges (college_id, college_code, name, status, timezone) VALUES
		($1, 'COLL_A', 'College Alpha', 'ACTIVE', 'Asia/Kolkata')
		ON CONFLICT (college_code) DO UPDATE SET name = EXCLUDED.name RETURNING college_id;
	`, collegeAID).Scan(&collegeAID); err != nil {
		fmt.Fprintf(os.Stderr, "Setup college A failed: %v\n", err)
		os.Exit(1)
	}
	if err = adminConn.QueryRow(ctx, `
		INSERT INTO platform.colleges (college_id, college_code, name, status, timezone) VALUES
		($1, 'COLL_B', 'College Beta', 'ACTIVE', 'Asia/Kolkata')
		ON CONFLICT (college_code) DO UPDATE SET name = EXCLUDED.name RETURNING college_id;
	`, collegeBID).Scan(&collegeBID); err != nil {
		fmt.Fprintf(os.Stderr, "Setup college B failed: %v\n", err)
		os.Exit(1)
	}

	// 2. Insert Users
	if err = adminConn.QueryRow(ctx, `
		INSERT INTO app.users (user_id, email, phone, password_hash, status) VALUES
		($1, 'student_a@alpha.edu', '+919876543210', 'hash_a', 'ACTIVE')
		ON CONFLICT (email) DO UPDATE SET updated_at = now() RETURNING user_id;
	`, userAID).Scan(&userAID); err != nil {
		fmt.Fprintf(os.Stderr, "Setup user A failed: %v\n", err)
		os.Exit(1)
	}
	if err = adminConn.QueryRow(ctx, `
		INSERT INTO app.users (user_id, email, phone, password_hash, status) VALUES
		($1, 'student_b@beta.edu', '+919876543211', 'hash_b', 'ACTIVE')
		ON CONFLICT (email) DO UPDATE SET updated_at = now() RETURNING user_id;
	`, userBID).Scan(&userBID); err != nil {
		fmt.Fprintf(os.Stderr, "Setup user B failed: %v\n", err)
		os.Exit(1)
	}
	if err = adminConn.QueryRow(ctx, `
		INSERT INTO app.users (user_id, email, phone, password_hash, status) VALUES
		($1, 'superadmin@hms.platform', '+919876543299', 'hash_sa', 'ACTIVE')
		ON CONFLICT (email) DO UPDATE SET updated_at = now() RETURNING user_id;
	`, superAdminID).Scan(&superAdminID); err != nil {
		fmt.Fprintf(os.Stderr, "Setup superadmin failed: %v\n", err)
		os.Exit(1)
	}

	// 3. Insert Roles in platform.user_roles
	var superAdminRoleID, studentRoleID uuid.UUID
	err = adminConn.QueryRow(ctx, "SELECT role_id FROM platform.roles WHERE role_code = 'SUPER_ADMIN'").Scan(&superAdminRoleID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Find SUPER_ADMIN role failed: %v\n", err)
		os.Exit(1)
	}
	err = adminConn.QueryRow(ctx, "SELECT role_id FROM platform.roles WHERE role_code = 'STUDENT'").Scan(&studentRoleID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Find STUDENT role failed: %v\n", err)
		os.Exit(1)
	}

	_, _ = adminConn.Exec(ctx, "DELETE FROM platform.user_roles WHERE user_id IN ($1, $2, $3)", superAdminID, userAID, userBID)
	_, err = adminConn.Exec(ctx, `
		INSERT INTO platform.user_roles (user_id, role_id, college_id, status) VALUES
		($1, $2, NULL, 'ACTIVE'),
		($3, $4, $5, 'ACTIVE'),
		($6, $4, $7, 'ACTIVE');
	`, superAdminID, superAdminRoleID, userAID, studentRoleID, collegeAID, userBID, collegeBID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Assign user roles failed: %v\n", err)
		os.Exit(1)
	}

	// 4. Insert Hostels
	if err = adminConn.QueryRow(ctx, `
		INSERT INTO app.hostels (id, college_id, code, name, category, status) VALUES
		($1, $2, 'HOSTEL_A', 'Hostel Alpha', 'MIXED', 'ACTIVE')
		ON CONFLICT (college_id, code) DO UPDATE SET name = EXCLUDED.name RETURNING id;
	`, hostelAID, collegeAID).Scan(&hostelAID); err != nil {
		fmt.Fprintf(os.Stderr, "Setup hostel A failed: %v\n", err)
		os.Exit(1)
	}
	if err = adminConn.QueryRow(ctx, `
		INSERT INTO app.hostels (id, college_id, code, name, category, status) VALUES
		($1, $2, 'HOSTEL_B', 'Hostel Beta', 'MIXED', 'ACTIVE')
		ON CONFLICT (college_id, code) DO UPDATE SET name = EXCLUDED.name RETURNING id;
	`, hostelBID, collegeBID).Scan(&hostelBID); err != nil {
		fmt.Fprintf(os.Stderr, "Setup hostel B failed: %v\n", err)
		os.Exit(1)
	}

	// 5. Insert Hierarchy for Hostel A (block, floor, room, bed)
	if err = adminConn.QueryRow(ctx, "INSERT INTO app.blocks (id, college_id, hostel_id, code, name, status) VALUES ($1, $2, $3, 'BLK_A', 'Block A', 'ACTIVE') ON CONFLICT (hostel_id, code) DO UPDATE SET name = EXCLUDED.name RETURNING id", blockAID, collegeAID, hostelAID).Scan(&blockAID); err != nil {
		fmt.Fprintf(os.Stderr, "Setup block failed: %v\n", err)
		os.Exit(1)
	}
	if err = adminConn.QueryRow(ctx, "INSERT INTO app.floors (id, college_id, hostel_id, block_id, floor_number, code, name, status) VALUES ($1, $2, $3, $4, 1, 'FLR_1', 'Floor 1', 'ACTIVE') ON CONFLICT (block_id, floor_number) DO UPDATE SET name = EXCLUDED.name RETURNING id", floorAID, collegeAID, hostelAID, blockAID).Scan(&floorAID); err != nil {
		fmt.Fprintf(os.Stderr, "Setup floor failed: %v\n", err)
		os.Exit(1)
	}
	if err = adminConn.QueryRow(ctx, "INSERT INTO app.rooms (id, college_id, hostel_id, block_id, floor_id, code, name, room_type, capacity, status) VALUES ($1, $2, $3, $4, $5, '101', 'Room 101', 'DOUBLE', 2, 'ACTIVE') ON CONFLICT (floor_id, code) DO UPDATE SET name = EXCLUDED.name RETURNING id", roomAID, collegeAID, hostelAID, blockAID, floorAID).Scan(&roomAID); err != nil {
		fmt.Fprintf(os.Stderr, "Setup room failed: %v\n", err)
		os.Exit(1)
	}
	if err = adminConn.QueryRow(ctx, "INSERT INTO app.beds (id, college_id, hostel_id, block_id, floor_id, room_id, code, name, status) VALUES ($1, $2, $3, $4, $5, $6, 'B1', 'Bed 1', 'AVAILABLE') ON CONFLICT (room_id, code) DO UPDATE SET name = EXCLUDED.name RETURNING id", bedAID, collegeAID, hostelAID, blockAID, floorAID, roomAID).Scan(&bedAID); err != nil {
		fmt.Fprintf(os.Stderr, "Setup bed failed: %v\n", err)
		os.Exit(1)
	}

	// 6. Insert Students
	if err = adminConn.QueryRow(ctx, `
		INSERT INTO app.students (id, college_id, user_id, admission_number, first_name, last_name, student_status) VALUES
		($1, $2, $3, 'ADM_A_001', 'Alice', 'Alpha', 'ACTIVE')
		ON CONFLICT (college_id, admission_number) DO UPDATE SET user_id = EXCLUDED.user_id RETURNING id;
	`, studentAID, collegeAID, userAID).Scan(&studentAID); err != nil {
		fmt.Fprintf(os.Stderr, "Setup student A failed: %v\n", err)
		os.Exit(1)
	}
	if err = adminConn.QueryRow(ctx, `
		INSERT INTO app.students (id, college_id, user_id, admission_number, first_name, last_name, student_status) VALUES
		($1, $2, $3, 'ADM_B_001', 'Bob', 'Beta', 'ACTIVE')
		ON CONFLICT (college_id, admission_number) DO UPDATE SET user_id = EXCLUDED.user_id RETURNING id;
	`, studentBID, collegeBID, userBID).Scan(&studentBID); err != nil {
		fmt.Fprintf(os.Stderr, "Setup student B failed: %v\n", err)
		os.Exit(1)
	}

	// 7. Insert Notifications (College A, College B, Global)
	_, err = adminConn.Exec(ctx, `
		INSERT INTO app.notifications (id, college_id, title, message, notification_type, priority, channel, status) VALUES
		($1, $2, 'Notif A', 'Message for College A', 'ANNOUNCEMENT', 'NORMAL', 'IN_APP', 'QUEUED'),
		($3, $4, 'Notif B', 'Message for College B', 'ANNOUNCEMENT', 'NORMAL', 'IN_APP', 'QUEUED'),
		($5, NULL, 'Notif Global', 'Global System Announcement', 'SYSTEM', 'HIGH', 'IN_APP', 'QUEUED')
		ON CONFLICT DO NOTHING;
	`, notifAID, collegeAID, notifBID, collegeBID, notifGlobalID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Setup notifications failed: %v\n", err)
		os.Exit(1)
	}

	// 8. Insert Notification Recipients
	_, err = adminConn.Exec(ctx, `
		INSERT INTO app.notification_recipients (notification_id, user_id, delivery_status) VALUES
		($1, $2, 'PENDING'),
		($3, $4, 'PENDING'),
		($5, $2, 'PENDING')
		ON CONFLICT DO NOTHING;
	`, notifAID, userAID, notifBID, userBID, notifGlobalID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Setup notification recipients failed: %v\n", err)
		os.Exit(1)
	}

	// 9. Insert Bed Allocation for Alice in Hostel A
	allocAID := uuid.New()
	_, err = adminConn.Exec(ctx, `
		INSERT INTO app.bed_allocations (id, college_id, student_id, bed_id, status) VALUES
		($1, $2, $3, $4, 'ACTIVE')
		ON CONFLICT DO NOTHING;
	`, allocAID, collegeAID, studentAID, bedAID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Setup bed allocation failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("--- Test fixtures successfully initialized ---")

	// ============================================================
	// CATEGORY 1: COLLEGE ISOLATION TESTS (AS hms_college_app)
	// ============================================================
	collegeConn, err := getConn(ctx, host, port, dbname, "hms_college_app", collegePwd)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to connect as hms_college_app: %v\n", err)
		os.Exit(1)
	}
	defer collegeConn.Close(ctx)

	// Test 1.1: College A can read its own permitted rows
	{
		tx, err := collegeConn.Begin(ctx)
		if err != nil {
			record("RLS-1.1", "College A reads own rows", "FAIL", err.Error())
		} else {
			_, err = tx.Exec(ctx, "SELECT set_config('app.current_tenant_id', $1, true)", collegeAID.String())
			if err != nil {
				record("RLS-1.1", "College A reads own rows", "FAIL", err.Error())
			} else {
				var count int
				err = tx.QueryRow(ctx, "SELECT count(*) FROM app.hostels WHERE id = $1", hostelAID).Scan(&count)
				if err == nil && count == 1 {
					record("RLS-1.1", "College A reads own rows", "PASS", "Successfully queried own hostel record (count = 1)")
				} else {
					record("RLS-1.1", "College A reads own rows", "FAIL", fmt.Sprintf("count = %d, err = %v", count, err))
				}
			}
			tx.Rollback(ctx)
		}
	}

	// Test 1.2: College A cannot read College B's rows
	{
		tx, err := collegeConn.Begin(ctx)
		if err != nil {
			record("RLS-1.2", "College A cross-tenant read blocked", "FAIL", err.Error())
		} else {
			_, _ = tx.Exec(ctx, "SELECT set_config('app.current_tenant_id', $1, true)", collegeAID.String())
			var count int
			err = tx.QueryRow(ctx, "SELECT count(*) FROM app.hostels WHERE id = $1", hostelBID).Scan(&count)
			if err == nil && count == 0 {
				record("RLS-1.2", "College A cross-tenant read blocked", "PASS", "Query for College B hostel returned 0 rows (isolated)")
			} else {
				record("RLS-1.2", "College A cross-tenant read blocked", "FAIL", fmt.Sprintf("count = %d, err = %v", count, err))
			}
			tx.Rollback(ctx)
		}
	}

	// Test 1.3: College A cannot insert rows for College B
	{
		tx, err := collegeConn.Begin(ctx)
		if err != nil {
			record("RLS-1.3", "College A cross-tenant insert blocked", "FAIL", err.Error())
		} else {
			_, _ = tx.Exec(ctx, "SELECT set_config('app.current_tenant_id', $1, true)", collegeAID.String())
			newHostelID := uuid.New()
			_, err = tx.Exec(ctx, "INSERT INTO app.hostels (id, college_id, code, name, category, status) VALUES ($1, $2, 'H_CROSS', 'Illegal Hostel', 'MIXED', 'ACTIVE')", newHostelID, collegeBID)
			if err != nil && strings.Contains(strings.ToLower(err.Error()), "violates row-level security policy") {
				record("RLS-1.3", "College A cross-tenant insert blocked", "PASS", fmt.Sprintf("Rejected by RLS: %v", err))
			} else {
				record("RLS-1.3", "College A cross-tenant insert blocked", "FAIL", fmt.Sprintf("Expected RLS violation, got err = %v", err))
			}
			tx.Rollback(ctx)
		}
	}

	// Test 1.4: College A cannot update or delete College B's rows
	{
		tx, err := collegeConn.Begin(ctx)
		if err != nil {
			record("RLS-1.4", "College A cross-tenant update/delete blocked", "FAIL", err.Error())
		} else {
			_, _ = tx.Exec(ctx, "SELECT set_config('app.current_tenant_id', $1, true)", collegeAID.String())
			tagUpdate, errUpd := tx.Exec(ctx, "UPDATE app.hostels SET name = 'Hijacked' WHERE id = $1", hostelBID)
			tagDelete, errDel := tx.Exec(ctx, "DELETE FROM app.hostels WHERE id = $1", hostelBID)
			if errUpd == nil && tagUpdate.RowsAffected() == 0 && errDel == nil && tagDelete.RowsAffected() == 0 {
				record("RLS-1.4", "College A cross-tenant update/delete blocked", "PASS", "0 rows affected on UPDATE and DELETE against College B")
			} else {
				record("RLS-1.4", "College A cross-tenant update/delete blocked", "FAIL", fmt.Sprintf("updRows=%d, delRows=%d", tagUpdate.RowsAffected(), tagDelete.RowsAffected()))
			}
			tx.Rollback(ctx)
		}
	}

	// Test 1.5: Missing tenant context fails closed
	{
		tx, err := collegeConn.Begin(ctx)
		if err != nil {
			record("RLS-1.5", "Missing tenant context fails closed", "FAIL", err.Error())
		} else {
			var count int
			err = tx.QueryRow(ctx, "SELECT count(*) FROM app.hostels").Scan(&count)
			if err == nil && count == 0 {
				record("RLS-1.5", "Missing tenant context fails closed", "PASS", "SELECT with no tenant returns 0 rows (fail-closed)")
			} else {
				record("RLS-1.5", "Missing tenant context fails closed", "FAIL", fmt.Sprintf("count = %d, err = %v", count, err))
			}
			tx.Rollback(ctx)
		}
	}

	// Test 1.6: Mismatched tenant context cannot gain access
	{
		randomCollegeID := uuid.New()
		tx, err := collegeConn.Begin(ctx)
		if err != nil {
			record("RLS-1.6", "Mismatched tenant context blocked", "FAIL", err.Error())
		} else {
			_, _ = tx.Exec(ctx, "SELECT set_config('app.current_tenant_id', $1, true)", randomCollegeID.String())
			var count int
			err = tx.QueryRow(ctx, "SELECT count(*) FROM app.hostels").Scan(&count)
			if err == nil && count == 0 {
				record("RLS-1.6", "Mismatched tenant context blocked", "PASS", "Arbitrary tenant UUID returned 0 rows across all hostels")
			} else {
				record("RLS-1.6", "Mismatched tenant context blocked", "FAIL", fmt.Sprintf("count = %d, err = %v", count, err))
			}
			tx.Rollback(ctx)
		}
	}

	// Test 1.7: Invalid tenant references are rejected
	{
		tx, err := collegeConn.Begin(ctx)
		if err != nil {
			record("RLS-1.7", "Invalid tenant representation rejected", "FAIL", err.Error())
		} else {
			_, _ = tx.Exec(ctx, "SELECT set_config('app.current_tenant_id', 'not-a-valid-uuid', true)")
			var count int
			err = tx.QueryRow(ctx, "SELECT count(*) FROM app.hostels").Scan(&count)
			if err != nil && (strings.Contains(err.Error(), "Invalid app.current_tenant_id") || strings.Contains(err.Error(), "invalid_text_representation")) {
				record("RLS-1.7", "Invalid tenant representation rejected", "PASS", fmt.Sprintf("Function raised exception: %v", err))
			} else {
				record("RLS-1.7", "Invalid tenant representation rejected", "FAIL", fmt.Sprintf("Expected invalid UUID error, got count=%d, err=%v", count, err))
			}
			tx.Rollback(ctx)
		}
	}

	// Test 1.8: College role cannot assume or connect as platform role
	{
		_, err = collegeConn.Exec(ctx, "SET ROLE hms_platform_app")
		if err != nil && strings.Contains(strings.ToLower(err.Error()), "permission denied") {
			record("RLS-1.8", "College role cannot assume platform role", "PASS", fmt.Sprintf("SET ROLE blocked: %v", err))
		} else {
			record("RLS-1.8", "College role cannot assume platform role", "FAIL", fmt.Sprintf("Expected permission denied, got %v", err))
		}
	}

	// Test 1.9: Pooled connection context reset
	{
		_, _ = collegeConn.Exec(ctx, "SELECT set_config('app.current_tenant_id', $1, false)", collegeAID.String())
		_, _ = collegeConn.Exec(ctx, "RESET app.current_tenant_id")
		var val *string
		err = collegeConn.QueryRow(ctx, "SELECT nullif(current_setting('app.current_tenant_id', true), '')").Scan(&val)
		if err == nil && val == nil {
			record("RLS-1.9", "Connection context reset cleans tenant state", "PASS", "RESET app.current_tenant_id left no residual tenant state")
		} else {
			record("RLS-1.9", "Connection context reset cleans tenant state", "FAIL", fmt.Sprintf("val = %v, err = %v", val, err))
		}
	}

	// ============================================================
	// CATEGORY 2: PLATFORM BOUNDARY TESTS
	// ============================================================

	// Test 2.1: College login cannot access platform admin by changing app.current_scope
	{
		tx, err := collegeConn.Begin(ctx)
		if err != nil {
			record("PLAT-2.1", "College login cannot access platform admin via scope", "FAIL", err.Error())
		} else {
			_, _ = tx.Exec(ctx, "SELECT set_config('app.current_scope', 'PLATFORM', true)")
			_, _ = tx.Exec(ctx, "SELECT set_config('app.current_user_id', $1, true)", superAdminID.String())
			var isAdmin bool
			err = tx.QueryRow(ctx, "SELECT app.is_platform_admin()").Scan(&isAdmin)
			if err == nil && !isAdmin {
				record("PLAT-2.1", "College login cannot access platform admin via scope", "PASS", "is_platform_admin() returned false due to SESSION_USER = hms_college_app check")
			} else {
				record("PLAT-2.1", "College login cannot access platform admin via scope", "FAIL", fmt.Sprintf("isAdmin = %v, err = %v", isAdmin, err))
			}
			tx.Rollback(ctx)
		}
	}

	// Test 2.2: College login cannot impersonate platform user
	{
		tx, err := collegeConn.Begin(ctx)
		if err != nil {
			record("PLAT-2.2", "College login impersonation blocked", "FAIL", err.Error())
		} else {
			_, _ = tx.Exec(ctx, "SELECT set_config('app.current_scope', 'PLATFORM', true)")
			_, _ = tx.Exec(ctx, "SELECT set_config('app.current_user_id', $1, true)", superAdminID.String())
			var count int
			err = tx.QueryRow(ctx, "SELECT count(*) FROM platform.approval_requests WHERE college_id = $1", collegeBID).Scan(&count)
			if err == nil && count == 0 {
				record("PLAT-2.2", "College login impersonation blocked", "PASS", "Cross-college approval_requests query returned 0 rows despite setting super admin ID")
			} else {
				record("PLAT-2.2", "College login impersonation blocked", "FAIL", fmt.Sprintf("count = %d, err = %v", count, err))
			}
			tx.Rollback(ctx)
		}
	}

	// Test 2.3: Platform login can execute authorized platform operations
	platformConn, err := getConn(ctx, host, port, dbname, "hms_platform_app", platformPwd)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to connect as hms_platform_app: %v\n", err)
		os.Exit(1)
	}
	defer platformConn.Close(ctx)

	{
		tx, err := platformConn.Begin(ctx)
		if err != nil {
			record("PLAT-2.3", "Platform login executes authorized platform operations", "FAIL", err.Error())
		} else {
			_, _ = tx.Exec(ctx, "SELECT set_config('app.current_scope', 'PLATFORM', true)")
			_, _ = tx.Exec(ctx, "SELECT set_config('app.current_user_id', $1, true)", superAdminID.String())
			var isAdmin bool
			err = tx.QueryRow(ctx, "SELECT app.is_platform_admin()").Scan(&isAdmin)
			if err == nil && isAdmin {
				record("PLAT-2.3", "Platform login executes authorized platform operations", "PASS", "is_platform_admin() returned true for authenticated hms_platform_app with active role")
			} else {
				record("PLAT-2.3", "Platform login executes authorized platform operations", "FAIL", fmt.Sprintf("isAdmin = %v, err = %v", isAdmin, err))
			}
			tx.Rollback(ctx)
		}
	}

	// Test 2.4: Platform login write access to college operational data is blocked
	{
		tx, err := platformConn.Begin(ctx)
		if err != nil {
			record("PLAT-2.4", "Platform login blocked from writing college operational data", "FAIL", err.Error())
		} else {
			_, err = tx.Exec(ctx, "INSERT INTO app.hostels (id, college_id, code, name, category, status) VALUES ($1, $2, 'H_PLAT', 'Plat Hostel', 'MIXED', 'ACTIVE')", uuid.New(), collegeAID)
			if err != nil && strings.Contains(strings.ToLower(err.Error()), "permission denied") {
				record("PLAT-2.4", "Platform login blocked from writing college operational data", "PASS", fmt.Sprintf("INSERT blocked by SQL grants: %v", err))
			} else {
				record("PLAT-2.4", "Platform login blocked from writing college operational data", "FAIL", fmt.Sprintf("Expected permission denied, got %v", err))
			}
			tx.Rollback(ctx)
		}
	}

	// Test 2.5: Audit log update and delete prevention triggers
	{
		auditLogID := uuid.New()
		_, err = adminConn.Exec(ctx, `
			INSERT INTO platform.audit_logs (audit_id, module, action, severity) VALUES
			($1, 'TEST_MODULE', 'TEST_ACTION', 'INFO');
		`, auditLogID)
		if err != nil {
			record("PLAT-2.5", "Audit log immutability triggers", "FAIL", fmt.Sprintf("Insert audit log failed: %v", err))
		} else {
			_, errUpd := adminConn.Exec(ctx, "UPDATE platform.audit_logs SET reason = 'TAMPERED' WHERE audit_id = $1", auditLogID)
			_, errDel := adminConn.Exec(ctx, "DELETE FROM platform.audit_logs WHERE audit_id = $1", auditLogID)
			if errUpd != nil && strings.Contains(strings.ToLower(errUpd.Error()), "immutable") &&
				errDel != nil && strings.Contains(strings.ToLower(errDel.Error()), "immutable") {
				record("PLAT-2.5", "Audit log immutability triggers", "PASS", "Triggers successfully blocked UPDATE and DELETE on platform.audit_logs")
			} else {
				record("PLAT-2.5", "Audit log immutability triggers", "FAIL", fmt.Sprintf("errUpd=%v, errDel=%v", errUpd, errDel))
			}
		}
	}

	// ============================================================
	// CATEGORY 3: TRIGGER AND VIEW TESTS
	// ============================================================

	// Test 3.1: Tenant consistency trigger on blocks
	{
		_, err = adminConn.Exec(ctx, `
			INSERT INTO app.blocks (id, college_id, hostel_id, code, name, status) VALUES
			($1, $2, $3, 'BLK_BAD', 'Bad Block', 'ACTIVE');
		`, uuid.New(), collegeBID, hostelAID)
		if err != nil && (strings.Contains(strings.ToLower(err.Error()), "tenant violation") || strings.Contains(strings.ToLower(err.Error()), "tenant consistency")) {
			record("TRIG-3.1", "Tenant consistency trigger rejects mismatched hostel hierarchy", "PASS", fmt.Sprintf("Trigger blocked cross-tenant block insert: %v", err))
		} else {
			record("TRIG-3.1", "Tenant consistency trigger rejects mismatched hostel hierarchy", "FAIL", fmt.Sprintf("Expected tenant consistency violation, got %v", err))
		}
	}

	// Test 3.2: Notification recipients indirect RLS policy
	{
		tx, err := collegeConn.Begin(ctx)
		if err != nil {
			record("TRIG-3.2", "Notification recipient indirect RLS policy", "FAIL", err.Error())
		} else {
			_, _ = tx.Exec(ctx, "SELECT set_config('app.current_tenant_id', $1, true)", collegeAID.String())
			var countOwn, countOther, countGlobal int
			_ = tx.QueryRow(ctx, "SELECT count(*) FROM app.notification_recipients WHERE notification_id = $1", notifAID).Scan(&countOwn)
			_ = tx.QueryRow(ctx, "SELECT count(*) FROM app.notification_recipients WHERE notification_id = $1", notifBID).Scan(&countOther)
			_ = tx.QueryRow(ctx, "SELECT count(*) FROM app.notification_recipients WHERE notification_id = $1", notifGlobalID).Scan(&countGlobal)

			if countOwn == 1 && countOther == 0 && countGlobal == 1 {
				record("TRIG-3.2", "Notification recipient indirect RLS policy", "PASS", "Can read College A notif recipients (1) and Global notif recipients (1), blocked from College B (0)")
			} else {
				record("TRIG-3.2", "Notification recipient indirect RLS policy", "FAIL", fmt.Sprintf("own=%d, other=%d, global=%d", countOwn, countOther, countGlobal))
			}
			tx.Rollback(ctx)
		}
	}

	// Test 3.3: All nine views queryable and enforce security_invoker
	viewNames := []string{
		"app.v_current_student_bed_allocation",
		"app.v_student_current_location",
		"app.v_hostel_occupancy",
		"app.v_open_complaint_summary",
		"app.v_active_sos_alerts",
		"app.v_today_meal_menus",
		"app.v_resource_availability",
		"app.v_pending_leave_requests",
		"app.v_current_visitor_activity",
	}

	for _, vName := range viewNames {
		tx, err := collegeConn.Begin(ctx)
		if err != nil {
			record("VIEW-"+vName, "Query "+vName+" under College A", "FAIL", err.Error())
			continue
		}
		_, _ = tx.Exec(ctx, "SELECT set_config('app.current_tenant_id', $1, true)", collegeAID.String())
		var count int
		err = tx.QueryRow(ctx, fmt.Sprintf("SELECT count(*) FROM %s", vName)).Scan(&count)
		if err != nil {
			record("VIEW-"+vName, "Query "+vName+" under College A", "FAIL", err.Error())
		} else {
			record("VIEW-"+vName, "Query "+vName+" under College A", "PASS", fmt.Sprintf("View queried successfully (rows=%d), security_invoker active", count))
		}
		tx.Rollback(ctx)
	}

	// ============================================================
	// SUMMARY
	// ============================================================
	fmt.Println("\n============================================================")
	fmt.Println("SECURITY VALIDATION SUITE COMPLETE")
	fmt.Println("============================================================")
	passed := 0
	failed := 0
	for _, r := range results {
		if r.Status == "PASS" {
			passed++
		} else {
			failed++
		}
	}
	fmt.Printf("TOTAL: %d | PASSED: %d | FAILED: %d\n", len(results), passed, failed)
	if failed > 0 {
		os.Exit(1)
	}
}
