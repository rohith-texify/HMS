package service_test

import (
	"context"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yourusername/hostel-management-system/API/database"
	apirepo "github.com/yourusername/hostel-management-system/API/internal/repository"
	apisvc "github.com/yourusername/hostel-management-system/API/internal/service"
	parentmodels "github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/models"
	parentrepo "github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/repository"
	parentsvc "github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/services"
	samodels "github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	sarepo "github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
	sasvc "github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
)

func strPtr(s string) *string {
	return &s
}

func getLiveOrTestDB(t *testing.T) (*database.Database, *pgxpool.Pool, func()) {
	t.Helper()

	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		dbURL = os.Getenv("DATABASE_URL")
	}
	if dbURL == "" {
		// Standard local development PostgreSQL
		dbURL = "postgresql://postgres:Rohith%40acet@localhost:5432/HMS?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		t.Skipf("Skipping integration test: invalid DB URL: %v", err)
	}
	config.MaxConns = 30

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		t.Skipf("Skipping integration test: failed to connect to DB: %v", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		t.Skipf("Skipping integration test: local Postgres not reachable: %v", err)
	}

	db := &database.Database{Pool: pool, PlatformPool: pool}

	cleanup := func() {
		pool.Close()
	}

	return db, pool, cleanup
}

func createIsolatedTestCollege(ctx context.Context, t *testing.T, pool *pgxpool.Pool, limits map[string]int) (uuid.UUID, string, func()) {
	t.Helper()

	collegeID := uuid.New()
	code := fmt.Sprintf("QTC_%s", collegeID.String()[:6])
	name := fmt.Sprintf("Quota Verification College %s", code)

	maxStudents := 500
	maxParents := 500
	maxIncharges := 5
	maxSecurity := 10
	maxBlocks := 5

	if val, ok := limits["students"]; ok {
		maxStudents = val
	}
	if val, ok := limits["parents"]; ok {
		maxParents = val
	}
	if val, ok := limits["incharges"]; ok {
		maxIncharges = val
	}
	if val, ok := limits["security"]; ok {
		maxSecurity = val
	}
	if val, ok := limits["blocks"]; ok {
		maxBlocks = val
	}

	_, err := pool.Exec(ctx, `
		INSERT INTO platform.colleges (
			college_id, college_code, name, status,
			max_students, max_parents, max_incharges, max_security, max_blocks,
			contact_email, created_at, updated_at
		) VALUES (
			$1, $2, $3, 'ACTIVE',
			$4, $5, $6, $7, $8,
			$9, NOW(), NOW()
		)
	`, collegeID, code, name, maxStudents, maxParents, maxIncharges, maxSecurity, maxBlocks, fmt.Sprintf("%s@test.local", code))

	if err != nil {
		t.Fatalf("Failed to create isolated test college: %v", err)
	}

	cleanup := func() {
		cleanCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		_, _ = pool.Exec(cleanCtx, `DELETE FROM app.students WHERE college_id = $1`, collegeID)
		_, _ = pool.Exec(cleanCtx, `DELETE FROM app.parents WHERE college_id = $1`, collegeID)
		_, _ = pool.Exec(cleanCtx, `DELETE FROM app.security_assignments WHERE college_id = $1`, collegeID)
		_, _ = pool.Exec(cleanCtx, `DELETE FROM app.gates WHERE college_id = $1`, collegeID)
		_, _ = pool.Exec(cleanCtx, `DELETE FROM app.staff_profiles WHERE college_id = $1`, collegeID)
		_, _ = pool.Exec(cleanCtx, `DELETE FROM app.incharge_hostels WHERE college_id = $1`, collegeID)
		_, _ = pool.Exec(cleanCtx, `DELETE FROM app.blocks WHERE college_id = $1`, collegeID)
		_, _ = pool.Exec(cleanCtx, `DELETE FROM app.hostels WHERE college_id = $1`, collegeID)
		_, _ = pool.Exec(cleanCtx, `DELETE FROM platform.user_roles WHERE college_id = $1`, collegeID)
		_, _ = pool.Exec(cleanCtx, `DELETE FROM app.users WHERE email LIKE $1`, fmt.Sprintf("%s%%", code))
		_, _ = pool.Exec(cleanCtx, `DELETE FROM platform.colleges WHERE college_id = $1`, collegeID)
	}

	return collegeID, code, cleanup
}

// ----------------------------------------------------------------------------
// 1. QUOTA ENFORCEMENT TESTS FOR ALL 5 CATEGORIES
// ----------------------------------------------------------------------------

