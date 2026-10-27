package tests

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
)

func getSuperAdminTestDB(t *testing.T) (*repository.Repository, *services.CollegeService, func()) {
	t.Helper()

	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("Skipping PostgreSQL integration test: TEST_DATABASE_URL is not set.")
	}

	if err := ValidateTestDatabaseURL(dbURL); err != nil {
		t.Fatalf("%v", err)
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Skipf("skipping test: database connection error: %v", err)
	}

	if err := pool.Ping(ctx); err != nil {
		t.Skipf("skipping test: database ping failed: %v", err)
	}

	db := &database.Database{
		Pool:         pool,
		CollegePool:  pool,
		PlatformPool: pool,
	}

	repo := repository.New(db)
	svc := services.NewCollegeService(db, repo)

	return repo, svc, func() {
		pool.Close()
	}
}

func createActorContext(t *testing.T, repo *repository.Repository) context.Context {
	t.Helper()
	actorID := uuid.New()
	actorRole := "SUPER_ADMIN"
	ctx := database.WithPlatformUserID(context.Background(), actorID)
	ctx = context.WithValue(ctx, services.ActorRoleContextKey, actorRole)

	_, err := repo.Executor(ctx).Exec(ctx, `
		INSERT INTO app.users (user_id, email, status)
		VALUES ($1, $2, 'ACTIVE')
		ON CONFLICT DO NOTHING
	`, actorID, fmt.Sprintf("actor-%s@hms.platform", actorID.String()[:8]))
	if err != nil {
		t.Fatalf("Failed to seed test actor in app.users: %v", err)
	}
	return ctx
}

// 1. Test ValidateLocationCodes with valid and invalid Tamil Nadu codes
func TestValidateLocationCodes(t *testing.T) {
	repo, _, cleanup := getSuperAdminTestDB(t)
	defer cleanup()

	ctx := context.Background()

	stateCode := "33"
	stateTN := "Tamil Nadu"
	urbanType := "URBAN"
	ruralType := "RURAL"

	// Valid Urban: Chennai district 568, ULB 252294, Ward 1941
	chennaiDist := "568"
	chennaiULB := "252294"
	chennaiWard := "1941"

	err := repo.ValidateLocationCodes(ctx, &stateCode, &stateTN, &urbanType, &chennaiDist, nil, nil, &chennaiULB, &chennaiWard, nil)
	if err != nil {
		t.Fatalf("expected valid Chennai urban location codes to pass, got: %v", err)
	}

	// Valid Rural: Ariyalur district 610, Block 6255, Village 636338
	ariyalurDist := "610"
	andimadamBlock := "6255"
	alagapuramVillage := "636338"

	err = repo.ValidateLocationCodes(ctx, &stateCode, &stateTN, &ruralType, &ariyalurDist, nil, &andimadamBlock, nil, nil, &alagapuramVillage)
	if err != nil {
		t.Fatalf("expected valid Ariyalur rural location codes to pass, got: %v", err)
	}

	// Invalid District Code
	invalidDist := "999999"
	err = repo.ValidateLocationCodes(ctx, &stateCode, &stateTN, &urbanType, &invalidDist, nil, nil, nil, nil, nil)
	if err == nil {
		t.Fatalf("expected invalid district code to fail, got nil")
	}
	if !strings.Contains(err.Error(), "invalid district code") {
		t.Errorf("unexpected error message: %v", err)
	}

	// Invalid City / ULB Code
	invalidULB := "999999"
	err = repo.ValidateLocationCodes(ctx, &stateCode, &stateTN, &urbanType, &chennaiDist, nil, nil, &invalidULB, nil, nil)
	if err == nil {
		t.Fatalf("expected invalid city/ULB code to fail, got nil")
	}
	if !strings.Contains(err.Error(), "invalid city/local body code") {
		t.Errorf("unexpected error message: %v", err)
	}

	// Invalid Block Code
	invalidBlock := "999999"
	err = repo.ValidateLocationCodes(ctx, &stateCode, &stateTN, &ruralType, &ariyalurDist, nil, &invalidBlock, nil, nil, nil)
	if err == nil {
		t.Fatalf("expected invalid block code to fail, got nil")
	}
	if !strings.Contains(err.Error(), "invalid block code") {
		t.Errorf("unexpected error message: %v", err)
	}

	// Invalid Village Code
	invalidVillage := "9999999"
	err = repo.ValidateLocationCodes(ctx, &stateCode, &stateTN, &ruralType, &ariyalurDist, nil, &andimadamBlock, nil, nil, &invalidVillage)
	if err == nil {
		t.Fatalf("expected invalid village code to fail, got nil")
	}
	if !strings.Contains(err.Error(), "invalid village code") {
		t.Errorf("unexpected error message: %v", err)
	}

	// Non-TN state bypasses validation
	nonTNState := "Karnataka"
	nonTNCode := "29"
	err = repo.ValidateLocationCodes(ctx, &nonTNCode, &nonTNState, &urbanType, &invalidDist, nil, nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("expected non-TN state to bypass TN code validation, got: %v", err)
	}
}

