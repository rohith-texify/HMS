package geo_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yourusername/hostel-management-system/API/internal/config"
	"github.com/yourusername/hostel-management-system/API/internal/database"
	"github.com/yourusername/hostel-management-system/API/internal/geo"
)

func getTestPool(t *testing.T) (*pgxpool.Pool, func()) {
	t.Helper()
	// Change working directory if needed so .env can be loaded
	_ = os.Chdir(filepath.Join("d:", string(filepath.Separator), "HMS"))
	cfg, err := config.Load()
	if err != nil {
		t.Skipf("skipping test: database config not available: %v", err)
	}

	ctx := context.Background()
	db, err := database.New(ctx, cfg.Database)
	if err != nil {
		t.Skipf("skipping test: database connection not available: %v", err)
	}

	pool := db.GetPlatformPool()
	if pool == nil {
		pool = db.GetCollegePool()
	}

	return pool, func() {
		db.Close()
	}
}

// 1. Test Tamil Nadu state code 33
func TestStateCodeTamilNadu(t *testing.T) {
	pool, cleanup := getTestPool(t)
	defer cleanup()

	ctx := context.Background()
	var stateCode, stateName string
	err := pool.QueryRow(ctx, "SELECT DISTINCT state_code, state_name FROM geo.districts LIMIT 1;").Scan(&stateCode, &stateName)
	if err != nil {
		t.Fatalf("failed to query districts: %v", err)
	}

	if stateCode != "33" {
		t.Errorf("expected state_code '33', got '%s'", stateCode)
	}
	if stateName != "Tamil Nadu" {
		t.Errorf("expected state_name 'Tamil Nadu', got '%s'", stateName)
	}
}

// 2. Test preservation of leading zeroes in census and official codes
func TestPreserveLeadingZeroes(t *testing.T) {
	pool, cleanup := getTestPool(t)
	defer cleanup()

	ctx := context.Background()

	// Check Chengalpattu census 2011 code (should be "000")
	var c2011Chengalpattu string
	err := pool.QueryRow(ctx, "SELECT census_2011_code FROM geo.districts WHERE district_name = 'Chengalpattu';").Scan(&c2011Chengalpattu)
	if err != nil {
		t.Fatalf("failed to query Chengalpattu: %v", err)
	}
	if c2011Chengalpattu != "000" {
		t.Errorf("expected leading zeroes preserved as '000', got '%s'", c2011Chengalpattu)
	}

	// Check Agastheeswaram census 2011 code (should be "05884")
	var c2011Agastheeswaram string
	err = pool.QueryRow(ctx, "SELECT census_2011_code FROM geo.subdistricts WHERE subdistrict_name = 'Agastheeswaram';").Scan(&c2011Agastheeswaram)
	if err != nil {
		t.Fatalf("failed to query Agastheeswaram: %v", err)
	}
	if c2011Agastheeswaram != "05884" {
		t.Errorf("expected leading zero preserved as '05884', got '%s'", c2011Agastheeswaram)
	}

	// Check Alagapuram village census 2001 code (should have leading zeroes like "00950400" or "00687800")
	var c2001Village string
	err = pool.QueryRow(ctx, "SELECT census_2001_code FROM geo.villages WHERE village_name = 'Alagapuram' AND district_code = '610';").Scan(&c2001Village)
	if err != nil {
		t.Fatalf("failed to query Alagapuram village: %v", err)
	}
	if len(c2001Village) < 8 || c2001Village[:2] != "00" {
		t.Errorf("expected leading zeroes preserved for village census 2001 code, got '%s'", c2001Village)
	}
}

// 3. Test duplicate-safe / idempotent row counts
func TestDuplicateSafeImportCounts(t *testing.T) {
	pool, cleanup := getTestPool(t)
	defer cleanup()

	ctx := context.Background()

	var districtCount, subdistrictCount, blockCount, villageCount, ulbCount, uwardCount int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM geo.districts;").Scan(&districtCount)
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM geo.subdistricts;").Scan(&subdistrictCount)
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM geo.blocks;").Scan(&blockCount)
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM geo.villages;").Scan(&villageCount)
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM geo.urban_local_bodies;").Scan(&ulbCount)
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM geo.urban_wards;").Scan(&uwardCount)

	if districtCount != 38 {
		t.Errorf("expected exactly 38 districts, got %d", districtCount)
	}
	if subdistrictCount != 317 {
		t.Errorf("expected exactly 317 subdistricts, got %d", subdistrictCount)
	}
	if blockCount != 388 {
		t.Errorf("expected exactly 388 blocks, got %d", blockCount)
	}
	if villageCount != 18681 {
		t.Errorf("expected exactly 18681 villages, got %d", villageCount)
	}
	if ulbCount != 649 {
		t.Errorf("expected exactly 649 urban local bodies, got %d", ulbCount)
	}
	if uwardCount != 12729 {
		t.Errorf("expected exactly 12729 urban wards, got %d", uwardCount)
	}
}