func TestQuotaEnforcement_AllCategories(t *testing.T) {
	db, pool, cleanupDB := getLiveOrTestDB(t)
	defer cleanupDB()

	t.Run("Students_QuotaEnforcement", func(t *testing.T) {
		collegeID, code, cleanupCollege := createIsolatedTestCollege(context.Background(), t, pool, map[string]int{"students": 2})
		defer cleanupCollege()

		ctx := database.WithTenantID(context.Background(), collegeID)

		repo := apirepo.New(db)
		svc := apisvc.NewStudentService(db, repo)

		// 1. Create 1st Student (Below Limit: 1 of 2) -> MUST SUCCEED
		req1 := apirepo.CreateStudentParams{
			CollegeID:       collegeID,
			AdmissionNumber: fmt.Sprintf("%s_ADM1", code),
			FirstName:       "StudentOne",
			Email:           strPtr(fmt.Sprintf("%s_s1@test.local", code)),
			Password:        strPtr("SecurePass123!"),
			ConfirmPassword: strPtr("SecurePass123!"),
		}
		res1, err := svc.CreateStudent(ctx, req1)
		if err != nil {
			t.Fatalf("Creation below limit (1 of 2) failed: %v", err)
		}
		if res1.ID == uuid.Nil {
			t.Fatalf("Expected valid student ID, got nil")
		}

		// 2. Create 2nd Student (At Limit: 2 of 2) -> MUST SUCCEED
		req2 := apirepo.CreateStudentParams{
			CollegeID:       collegeID,
			AdmissionNumber: fmt.Sprintf("%s_ADM2", code),
			FirstName:       "StudentTwo",
			Email:           strPtr(fmt.Sprintf("%s_s2@test.local", code)),
			Password:        strPtr("SecurePass123!"),
			ConfirmPassword: strPtr("SecurePass123!"),
		}
		res2, err := svc.CreateStudent(ctx, req2)
		if err != nil {
			t.Fatalf("Creation at limit (2 of 2) failed: %v", err)
		}
		if res2.ID == uuid.Nil {
			t.Fatalf("Expected valid student ID, got nil")
		}

		// 3. Create 3rd Student (Exceeds Limit: 3 of 2) -> MUST BE REJECTED
		req3 := apirepo.CreateStudentParams{
			CollegeID:       collegeID,
			AdmissionNumber: fmt.Sprintf("%s_ADM3", code),
			FirstName:       "StudentThree",
			Email:           strPtr(fmt.Sprintf("%s_s3@test.local", code)),
			Password:        strPtr("SecurePass123!"),
			ConfirmPassword: strPtr("SecurePass123!"),
		}
		_, err = svc.CreateStudent(ctx, req3)
		if err == nil {
			t.Fatalf("Expected quota rejection for 3rd student, but creation SUCCEEDED")
		}

		// 4. Deactivate Student 1 -> Deactivated accounts DO NOT count toward quota
		_, err = pool.Exec(ctx, `UPDATE app.students SET student_status = 'INACTIVE' WHERE id = $1`, res1.ID)
		if err != nil {
			t.Fatalf("Failed to deactivate student 1: %v", err)
		}

		// 5. Create 3rd Student again -> Now active count is 1 of 2 -> MUST SUCCEED
		res3, err := svc.CreateStudent(ctx, req3)
		if err != nil {
			t.Fatalf("Creation after deactivation failed: %v", err)
		}
		if res3.ID == uuid.Nil {
			t.Fatalf("Expected student created after deactivation")
		}

		// 6. Verify existing active accounts were never automatically deactivated
		var activeCount int
		err = pool.QueryRow(ctx, `SELECT COUNT(*) FROM app.students WHERE college_id = $1 AND student_status = 'ACTIVE'`, collegeID).Scan(&activeCount)
		if err != nil {
			t.Fatalf("Failed to query active students: %v", err)
		}
		if activeCount != 2 {
			t.Fatalf("Expected exactly 2 active students, found %d", activeCount)
		}
	})

	t.Run("Parents_QuotaEnforcement", func(t *testing.T) {
		collegeID, code, cleanupCollege := createIsolatedTestCollege(context.Background(), t, pool, map[string]int{"parents": 1})
		defer cleanupCollege()

		ctx := database.WithTenantID(context.Background(), collegeID)

		repo := parentrepo.New(db)
		svc := parentsvc.NewParentService(db, repo)

		// 1. Create Parent 1 (Below Limit: 1 of 1) -> MUST SUCCEED
		req1 := parentmodels.CreateParentParams{
			CollegeID:       collegeID,
			FirstName:       "ParentOne",
			Email:           strPtr(fmt.Sprintf("%s_p1@test.local", code)),
			Password:        strPtr("SecurePass123!"),
			ConfirmPassword: strPtr("SecurePass123!"),
		}
		res1, err := svc.CreateParent(ctx, req1)
		if err != nil {
			t.Fatalf("Parent creation 1 of 1 failed: %v", err)
		}

		// 2. Create Parent 2 (Exceeds Limit: 2 of 1) -> MUST BE REJECTED
		req2 := parentmodels.CreateParentParams{
			CollegeID:       collegeID,
			FirstName:       "ParentTwo",
			Email:           strPtr(fmt.Sprintf("%s_p2@test.local", code)),
			Password:        strPtr("SecurePass123!"),
			ConfirmPassword: strPtr("SecurePass123!"),
		}
		_, err = svc.CreateParent(ctx, req2)
		if err == nil {
			t.Fatalf("Expected quota rejection for 2nd parent, but creation SUCCEEDED")
		}

		// 3. Deactivate Parent 1 user -> account status = DEACTIVATED (per ck_users_status)
		if res1.UserID != nil {
			_, err = pool.Exec(ctx, `UPDATE app.users SET status = 'DEACTIVATED' WHERE user_id = $1`, *res1.UserID)
			if err != nil {
				t.Fatalf("Failed to deactivate parent 1: %v", err)
			}
		}

		// 4. Create Parent 2 again -> MUST SUCCEED
		_, err = svc.CreateParent(ctx, req2)
		if err != nil {
			t.Fatalf("Parent creation after deactivation failed: %v", err)
		}
	})

	t.Run("HostelIncharges_QuotaEnforcement", func(t *testing.T) {
		collegeID, code, cleanupCollege := createIsolatedTestCollege(context.Background(), t, pool, map[string]int{"incharges": 1})
		defer cleanupCollege()

		tenantCtx := database.WithTenantID(context.Background(), collegeID)

		var hostelID uuid.UUID
		err := pool.QueryRow(tenantCtx, `
			INSERT INTO app.hostels (college_id, name, code, category, status)
			VALUES ($1, $2, $3, 'BOYS', 'ACTIVE') RETURNING id
		`, collegeID, fmt.Sprintf("Hostel %s", code), fmt.Sprintf("H_%s", code[:6])).Scan(&hostelID)
		if err != nil {
			t.Fatalf("Failed to insert prerequisite hostel: %v", err)
		}

		repo := apirepo.New(db)
		svc := apisvc.NewInchargeHostelService(db, repo)

		// 1. Assign Incharge 1 (Below limit: 1 of 1) within transaction -> MUST SUCCEED
		req1 := apisvc.CreateInchargeAccountInput{
			Name:            "Incharge One",
			HostelID:        hostelID,
			Email:           fmt.Sprintf("%s_inc1@test.local", code),
			Password:        "SecurePass123!",
			ConfirmPassword: "SecurePass123!",
			Phone:           "9876543210",
		}

		var res1 apisvc.CreateInchargeAccountResult
		err = db.WithTransaction(tenantCtx, func(txCtx context.Context, tx pgx.Tx) error {
			var createErr error
			res1, createErr = svc.CreateInchargeAccount(txCtx, collegeID, req1)
			return createErr
		})
		if err != nil {
			t.Fatalf("Incharge assignment 1 of 1 failed: %v", err)
		}

		// 2. Assign Incharge 2 (Exceeds limit: 2 of 1) -> MUST BE REJECTED
		req2 := apisvc.CreateInchargeAccountInput{
			Name:            "Incharge Two",
			HostelID:        hostelID,
			Email:           fmt.Sprintf("%s_inc2@test.local", code),
			Password:        "SecurePass123!",
			ConfirmPassword: "SecurePass123!",
			Phone:           "9876543211",
		}
		err = db.WithTransaction(tenantCtx, func(txCtx context.Context, tx pgx.Tx) error {
			_, createErr := svc.CreateInchargeAccount(txCtx, collegeID, req2)
			return createErr
		})
		if err == nil {
			t.Fatalf("Expected quota rejection for 2nd incharge, but assignment SUCCEEDED")
		}

		// 3. Deactivate User 1
		_, err = pool.Exec(context.Background(), `UPDATE app.users SET status = 'DEACTIVATED' WHERE user_id = $1`, res1.UserID)
		if err != nil {
			t.Fatalf("Failed to deactivate incharge 1: %v", err)
		}

		// 4. Assign Incharge 2 again -> MUST SUCCEED
		err = db.WithTransaction(tenantCtx, func(txCtx context.Context, tx pgx.Tx) error {
			_, createErr := svc.CreateInchargeAccount(txCtx, collegeID, req2)
			return createErr
		})
		if err != nil {
			t.Fatalf("Incharge assignment after deactivation failed: %v", err)
		}
	})

	t.Run("Security_QuotaEnforcement", func(t *testing.T) {
		collegeID, code, cleanupCollege := createIsolatedTestCollege(context.Background(), t, pool, map[string]int{"security": 1})
		defer cleanupCollege()

		tenantCtx := database.WithTenantID(context.Background(), collegeID)

		repo := apirepo.New(db)

		// Create gate
		var gateID uuid.UUID
		err := pool.QueryRow(context.Background(), `
			INSERT INTO app.gates (college_id, code, name)
			VALUES ($1, $2, 'Main Gate') RETURNING id
		`, collegeID, fmt.Sprintf("G_%s", code[:6])).Scan(&gateID)
		if err != nil {
			t.Fatalf("Failed to insert gate: %v", err)
		}

		// Create staff 1
		userID1 := uuid.New()
		_, err = pool.Exec(context.Background(), `
			INSERT INTO app.users (user_id, email, password_hash, status, created_at, updated_at)
			VALUES ($1, $2, 'hash', 'ACTIVE', NOW(), NOW())
		`, userID1, fmt.Sprintf("%s_sec1@test.local", code))
		if err != nil {
			t.Fatalf("Failed to create security user 1: %v", err)
		}

		var staffID1 uuid.UUID
		err = pool.QueryRow(context.Background(), `
			INSERT INTO app.staff_profiles (college_id, user_id, first_name)
			VALUES ($1, $2, 'SecurityStaff1') RETURNING id
		`, collegeID, userID1).Scan(&staffID1)
		if err != nil {
			t.Fatalf("Failed to create staff profile 1: %v", err)
		}

		// Create staff 2
		userID2 := uuid.New()
		_, err = pool.Exec(context.Background(), `
			INSERT INTO app.users (user_id, email, password_hash, status, created_at, updated_at)
			VALUES ($1, $2, 'hash', 'ACTIVE', NOW(), NOW())
		`, userID2, fmt.Sprintf("%s_sec2@test.local", code))
		if err != nil {
			t.Fatalf("Failed to create security user 2: %v", err)
		}

		var staffID2 uuid.UUID
		err = pool.QueryRow(context.Background(), `
			INSERT INTO app.staff_profiles (college_id, user_id, first_name)
			VALUES ($1, $2, 'SecurityStaff2') RETURNING id
		`, collegeID, userID2).Scan(&staffID2)
		if err != nil {
			t.Fatalf("Failed to create staff profile 2: %v", err)
		}

		// 1. Assign Security 1 within transaction (Below limit: 1 of 1) -> MUST SUCCEED
		now := time.Now()
		var asgn1 apirepo.SecurityAssignment
		err = db.WithTransaction(tenantCtx, func(txCtx context.Context, tx pgx.Tx) error {
			var createErr error
			asgn1, createErr = repo.CreateSecurityAssignment(txCtx, collegeID, staffID1, gateID, nil, nil, nil, now, nil, true)
			return createErr
		})
		if err != nil {
			t.Fatalf("Security assignment 1 of 1 failed: %v", err)
		}
		if asgn1.ID == uuid.Nil {
			t.Fatalf("Expected valid assignment ID")
		}

		// 2. Assign Security 2 (Exceeds limit: 2 of 1) -> MUST BE REJECTED
		err = db.WithTransaction(tenantCtx, func(txCtx context.Context, tx pgx.Tx) error {
			_, createErr := repo.CreateSecurityAssignment(txCtx, collegeID, staffID2, gateID, nil, nil, nil, now, nil, true)
			return createErr
		})
		if err == nil {
			t.Fatalf("Expected quota rejection for 2nd security assignment, but creation SUCCEEDED")
		}

		// 3. Deactivate Assignment 1
		_, err = pool.Exec(context.Background(), `UPDATE app.security_assignments SET is_active = false WHERE id = $1`, asgn1.ID)
		if err != nil {
			t.Fatalf("Failed to deactivate assignment 1: %v", err)
		}

		// 4. Create assignment 2 again -> MUST SUCCEED
		var asgn2 apirepo.SecurityAssignment
		err = db.WithTransaction(tenantCtx, func(txCtx context.Context, tx pgx.Tx) error {
			var createErr error
			asgn2, createErr = repo.CreateSecurityAssignment(txCtx, collegeID, staffID2, gateID, nil, nil, nil, now, nil, true)
			return createErr
		})
		if err != nil {
			t.Fatalf("Security assignment after deactivation failed: %v", err)
		}
		if asgn2.ID == uuid.Nil {
			t.Fatalf("Expected valid assignment 2 ID")
		}
	})

	t.Run("HostelBlocks_QuotaEnforcement", func(t *testing.T) {
		collegeID, code, cleanupCollege := createIsolatedTestCollege(context.Background(), t, pool, map[string]int{"blocks": 1})
		defer cleanupCollege()

		tenantCtx := database.WithTenantID(context.Background(), collegeID)

		var hostelID uuid.UUID
		err := pool.QueryRow(context.Background(), `
			INSERT INTO app.hostels (college_id, name, code, category, status)
			VALUES ($1, $2, $3, 'BOYS', 'ACTIVE') RETURNING id
		`, collegeID, fmt.Sprintf("Hostel %s", code), fmt.Sprintf("HB_%s", code[:6])).Scan(&hostelID)
		if err != nil {
			t.Fatalf("Failed to insert hostel: %v", err)
		}

		repo := apirepo.New(db)

		// 1. Create Block 1 within transaction (Below limit: 1 of 1) -> MUST SUCCEED
		var block1 apirepo.Block
		err = db.WithTransaction(tenantCtx, func(txCtx context.Context, tx pgx.Tx) error {
			var createErr error
			block1, createErr = repo.CreateBlock(txCtx, collegeID, hostelID, fmt.Sprintf("%s_B1", code[:6]), "Block 1", nil)
			return createErr
		})
		if err != nil {
			t.Fatalf("Block creation 1 of 1 failed: %v", err)
		}
		if block1.ID == uuid.Nil {
			t.Fatalf("Expected valid block ID")
		}

		// 2. Create Block 2 (Exceeds limit: 2 of 1) -> MUST BE REJECTED
		err = db.WithTransaction(tenantCtx, func(txCtx context.Context, tx pgx.Tx) error {
			_, createErr := repo.CreateBlock(txCtx, collegeID, hostelID, fmt.Sprintf("%s_B2", code[:6]), "Block 2", nil)
			return createErr
		})
		if err == nil {
			t.Fatalf("Expected quota rejection for 2nd block, but creation SUCCEEDED")
		}

		// 3. Deactivate Block 1
		_, err = pool.Exec(context.Background(), `UPDATE app.blocks SET status = 'INACTIVE' WHERE id = $1`, block1.ID)
		if err != nil {
			t.Fatalf("Failed to deactivate block 1: %v", err)
		}

		// 4. Create Block 2 again -> MUST SUCCEED
		var block2 apirepo.Block
		err = db.WithTransaction(tenantCtx, func(txCtx context.Context, tx pgx.Tx) error {
			var createErr error
			block2, createErr = repo.CreateBlock(txCtx, collegeID, hostelID, fmt.Sprintf("%s_B2", code[:6]), "Block 2", nil)
			return createErr
		})
		if err != nil {
			t.Fatalf("Block creation after deactivation failed: %v", err)
		}
		if block2.ID == uuid.Nil {
			t.Fatalf("Expected valid block 2 ID")
		}
	})
}