// 2. Test CreateCollege with Tamil Nadu Urban Location Codes & Persistence
func TestCollegeService_CreateCollege_TamilNaduLocation(t *testing.T) {
	repo, svc, cleanup := getSuperAdminTestDB(t)
	defer cleanup()

	ctx := createActorContext(t, repo)

	testCode := "TEST-TN-" + strings.ToUpper(uuid.New().String()[:6])
	stateTN := "Tamil Nadu"
	stateCode := "33"
	urbanType := "URBAN"
	districtCode := "568"
	cityCode := "252294"
	wardCode := "1941"
	cityName := "Greater Chennai Corporation"
	campusLocality := "Anna University Main Campus, Sardar Patel Road"
	contactEmail := "test-" + strings.ToLower(testCode) + "@college.edu.in"
	adminEmail := "admin-" + strings.ToLower(testCode) + "@college.edu.in"
	pwd := "SuperSecret123!"

	req := models.CreateCollegeRequest{
		CollegeCode:    testCode,
		Name:           "Tamil Nadu Test Institute of Technology",
		City:           &cityName,
		State:          &stateTN,
		Timezone:       "Asia/Kolkata",
		ContactEmail:   &contactEmail,
		AdminEmail:     &adminEmail,
		Password:       &pwd,
		LocationType:   &urbanType,
		StateCode:      &stateCode,
		DistrictCode:   &districtCode,
		CityCode:       &cityCode,
		WardCode:       &wardCode,
		CampusLocality: &campusLocality,
	}

	college, err := svc.CreateCollege(ctx, req)
	if err != nil {
		t.Fatalf("failed to create college with TN location: %v", err)
	}

	if college == nil {
		t.Fatalf("expected created college, got nil")
	}

	// Verify location fields on returned college
	if college.LocationType == nil || *college.LocationType != "URBAN" {
		t.Errorf("expected location_type URBAN, got %v", college.LocationType)
	}
	if college.StateCode == nil || *college.StateCode != "33" {
		t.Errorf("expected state_code 33, got %v", college.StateCode)
	}
	if college.DistrictCode == nil || *college.DistrictCode != "568" {
		t.Errorf("expected district_code 568, got %v", college.DistrictCode)
	}
	if college.CityCode == nil || *college.CityCode != "252294" {
		t.Errorf("expected city_code 252294, got %v", college.CityCode)
	}
	if college.WardCode == nil || *college.WardCode != "1941" {
		t.Errorf("expected ward_code 1941, got %v", college.WardCode)
	}
	if college.CampusLocality == nil || *college.CampusLocality != campusLocality {
		t.Errorf("expected campus_locality '%s', got %v", campusLocality, college.CampusLocality)
	}

	// Fetch college by ID to verify database persistence
	fetched, err := svc.GetCollege(ctx, college.CollegeID)
	if err != nil {
		t.Fatalf("failed to fetch created college: %v", err)
	}
	if fetched.DistrictCode == nil || *fetched.DistrictCode != "568" {
		t.Errorf("persisted district_code mismatch: got %v", fetched.DistrictCode)
	}
	if fetched.WardCode == nil || *fetched.WardCode != "1941" {
		t.Errorf("persisted ward_code mismatch: got %v", fetched.WardCode)
	}

	// Clean up created test college
	_, _ = repo.Executor(ctx).Exec(ctx, "DELETE FROM platform.college_onboarding_checklists WHERE college_id = $1", college.CollegeID)
	_, _ = repo.Executor(ctx).Exec(ctx, "DELETE FROM platform.users WHERE college_id = $1", college.CollegeID)
	_, _ = repo.Executor(ctx).Exec(ctx, "DELETE FROM platform.colleges WHERE college_id = $1", college.CollegeID)
}