// 4. Test district / city / ward lookup for Poonamallee ward 1 in Thiruvallur district
func TestPoonamalleeWardLookup(t *testing.T) {
	pool, cleanup := getTestPool(t)
	defer cleanup()

	repo := geo.NewRepository(pool)
	service := geo.NewService(repo)
	ctx := context.Background()

	// Query urban city areas for Thiruvallur (589) and Poonamallee (252278)
	areas, err := service.GetUrbanCityAreas(ctx, "589", "252278")
	if err != nil {
		t.Fatalf("failed to query Poonamallee city areas: %v", err)
	}

	foundWard1 := false
	for _, a := range areas {
		if a.WardNumber != nil && *a.WardNumber == "1" {
			foundWard1 = true
			if a.WardCode != "3173" {
				t.Errorf("expected ward_code '3173' for Poonamallee ward 1, got '%s'", a.WardCode)
			}
			if a.DistrictCode != "589" {
				t.Errorf("expected district_code '589', got '%s'", a.DistrictCode)
			}
			if a.CityCode != "252278" {
				t.Errorf("expected city_code '252278', got '%s'", a.CityCode)
			}
			if a.AreaName == nil || *a.AreaName != "Poonamallee (TP) - Ward No.1" {
				t.Errorf("expected area_name 'Poonamallee (TP) - Ward No.1', got '%v'", a.AreaName)
			}
			break
		}
	}

	if !foundWard1 {
		t.Errorf("Poonamallee ward 1 not found in urban city areas")
	}

	// Also check urban wards by local body code 252278
	wards, err := service.GetUrbanWardsByLocalBody(ctx, "252278")
	if err != nil {
		t.Fatalf("failed to query Poonamallee urban wards: %v", err)
	}
	if len(wards) == 0 {
		t.Errorf("expected wards for Poonamallee, got 0")
	}
	if wards[0].WardNumber == nil || *wards[0].WardNumber != "1" {
		t.Errorf("expected first ward to be ward 1, got '%v'", wards[0].WardNumber)
	}
}

// 5. Test rural hierarchy lookup (district -> block -> village)
func TestRuralHierarchyLookup(t *testing.T) {
	pool, cleanup := getTestPool(t)
	defer cleanup()

	repo := geo.NewRepository(pool)
	service := geo.NewService(repo)
	ctx := context.Background()

	// Ariyalur (610), Andimadam block (6255)
	hierarchy, total, err := service.GetRuralHierarchy(ctx, "610", "6255", 10, 0)
	if err != nil {
		t.Fatalf("failed to query rural hierarchy: %v", err)
	}
	if total == 0 {
		t.Fatalf("expected rural hierarchy entries for Ariyalur / Andimadam, got 0")
	}

	foundAlagapuram := false
	for _, h := range hierarchy {
		if h.VillageName != nil && *h.VillageName == "Alagapuram" {
			foundAlagapuram = true
			if h.VillageCode != "636338" {
				t.Errorf("expected village_code '636338', got '%s'", h.VillageCode)
			}
			if h.DistrictCode != "610" {
				t.Errorf("expected district_code '610', got '%s'", h.DistrictCode)
			}
			if h.BlockCode != "6255" {
				t.Errorf("expected block_code '6255', got '%s'", h.BlockCode)
			}
			break
		}
	}
	if !foundAlagapuram {
		t.Errorf("Alagapuram village not found in Ariyalur / Andimadam hierarchy")
	}
}

// 6. Test HTTP Endpoints via Gin
func TestHTTPGeoEndpoints(t *testing.T) {
	gin.SetMode(gin.TestMode)
	pool, cleanup := getTestPool(t)
	defer cleanup()

	repo := geo.NewRepository(pool)
	service := geo.NewService(repo)
	handler := geo.NewHandler(service)

	router := gin.New()
	geo.RegisterRoutes(router.Group(""), handler)

	// GET /geo/districts
	req, _ := http.NewRequest(http.MethodGet, "/geo/districts", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}
	var distResp struct {
		Success bool           `json:"success"`
		Data    []geo.District `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &distResp); err != nil {
		t.Fatalf("failed to parse districts response: %v", err)
	}
	if !distResp.Success || len(distResp.Data) != 38 {
		t.Errorf("expected 38 districts, got %d", len(distResp.Data))
	}

	// GET /geo/urban-local-bodies?district_code=589
	req, _ = http.NewRequest(http.MethodGet, "/geo/urban-local-bodies?district_code=589", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}
	var ulbResp struct {
		Success bool                 `json:"success"`
		Data    []geo.UrbanLocalBody `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &ulbResp); err != nil {
		t.Fatalf("failed to parse ULB response: %v", err)
	}
	foundPoonamallee := false
	for _, u := range ulbResp.Data {
		if u.LocalBodyName == "Poonamallee" {
			foundPoonamallee = true
			break
		}
	}
	if !foundPoonamallee {
		t.Errorf("Poonamallee not found in Thiruvallur urban local bodies")
	}
}