// ----------------------------------------------------------------------------
// 2. CONCURRENCY TESTS (20 SIMULTANEOUS REQUESTS AT QUOTA 10)
// ----------------------------------------------------------------------------

func TestConcurrency_StrictQuotaEnforcement(t *testing.T) {
	db, pool, cleanupDB := getLiveOrTestDB(t)
	defer cleanupDB()

	t.Run("Concurrent_Students_Quota10_20Requests", func(t *testing.T) {
		const quotaLimit = 10
		const totalRequests = 20

		collegeID, code, cleanupCollege := createIsolatedTestCollege(context.Background(), t, pool, map[string]int{"students": quotaLimit})
		defer cleanupCollege()

		repo := apirepo.New(db)
		svc := apisvc.NewStudentService(db, repo)

		var wg sync.WaitGroup
		var successCount int64
		var rejectedCount int64

		startBarrier := make(chan struct{})

		for i := 0; i < totalRequests; i++ {
			wg.Add(1)
			go func(idx int) {
				defer wg.Done()
				<-startBarrier

				reqCtx := database.WithTenantID(context.Background(), collegeID)
				req := apirepo.CreateStudentParams{
					CollegeID:       collegeID,
					AdmissionNumber: fmt.Sprintf("%s_CADM_%d", code, idx),
					FirstName:       fmt.Sprintf("ConcStudent%d", idx),
					Email:           strPtr(fmt.Sprintf("%s_conc_%d@test.local", code, idx)),
					Password:        strPtr("SecurePass123!"),
					ConfirmPassword: strPtr("SecurePass123!"),
				}

				_, err := svc.CreateStudent(reqCtx, req)
				if err == nil {
					atomic.AddInt64(&successCount, 1)
				} else {
					atomic.AddInt64(&rejectedCount, 1)
				}
			}(i)
		}

		// Release all 20 goroutines simultaneously
		close(startBarrier)
		wg.Wait()

		if successCount != int64(quotaLimit) {
			t.Errorf("CONCURRENCY FAILED: Expected exactly %d successes, got %d", quotaLimit, successCount)
		}
		if rejectedCount != int64(totalRequests-quotaLimit) {
			t.Errorf("CONCURRENCY FAILED: Expected exactly %d rejections, got %d", totalRequests-quotaLimit, rejectedCount)
		}

		// Confirm directly in database
		var activeCount int
		err := pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM app.students WHERE college_id = $1 AND student_status = 'ACTIVE'`, collegeID).Scan(&activeCount)
		if err != nil {
			t.Fatalf("Failed to verify active count: %v", err)
		}
		if activeCount != quotaLimit {
			t.Errorf("DB INCONSISTENCY: Expected exactly %d active students in DB, found %d", quotaLimit, activeCount)
		}
	})

	t.Run("Concurrent_Parents_Quota10_20Requests", func(t *testing.T) {
		const quotaLimit = 10
		const totalRequests = 20

		collegeID, code, cleanupCollege := createIsolatedTestCollege(context.Background(), t, pool, map[string]int{"parents": quotaLimit})
		defer cleanupCollege()

		repo := parentrepo.New(db)
		svc := parentsvc.NewParentService(db, repo)

		var wg sync.WaitGroup
		var successCount int64
		var rejectedCount int64

		startBarrier := make(chan struct{})

		for i := 0; i < totalRequests; i++ {
			wg.Add(1)
			go func(idx int) {
				defer wg.Done()
				<-startBarrier

				reqCtx := database.WithTenantID(context.Background(), collegeID)
				req := parentmodels.CreateParentParams{
					CollegeID:       collegeID,
					FirstName:       fmt.Sprintf("ConcParent%d", idx),
					Email:           strPtr(fmt.Sprintf("%s_pconc_%d@test.local", code, idx)),
					Password:        strPtr("SecurePass123!"),
					ConfirmPassword: strPtr("SecurePass123!"),
				}

				_, err := svc.CreateParent(reqCtx, req)
				if err == nil {
					atomic.AddInt64(&successCount, 1)
				} else {
					atomic.AddInt64(&rejectedCount, 1)
				}
			}(i)
		}

		close(startBarrier)
		wg.Wait()

		if successCount != int64(quotaLimit) {
			t.Errorf("CONCURRENCY FAILED: Expected exactly %d parent successes, got %d", quotaLimit, successCount)
		}
		if rejectedCount != int64(totalRequests-quotaLimit) {
			t.Errorf("CONCURRENCY FAILED: Expected exactly %d parent rejections, got %d", totalRequests-quotaLimit, rejectedCount)
		}

		var activeCount int
		err := pool.QueryRow(context.Background(), `
			SELECT COUNT(*) FROM app.parents p
			JOIN platform.user_roles ur ON ur.user_id = p.user_id AND ur.college_id = p.college_id
			JOIN platform.roles r ON r.role_id = ur.role_id AND r.role_code = 'PARENT'
			JOIN app.users u ON u.user_id = p.user_id
			WHERE p.college_id = $1 AND ur.status = 'ACTIVE' AND u.status = 'ACTIVE'
		`, collegeID).Scan(&activeCount)
		if err != nil {
			t.Fatalf("Failed to verify active parent count: %v", err)
		}
		if activeCount != quotaLimit {
			t.Errorf("DB INCONSISTENCY: Expected exactly %d active parents in DB, found %d", quotaLimit, activeCount)
		}
	})

	t.Run("Concurrent_HostelIncharges_Quota10_20Requests", func(t *testing.T) {
		const quotaLimit = 10
		const totalRequests = 20

		collegeID, code, cleanupCollege := createIsolatedTestCollege(context.Background(), t, pool, map[string]int{"incharges": quotaLimit})
		defer cleanupCollege()

		tenantCtx := database.WithTenantID(context.Background(), collegeID)

		var hostelID uuid.UUID
		err := pool.QueryRow(tenantCtx, `
			INSERT INTO app.hostels (college_id, name, code, category, status)
			VALUES ($1, $2, $3, 'BOYS', 'ACTIVE') RETURNING id
		`, collegeID, fmt.Sprintf("Hostel %s", code), fmt.Sprintf("HI_%s", code[:6])).Scan(&hostelID)
		if err != nil {
			t.Fatalf("Failed to insert prerequisite hostel: %v", err)
		}

		repo := apirepo.New(db)
		svc := apisvc.NewInchargeHostelService(db, repo)

		var wg sync.WaitGroup
		var successCount int64
		var rejectedCount int64

		startBarrier := make(chan struct{})

		for i := 0; i < totalRequests; i++ {
			wg.Add(1)
			go func(idx int) {
				defer wg.Done()
				<-startBarrier

				req := apisvc.CreateInchargeAccountInput{
					Name:            fmt.Sprintf("ConcIncharge%d", idx),
					HostelID:        hostelID,
					Email:           fmt.Sprintf("%s_iconc_%d@test.local", code, idx),
					Password:        "SecurePass123!",
					ConfirmPassword: "SecurePass123!",
					Phone:           fmt.Sprintf("98765%05d", idx),
				}

				reqCtx := database.WithTenantID(context.Background(), collegeID)
				err := db.WithTransaction(reqCtx, func(txCtx context.Context, tx pgx.Tx) error {
					_, createErr := svc.CreateInchargeAccount(txCtx, collegeID, req)
					return createErr
				})
				if err == nil {
					atomic.AddInt64(&successCount, 1)
				} else {
					atomic.AddInt64(&rejectedCount, 1)
				}
			}(i)
		}

		close(startBarrier)
		wg.Wait()

		if successCount != int64(quotaLimit) {
			t.Errorf("CONCURRENCY FAILED: Expected exactly %d incharge successes, got %d", quotaLimit, successCount)
		}
		if rejectedCount != int64(totalRequests-quotaLimit) {
			t.Errorf("CONCURRENCY FAILED: Expected exactly %d incharge rejections, got %d", totalRequests-quotaLimit, rejectedCount)
		}

		var activeCount int
		err = pool.QueryRow(context.Background(), `
			SELECT COUNT(DISTINCT ur.user_id)
			FROM platform.user_roles ur
			JOIN platform.roles r ON r.role_id = ur.role_id AND r.role_code = 'HOSTEL_INCHARGE'
			JOIN app.users u ON u.user_id = ur.user_id
			WHERE ur.college_id = $1 AND ur.status = 'ACTIVE' AND u.status = 'ACTIVE'
		`, collegeID).Scan(&activeCount)
		if err != nil {
			t.Fatalf("Failed to verify active incharge count: %v", err)
		}
		if activeCount != quotaLimit {
			t.Errorf("DB INCONSISTENCY: Expected exactly %d active incharges in DB, found %d", quotaLimit, activeCount)
		}
	})

	t.Run("Concurrent_Security_Quota10_20Requests", func(t *testing.T) {
		const quotaLimit = 10
		const totalRequests = 20

		collegeID, code, cleanupCollege := createIsolatedTestCollege(context.Background(), t, pool, map[string]int{"security": quotaLimit})
		defer cleanupCollege()

		var gateID uuid.UUID
		err := pool.QueryRow(context.Background(), `
			INSERT INTO app.gates (college_id, code, name)
			VALUES ($1, $2, 'Main Gate') RETURNING id
		`, collegeID, fmt.Sprintf("G_%s", code[:6])).Scan(&gateID)
		if err != nil {
			t.Fatalf("Failed to insert gate: %v", err)
		}

		staffIDs := make([]uuid.UUID, totalRequests)
		for i := 0; i < totalRequests; i++ {
			userID := uuid.New()
			_, err = pool.Exec(context.Background(), `
				INSERT INTO app.users (user_id, email, password_hash, status, created_at, updated_at)
				VALUES ($1, $2, 'hash', 'ACTIVE', NOW(), NOW())
			`, userID, fmt.Sprintf("%s_sconc_%d@test.local", code, i))
			if err != nil {
				t.Fatalf("Failed to create user: %v", err)
			}

			err = pool.QueryRow(context.Background(), `
				INSERT INTO app.staff_profiles (college_id, user_id, first_name)
				VALUES ($1, $2, $3) RETURNING id
			`, collegeID, userID, fmt.Sprintf("Staff%d", i)).Scan(&staffIDs[i])
			if err != nil {
				t.Fatalf("Failed to create staff: %v", err)
			}
		}

		repo := apirepo.New(db)
		var wg sync.WaitGroup
		var successCount int64
		var rejectedCount int64
		now := time.Now()

		startBarrier := make(chan struct{})

		for i := 0; i < totalRequests; i++ {
			wg.Add(1)
			go func(idx int) {
				defer wg.Done()
				<-startBarrier

				reqCtx := database.WithTenantID(context.Background(), collegeID)
				err := db.WithTransaction(reqCtx, func(txCtx context.Context, tx pgx.Tx) error {
					_, createErr := repo.CreateSecurityAssignment(txCtx, collegeID, staffIDs[idx], gateID, nil, nil, nil, now, nil, true)
					return createErr
				})
				if err == nil {
					atomic.AddInt64(&successCount, 1)
				} else {
					atomic.AddInt64(&rejectedCount, 1)
				}
			}(i)
		}

		close(startBarrier)
		wg.Wait()

		if successCount != int64(quotaLimit) {
			t.Errorf("CONCURRENCY FAILED: Expected exactly %d security successes, got %d", quotaLimit, successCount)
		}
		if rejectedCount != int64(totalRequests-quotaLimit) {
			t.Errorf("CONCURRENCY FAILED: Expected exactly %d security rejections, got %d", totalRequests-quotaLimit, rejectedCount)
		}

		var activeCount int
		err = pool.QueryRow(context.Background(), `
			SELECT COUNT(*) FROM app.security_assignments
			WHERE college_id = $1 AND is_active = true
		`, collegeID).Scan(&activeCount)
		if err != nil {
			t.Fatalf("Failed to verify active security count: %v", err)
		}
		if activeCount != quotaLimit {
			t.Errorf("DB INCONSISTENCY: Expected exactly %d active security in DB, found %d", quotaLimit, activeCount)
		}
	})

	t.Run("Concurrent_HostelBlocks_Quota10_20Requests", func(t *testing.T) {
		const quotaLimit = 10
		const totalRequests = 20

		collegeID, code, cleanupCollege := createIsolatedTestCollege(context.Background(), t, pool, map[string]int{"blocks": quotaLimit})
		defer cleanupCollege()

		tenantCtx := database.WithTenantID(context.Background(), collegeID)

		var hostelID uuid.UUID
		err := pool.QueryRow(tenantCtx, `
			INSERT INTO app.hostels (college_id, name, code, category, status)
			VALUES ($1, $2, $3, 'BOYS', 'ACTIVE') RETURNING id
		`, collegeID, fmt.Sprintf("Hostel %s", code), fmt.Sprintf("HB_%s", code[:6])).Scan(&hostelID)
		if err != nil {
			t.Fatalf("Failed to insert hostel: %v", err)
		}

		repo := apirepo.New(db)
		var wg sync.WaitGroup
		var successCount int64
		var rejectedCount int64

		startBarrier := make(chan struct{})

		for i := 0; i < totalRequests; i++ {
			wg.Add(1)
			go func(idx int) {
				defer wg.Done()
				<-startBarrier

				reqCtx := database.WithTenantID(context.Background(), collegeID)
				err := db.WithTransaction(reqCtx, func(txCtx context.Context, tx pgx.Tx) error {
					_, createErr := repo.CreateBlock(txCtx, collegeID, hostelID, fmt.Sprintf("%s_B%d", code[:6], idx), fmt.Sprintf("Block %d", idx), nil)
					return createErr
				})
				if err == nil {
					atomic.AddInt64(&successCount, 1)
				} else {
					atomic.AddInt64(&rejectedCount, 1)
				}
			}(i)
		}

		close(startBarrier)
		wg.Wait()

		if successCount != int64(quotaLimit) {
			t.Errorf("CONCURRENCY FAILED: Expected exactly %d block successes, got %d", quotaLimit, successCount)
		}
		if rejectedCount != int64(totalRequests-quotaLimit) {
			t.Errorf("CONCURRENCY FAILED: Expected exactly %d block rejections, got %d", totalRequests-quotaLimit, rejectedCount)
		}

		var activeCount int
		err = pool.QueryRow(context.Background(), `
			SELECT COUNT(*) FROM app.blocks
			WHERE college_id = $1 AND status = 'ACTIVE'
		`, collegeID).Scan(&activeCount)
		if err != nil {
			t.Fatalf("Failed to verify active block count: %v", err)
		}
		if activeCount != quotaLimit {
			t.Errorf("DB INCONSISTENCY: Expected exactly %d active blocks in DB, found %d", quotaLimit, activeCount)
		}
	})
}

// ----------------------------------------------------------------------------
// 3. LIMIT REDUCTION TESTS (40 USAGE, LIMIT REDUCED TO 30)
// ----------------------------------------------------------------------------

func TestLimitReduction_Policy(t *testing.T) {
	db, pool, cleanupDB := getLiveOrTestDB(t)
	defer cleanupDB()

	ctx := context.Background()

	// Initial limit 50, create 40 active students
	collegeID, code, cleanupCollege := createIsolatedTestCollege(ctx, t, pool, map[string]int{"students": 50})
	defer cleanupCollege()

	tenantCtx := database.WithTenantID(ctx, collegeID)

	// Bulk insert 40 students directly to simulate active usage of 40
	for i := 1; i <= 40; i++ {
		userID := uuid.New()
		studentID := uuid.New()
		_, err := pool.Exec(ctx, `
			INSERT INTO app.users (user_id, email, password_hash, status, created_at, updated_at)
			VALUES ($1, $2, 'hash', 'ACTIVE', NOW(), NOW())
		`, userID, fmt.Sprintf("%s_red_%d@test.local", code, i))
		if err != nil {
			t.Fatalf("Failed to prep student user %d: %v", i, err)
		}

		_, err = pool.Exec(ctx, `
			INSERT INTO app.students (id, user_id, college_id, admission_number, first_name, student_status, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, 'ACTIVE', NOW(), NOW())
		`, studentID, userID, collegeID, fmt.Sprintf("%s_R%d", code, i), fmt.Sprintf("Student%d", i))
		if err != nil {
			t.Fatalf("Failed to prep student record %d: %v", i, err)
		}
	}

	// Verify active count is 40
	var initialCount int
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM app.students WHERE college_id = $1 AND student_status = 'ACTIVE'`, collegeID).Scan(&initialCount)
	if initialCount != 40 {
		t.Fatalf("Expected 40 active students, got %d", initialCount)
	}

	// 1. Super Admin updates quota: reduce max_students from 50 to 30
	collegeRepo := sarepo.NewWithPool(pool)
	superAdminSvc := sasvc.NewCollegeService(db, collegeRepo)

	newLimits := samodels.UpdateCollegeQuotasRequest{
		MaxStudents: 30, // Below current usage of 40!
	}
	err := superAdminSvc.UpdateCollegeQuotas(ctx, collegeID, newLimits)
	if err != nil {
		t.Fatalf("Limit reduction update failed: %v", err)
	}

	// 2. Verify all 40 existing accounts remain active (no auto-deactivation)
	var activeCountAfter int
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM app.students WHERE college_id = $1 AND student_status = 'ACTIVE'`, collegeID).Scan(&activeCountAfter)
	if activeCountAfter != 40 {
		t.Fatalf("VIOLATION: Existing active accounts were modified! Expected 40, found %d", activeCountAfter)
	}

	// 3. Attempt to create 41st student -> MUST BE BLOCKED (usage 40 >= limit 30)
	repo := apirepo.New(db)
	svc := apisvc.NewStudentService(db, repo)
	reqNew := apirepo.CreateStudentParams{
		CollegeID:       collegeID,
		AdmissionNumber: fmt.Sprintf("%s_R41", code),
		FirstName:       "Student41",
		Email:           strPtr(fmt.Sprintf("%s_r41@test.local", code)),
		Password:        strPtr("SecurePass123!"),
		ConfirmPassword: strPtr("SecurePass123!"),
	}
	_, err = svc.CreateStudent(tenantCtx, reqNew)
	if err == nil {
		t.Fatalf("Expected new creation to be blocked when usage 40 exceeds reduced limit 30, but it SUCCEEDED")
	}

	// 4. Deactivate 11 students so active usage drops to 29 (below limit of 30)
	_, err = pool.Exec(ctx, `
		UPDATE app.students
		SET student_status = 'INACTIVE'
		WHERE id IN (
			SELECT id FROM app.students WHERE college_id = $1 LIMIT 11
		)
	`, collegeID)
	if err != nil {
		t.Fatalf("Failed to deactivate 11 students: %v", err)
	}

	var reducedActiveCount int
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM app.students WHERE college_id = $1 AND student_status = 'ACTIVE'`, collegeID).Scan(&reducedActiveCount)
	if reducedActiveCount != 29 {
		t.Fatalf("Expected 29 active students, got %d", reducedActiveCount)
	}

	// 5. Attempt creation again -> now usage is 29 < 30 -> MUST SUCCEED
	resNew, err := svc.CreateStudent(tenantCtx, reqNew)
	if err != nil {
		t.Fatalf("Creation failed after usage dropped below limit: %v", err)
	}
	if resNew.ID == uuid.Nil {
		t.Fatalf("Expected valid student response")
	}
}