// 3. Test CreateCollege with Tamil Nadu Rural Location Codes & Persistence
func TestCollegeService_CreateCollege_TamilNaduRuralLocation(t *testing.T) {
	repo, svc, cleanup := getSuperAdminTestDB(t)
	defer cleanup()

	ctx := createActorContext(t, repo)

	testCode := "TEST-RUR-" + strings.ToUpper(uuid.New().String()[:5])
	stateTN := "Tamil Nadu"
	stateCode := "33"
	ruralType := "RURAL"
	districtCode := "610"
	blockCode := "6255"
	villageCode := "636338"
	subdistrictCode := "5983"
	cityName := "Alagapuram"
	campusLocality := "Main Road, Near Panchayat Office"
	contactEmail := "rural-" + strings.ToLower(testCode) + "@college.edu.in"
	pwd := "SuperSecret123!"

	req := models.CreateCollegeRequest{
		CollegeCode:     testCode,
		Name:            "Tamil Nadu Rural Polytechnic College",
		City:            &cityName,
		State:           &stateTN,
		Timezone:        "Asia/Kolkata",
		ContactEmail:    &contactEmail,
		Password:        &pwd,
		LocationType:    &ruralType,
		StateCode:       &stateCode,
		DistrictCode:    &districtCode,
		BlockCode:       &blockCode,
		SubdistrictCode: &subdistrictCode,
		VillageCode:     &villageCode,
		CampusLocality:  &campusLocality,
	}

	college, err := svc.CreateCollege(ctx, req)
	if err != nil {
		t.Fatalf("failed to create college with TN rural location: %v", err)
	}

	if college.LocationType == nil || *college.LocationType != "RURAL" {
		t.Errorf("expected location_type RURAL, got %v", college.LocationType)
	}
	if college.DistrictCode == nil || *college.DistrictCode != "610" {
		t.Errorf("expected district_code 610, got %v", college.DistrictCode)
	}
	if college.BlockCode == nil || *college.BlockCode != "6255" {
		t.Errorf("expected block_code 6255, got %v", college.BlockCode)
	}
	if college.VillageCode == nil || *college.VillageCode != "636338" {
		t.Errorf("expected village_code 636338, got %v", college.VillageCode)
	}
	if college.SubdistrictCode == nil || *college.SubdistrictCode != "5983" {
		t.Errorf("expected subdistrict_code 5983, got %v", college.SubdistrictCode)
	}

	// Clean up created test college
	_, _ = repo.Executor(ctx).Exec(ctx, "DELETE FROM platform.college_onboarding_checklists WHERE college_id = $1", college.CollegeID)
	_, _ = repo.Executor(ctx).Exec(ctx, "DELETE FROM platform.users WHERE college_id = $1", college.CollegeID)
	_, _ = repo.Executor(ctx).Exec(ctx, "DELETE FROM platform.colleges WHERE college_id = $1", college.CollegeID)
}