// ----------------------------------------------------------------------------
// 5. EXISTING REAL COLLEGES INTEGRITY VERIFICATION
// ----------------------------------------------------------------------------

func TestExistingCollegesIntegrity(t *testing.T) {
	_, pool, cleanupDB := getLiveOrTestDB(t)
	defer cleanupDB()

	ctx := context.Background()

	rows, err := pool.Query(ctx, `
		SELECT college_id, college_code, name, status, created_at
		FROM platform.colleges
		ORDER BY created_at ASC
	`)
	if err != nil {
		t.Fatalf("Failed to query platform.colleges: %v", err)
	}
	defer rows.Close()

	t.Logf("%-38s | %-12s | %-35s | %-12s", "COLLEGE ID", "CODE", "NAME", "STATUS")
	t.Logf("----------------------------------------------------------------------------------------------------")

	count := 0
	for rows.Next() {
		var id uuid.UUID
		var code, name, status string
		var createdAt time.Time
		if err := rows.Scan(&id, &code, &name, &status, &createdAt); err != nil {
			t.Fatalf("Failed to scan college: %v", err)
		}
		t.Logf("%-38s | %-12s | %-35s | %-12s", id.String(), code, name, status)
		count++
	}

	t.Logf("Total verified existing colleges: %d", count)

	// Explicitly verify critical real institutional colleges retain ONBOARDING status
	var akshayaStatus, rohithStatus string
	err = pool.QueryRow(ctx, `SELECT status FROM platform.colleges WHERE college_code = '7203'`).Scan(&akshayaStatus)
	if err != nil {
		t.Fatalf("Failed to query Akshaya College (7203): %v", err)
	}
	if akshayaStatus != "ONBOARDING" {
		t.Fatalf("REGRESSION: Akshaya College status altered to %s, expected ONBOARDING", akshayaStatus)
	}

	err = pool.QueryRow(ctx, `SELECT status FROM platform.colleges WHERE college_code = '7777'`).Scan(&rohithStatus)
	if err != nil {
		t.Fatalf("Failed to query rohith.texify (7777): %v", err)
	}
	if rohithStatus != "ONBOARDING" {
		t.Fatalf("REGRESSION: rohith.texify status altered to %s, expected ONBOARDING", rohithStatus)
	}

	// Clean up any lingering isolated test colleges
	_, _ = pool.Exec(ctx, `DELETE FROM platform.colleges WHERE college_code LIKE 'QTC_%' OR college_code LIKE 'ONB_%'`)
}

func TestCollegeLifecycle_OnboardingProtection(t *testing.T) {
	db, pool, cleanupDB := getLiveOrTestDB(t)
	defer cleanupDB()

	ctx := context.Background()

	// Find an existing system administrator or user to act as actorUserID
	var actorID uuid.UUID
	err := pool.QueryRow(ctx, `SELECT user_id FROM app.users WHERE status = 'ACTIVE' LIMIT 1`).Scan(&actorID)
	if err != nil {
		// Fallback: create an actor user
		actorID = uuid.New()
		_, _ = pool.Exec(ctx, `INSERT INTO app.users (user_id, email, password_hash, status) VALUES ($1, 'system.actor@test.local', 'hash', 'ACTIVE')`, actorID)
	}

	// 1. Verify existing ONBOARDING colleges in the database remain ONBOARDING
	rows, err := pool.Query(ctx, `SELECT college_id, college_code, status FROM platform.colleges WHERE status = 'ONBOARDING'`)
	if err != nil {
		t.Fatalf("Failed to query onboarding colleges: %v", err)
	}
	defer rows.Close()

	var onboardingCount int
	for rows.Next() {
		var id uuid.UUID
		var code, status string
		if err := rows.Scan(&id, &code, &status); err != nil {
			t.Fatalf("Failed to scan row: %v", err)
		}
		if status != "ONBOARDING" {
			t.Errorf("Unexpected status for onboarding college: %s", status)
		}
		onboardingCount++
	}

	// 2. Create a test college with ONBOARDING status
	testID := uuid.New()
	testCode := fmt.Sprintf("ONB_%s", testID.String()[:6])
	_, err = pool.Exec(ctx, `
		INSERT INTO platform.colleges (college_id, college_code, name, status, contact_email)
		VALUES ($1, $2, 'Onboarding Protection Test', 'ONBOARDING', 'onb@test.local')
	`, testID, testCode)
	if err != nil {
		t.Fatalf("Failed to insert test onboarding college: %v", err)
	}
	defer func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM platform.user_roles WHERE college_id = $1`, testID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM app.users WHERE email LIKE $1`, fmt.Sprintf("%s%%", testCode))
		_, _ = pool.Exec(context.Background(), `DELETE FROM platform.colleges WHERE college_id = $1`, testID)
	}()

	// 3. Confirm that querying college details or listing NEVER mutates ONBOARDING to ACTIVE
	collegeRepo := sarepo.NewWithPool(pool)
	superAdminSvc := sasvc.NewCollegeService(db, collegeRepo)

	fetched, err := superAdminSvc.GetCollege(ctx, testID)
	if err != nil {
		t.Fatalf("GetCollege failed: %v", err)
	}
	if fetched.Status != "ONBOARDING" {
		t.Errorf("GetCollege mutated status! Expected ONBOARDING, got %s", fetched.Status)
	}

	// 4. Confirm that direct activation WITHOUT first admin is properly rejected by readiness gate
	auditReason := "Super admin approval attempt"

	statusReq := samodels.UpdateCollegeStatusRequest{
		Status: "ACTIVE",
		Reason: &auditReason,
	}
	_, err = superAdminSvc.UpdateCollegeStatus(ctx, testID, statusReq, actorID, "SUPER_ADMIN")
	if err == nil {
		t.Errorf("Expected activation of unready onboarding college to be rejected, but it succeeded")
	}

	// 5. Provision the first admin account to satisfy the readiness gate (with actor ID in context)
	adminReq := samodels.ProvisionFirstCollegeAdminRequest{
		Email:    fmt.Sprintf("%s.admin@test.local", testCode),
		Password: "InitialSuperPassword123!",
	}
	adminCtx := database.WithPlatformUserID(ctx, actorID)
	_, err = superAdminSvc.ProvisionFirstCollegeAdmin(adminCtx, testID, adminReq)
	if err != nil {
		t.Fatalf("Failed to provision first admin: %v", err)
	}

	// 5b. Add prerequisite active hostel structure to satisfy HOSTEL_STRUCTURE readiness gate
	_, err = pool.Exec(ctx, `
		INSERT INTO app.hostels (college_id, name, code, category, status)
		VALUES ($1, 'Onboarding Prereq Hostel', $2, 'BOYS', 'ACTIVE')
	`, testID, fmt.Sprintf("H_%s", testCode[:6]))
	if err != nil {
		t.Fatalf("Failed to insert prerequisite hostel: %v", err)
	}

	// 5c. Complete checklist steps to satisfy activation readiness
	_, err = pool.Exec(ctx, `
		INSERT INTO platform.college_onboarding (college_id, step_code, status, updated_at)
		VALUES 
			($1, 'COLLEGE_PROFILE', 'COMPLETED', NOW()),
			($1, 'COLLEGE_ADMIN', 'COMPLETED', NOW()),
			($1, 'READINESS_REVIEW', 'COMPLETED', NOW()),
			($1, 'GO_LIVE', 'PENDING', NOW())
		ON CONFLICT (college_id, step_code) DO UPDATE SET status = EXCLUDED.status
	`, testID)
	if err != nil {
		t.Fatalf("Failed to initialize onboarding checklist: %v", err)
	}

	// 6. Now manual activation with actor and reason MUST SUCCEED
	updated, err := superAdminSvc.UpdateCollegeStatus(ctx, testID, statusReq, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("Manual activation after fulfilling readiness failed: %v", err)
	}
	if updated.Status != "ACTIVE" {
		t.Errorf("Expected status ACTIVE after manual activation, got %s", updated.Status)
	}
}
