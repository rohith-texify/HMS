package main

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yourusername/hostel-management-system/API/internal/config"
	"github.com/yourusername/hostel-management-system/API/internal/database"
)

type ImportStats struct {
	TableName string
	Expected  int
	Imported  int
	Duration  time.Duration
}

func main() {
	dataDirFlag := flag.String("data-dir", "tamil_nadu_agent_data", "Path to tamil_nadu_agent_data directory")
	flag.Parse()

	dataDir := *dataDirFlag
	if _, err := os.Stat(dataDir); os.IsNotExist(err) {
		// Try walking up or root path
		candidates := []string{
			"tamil_nadu_agent_data",
			filepath.Join("..", "tamil_nadu_agent_data"),
			filepath.Join("..", "..", "tamil_nadu_agent_data"),
			filepath.Join("d:", string(filepath.Separator), "HMS", "tamil_nadu_agent_data"),
		}
		found := false
		for _, c := range candidates {
			if _, err := os.Stat(c); err == nil {
				dataDir = c
				found = true
				break
			}
		}
		if !found {
			log.Fatalf("could not find data directory: %s", *dataDirFlag)
		}
	}

	fmt.Printf("🚀 Starting Tamil Nadu Geo Import using data dir: %s\n", dataDir)

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load configuration: %v", err)
	}

	ctx := context.Background()
	db, err := database.New(ctx, cfg.Database)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()

	pool := db.GetPlatformPool()
	if pool == nil {
		pool = db.GetCollegePool()
	}

	startTime := time.Now()
	var allStats []ImportStats

	// Read metadata.json for expected counts
	metaPath := filepath.Join(dataDir, "metadata.json")
	expectedCounts := make(map[string]int)
	if metaBytes, err := os.ReadFile(metaPath); err == nil {
		var meta struct {
			Counts map[string]struct {
				RecordsExtracted int `json:"records_extracted"`
			} `json:"counts"`
		}
		if err := json.Unmarshal(metaBytes, &meta); err == nil {
			for k, v := range meta.Counts {
				expectedCounts[k] = v.RecordsExtracted
			}
		}
	}

	// 1. Districts
	stats, err := importDistricts(ctx, pool, filepath.Join(dataDir, "districts.csv"), expectedCounts["districts"])
	if err != nil {
		log.Fatalf("failed importing districts: %v", err)
	}
	allStats = append(allStats, stats)

	// 2. Subdistricts
	stats, err = importSubdistricts(ctx, pool, filepath.Join(dataDir, "subdistricts.csv"), expectedCounts["subdistricts"])
	if err != nil {
		log.Fatalf("failed importing subdistricts: %v", err)
	}
	allStats = append(allStats, stats)

	// 3. Blocks
	stats, err = importBlocks(ctx, pool, filepath.Join(dataDir, "blocks.csv"), expectedCounts["blocks"])
	if err != nil {
		log.Fatalf("failed importing blocks: %v", err)
	}
	allStats = append(allStats, stats)

	// 4. Urban Local Bodies
	stats, err = importUrbanLocalBodies(ctx, pool, filepath.Join(dataDir, "urban_local_bodies.csv"), expectedCounts["urban_local_bodies"])
	if err != nil {
		log.Fatalf("failed importing urban local bodies: %v", err)
	}
	allStats = append(allStats, stats)

	// 5. Rural Local Bodies
	stats, err = importRuralLocalBodies(ctx, pool, filepath.Join(dataDir, "rural_local_bodies.csv"), expectedCounts["rural_local_bodies"])
	if err != nil {
		log.Fatalf("failed importing rural local bodies: %v", err)
	}
	allStats = append(allStats, stats)

	// 6. Villages
	stats, err = importVillages(ctx, pool, filepath.Join(dataDir, "villages.csv"), expectedCounts["villages"])
	if err != nil {
		log.Fatalf("failed importing villages: %v", err)
	}
	allStats = append(allStats, stats)

	// 7. Urban Wards
	stats, err = importUrbanWards(ctx, pool, filepath.Join(dataDir, "urban_wards.csv"), expectedCounts["urban_wards"])
	if err != nil {
		log.Fatalf("failed importing urban wards: %v", err)
	}
	allStats = append(allStats, stats)

	// 8. Urban City Areas (Selector)
	stats, err = importUrbanCityAreas(ctx, pool, filepath.Join(dataDir, "urban_city_areas.csv"), expectedCounts["urban_city_areas"])
	if err != nil {
		log.Fatalf("failed importing urban city areas: %v", err)
	}
	allStats = append(allStats, stats)

	// 9. Urban Ward Coverage
	stats, err = importUrbanWardCoverage(ctx, pool, filepath.Join(dataDir, "urban_ward_coverage.csv"), expectedCounts["urban_ward_coverage"])
	if err != nil {
		log.Fatalf("failed importing urban ward coverage: %v", err)
	}
	allStats = append(allStats, stats)

	// 10. Rural Wards
	stats, err = importRuralWards(ctx, pool, filepath.Join(dataDir, "rural_wards.csv"), expectedCounts["rural_wards"])
	if err != nil {
		log.Fatalf("failed importing rural wards: %v", err)
	}
	allStats = append(allStats, stats)

	// 11. Village Gram Panchayat Mapping
	stats, err = importVillageGramPanchayatMapping(ctx, pool, filepath.Join(dataDir, "village_gram_panchayat_mapping.csv"), expectedCounts["village_gram_panchayat_mapping"])
	if err != nil {
		log.Fatalf("failed importing village GP mapping: %v", err)
	}
	allStats = append(allStats, stats)

	// 12. Block Village Mapping
	stats, err = importBlockVillageMapping(ctx, pool, filepath.Join(dataDir, "block_village_mapping.csv"), expectedCounts["block_village_mapping"])
	if err != nil {
		log.Fatalf("failed importing block village mapping: %v", err)
	}
	allStats = append(allStats, stats)

	// 13. Rural Place Hierarchy
	stats, err = importRuralPlaceHierarchy(ctx, pool, filepath.Join(dataDir, "rural_place_hierarchy.csv"), expectedCounts["rural_place_hierarchy"])
	if err != nil {
		log.Fatalf("failed importing rural place hierarchy: %v", err)
	}
	allStats = append(allStats, stats)

	// Final Summary Report
	fmt.Printf("\n========================================================================\n")
	fmt.Printf("📊 TAMIL NADU GEO DATA IMPORT & VALIDATION REPORT\n")
	fmt.Printf("========================================================================\n")
	fmt.Printf("%-32s | %-10s | %-10s | %-10s\n", "Table", "Expected", "Imported", "Duration")
	fmt.Printf("------------------------------------------------------------------------\n")
	totalRows := 0
	for _, s := range allStats {
		matchStatus := "✅"
		if s.Expected > 0 && s.Imported != s.Expected {
			matchStatus = "⚠️"
		}
		fmt.Printf("%-32s | %-10d | %-10d %s | %v\n", s.TableName, s.Expected, s.Imported, matchStatus, s.Duration.Round(time.Millisecond))
		totalRows += s.Imported
	}
	fmt.Printf("------------------------------------------------------------------------\n")
	fmt.Printf("Total Rows Processed: %d across 13 tables in %v\n", totalRows, time.Since(startTime).Round(time.Millisecond))
	fmt.Printf("========================================================================\n")
}

func readCSVRecords(filePath string) ([][]string, []string, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, nil, err
	}
	// Strip UTF-8 BOM if present
	data = bytes.TrimPrefix(data, []byte("\xef\xbb\xbf"))

	r := csv.NewReader(bytes.NewReader(data))
	r.ReuseRecord = false
	header, err := r.Read()
	if err != nil {
		return nil, nil, err
	}
	for i, h := range header {
		header[i] = strings.TrimSpace(h)
	}

	var records [][]string
	for {
		rec, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, nil, err
		}
		records = append(records, rec)
	}
	return records, header, nil
}

func nullIfEmpty(s string) *string {
	v := strings.TrimSpace(s)
	if v == "" {
		return nil
	}
	return &v
}

func val(rec []string, idxMap map[string]int, key string) string {
	if idx, ok := idxMap[key]; ok && idx < len(rec) {
		return strings.TrimSpace(rec[idx])
	}
	return ""
}

func nullVal(rec []string, idxMap map[string]int, key string) *string {
	v := val(rec, idxMap, key)
	if v == "" {
		return nil
	}
	return &v
}

func buildHeaderMap(header []string) map[string]int {
	m := make(map[string]int, len(header))
	for i, h := range header {
		m[h] = i
	}
	return m
}

// 1. Districts
func importDistricts(ctx context.Context, pool *pgxpool.Pool, filePath string, expected int) (ImportStats, error) {
	start := time.Now()
	records, header, err := readCSVRecords(filePath)
	if err != nil {
		return ImportStats{}, err
	}
	idx := buildHeaderMap(header)

	batch := &pgx.Batch{}
	for _, r := range records {
		dCode := val(r, idx, "district_code")
		if dCode == "" {
			continue
		}
		dVersion := nullVal(r, idx, "district_version")
		dName := val(r, idx, "district_name")
		dNameLocal := nullVal(r, idx, "district_name_local")
		c2001 := nullVal(r, idx, "census_2001_code")
		c2011 := nullVal(r, idx, "census_2011_code")

		query := `
			INSERT INTO geo.districts (district_code, district_version, district_name, district_name_local, census_2001_code, census_2011_code, state_code, state_name)
			VALUES ($1, $2, $3, $4, $5, $6, '33', 'Tamil Nadu')
			ON CONFLICT (district_code) DO UPDATE SET
				district_version = EXCLUDED.district_version,
				district_name = EXCLUDED.district_name,
				district_name_local = EXCLUDED.district_name_local,
				census_2001_code = EXCLUDED.census_2001_code,
				census_2011_code = EXCLUDED.census_2011_code,
				updated_at = CURRENT_TIMESTAMP;`
		batch.Queue(query, dCode, dVersion, dName, dNameLocal, c2001, c2011)
	}

	br := pool.SendBatch(ctx, batch)
	for i := 0; i < batch.Len(); i++ {
		if _, err := br.Exec(); err != nil {
			_ = br.Close()
			return ImportStats{}, fmt.Errorf("district row %d error: %w", i, err)
		}
	}
	_ = br.Close()

	var count int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM geo.districts").Scan(&count)
	return ImportStats{TableName: "geo.districts", Expected: expected, Imported: count, Duration: time.Since(start)}, nil
}

// 2. Subdistricts
func importSubdistricts(ctx context.Context, pool *pgxpool.Pool, filePath string, expected int) (ImportStats, error) {
	start := time.Now()
	records, header, err := readCSVRecords(filePath)
	if err != nil {
		return ImportStats{}, err
	}
	idx := buildHeaderMap(header)

	batch := &pgx.Batch{}
	for _, r := range records {
		sCode := val(r, idx, "subdistrict_code")
		if sCode == "" {
			continue
		}
		dCode := val(r, idx, "district_code")
		dName := nullVal(r, idx, "district_name")
		sVer := nullVal(r, idx, "subdistrict_version")
		sName := val(r, idx, "subdistrict_name")
		c2001 := nullVal(r, idx, "census_2001_code")
		c2011 := nullVal(r, idx, "census_2011_code")

		query := `
			INSERT INTO geo.subdistricts (subdistrict_code, district_code, district_name, subdistrict_version, subdistrict_name, census_2001_code, census_2011_code)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (subdistrict_code) DO UPDATE SET
				district_code = EXCLUDED.district_code,
				district_name = EXCLUDED.district_name,
				subdistrict_version = EXCLUDED.subdistrict_version,
				subdistrict_name = EXCLUDED.subdistrict_name,
				census_2001_code = EXCLUDED.census_2001_code,
				census_2011_code = EXCLUDED.census_2011_code;`
		batch.Queue(query, sCode, dCode, dName, sVer, sName, c2001, c2011)
	}

	br := pool.SendBatch(ctx, batch)
	for i := 0; i < batch.Len(); i++ {
		if _, err := br.Exec(); err != nil {
			_ = br.Close()
			return ImportStats{}, fmt.Errorf("subdistrict row %d error: %w", i, err)
		}
	}
	_ = br.Close()

	var count int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM geo.subdistricts").Scan(&count)
	return ImportStats{TableName: "geo.subdistricts", Expected: expected, Imported: count, Duration: time.Since(start)}, nil
}

// 3. Blocks
func importBlocks(ctx context.Context, pool *pgxpool.Pool, filePath string, expected int) (ImportStats, error) {
	start := time.Now()
	records, header, err := readCSVRecords(filePath)
	if err != nil {
		return ImportStats{}, err
	}
	idx := buildHeaderMap(header)

	batch := &pgx.Batch{}
	for _, r := range records {
		bCode := val(r, idx, "block_code")
		if bCode == "" {
			continue
		}
		dCode := val(r, idx, "district_code")
		dName := nullVal(r, idx, "district_name")
		bVer := nullVal(r, idx, "block_version")
		bName := val(r, idx, "block_name")

		query := `
			INSERT INTO geo.blocks (block_code, district_code, district_name, block_version, block_name)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (block_code) DO UPDATE SET
				district_code = EXCLUDED.district_code,
				district_name = EXCLUDED.district_name,
				block_version = EXCLUDED.block_version,
				block_name = EXCLUDED.block_name;`
		batch.Queue(query, bCode, dCode, dName, bVer, bName)
	}

	br := pool.SendBatch(ctx, batch)
	for i := 0; i < batch.Len(); i++ {
		if _, err := br.Exec(); err != nil {
			_ = br.Close()
			return ImportStats{}, fmt.Errorf("block row %d error: %w", i, err)
		}
	}
	_ = br.Close()

	var count int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM geo.blocks").Scan(&count)
	return ImportStats{TableName: "geo.blocks", Expected: expected, Imported: count, Duration: time.Since(start)}, nil
}

// 4. Urban Local Bodies
func importUrbanLocalBodies(ctx context.Context, pool *pgxpool.Pool, filePath string, expected int) (ImportStats, error) {
	start := time.Now()
	records, header, err := readCSVRecords(filePath)
	if err != nil {
		return ImportStats{}, err
	}
	idx := buildHeaderMap(header)

	batch := &pgx.Batch{}
	for _, r := range records {
		lbCode := val(r, idx, "local_body_code")
		if lbCode == "" {
			continue
		}
		lbTypeCode := nullVal(r, idx, "local_body_type_code")
		lbTypeName := nullVal(r, idx, "local_body_type_name")
		lbVer := nullVal(r, idx, "local_body_version")
		lbName := val(r, idx, "local_body_name")
		lbNameLocal := nullVal(r, idx, "local_body_name_local")
		c2001 := nullVal(r, idx, "census_2001_code")
		c2011 := nullVal(r, idx, "census_2011_code")

		query := `
			INSERT INTO geo.urban_local_bodies (local_body_code, local_body_type_code, local_body_type_name, local_body_version, local_body_name, local_body_name_local, census_2001_code, census_2011_code)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (local_body_code) DO UPDATE SET
				local_body_type_code = EXCLUDED.local_body_type_code,
				local_body_type_name = EXCLUDED.local_body_type_name,
				local_body_version = EXCLUDED.local_body_version,
				local_body_name = EXCLUDED.local_body_name,
				local_body_name_local = EXCLUDED.local_body_name_local,
				census_2001_code = EXCLUDED.census_2001_code,
				census_2011_code = EXCLUDED.census_2011_code;`
		batch.Queue(query, lbCode, lbTypeCode, lbTypeName, lbVer, lbName, lbNameLocal, c2001, c2011)
	}

	br := pool.SendBatch(ctx, batch)
	for i := 0; i < batch.Len(); i++ {
		if _, err := br.Exec(); err != nil {
			_ = br.Close()
			return ImportStats{}, fmt.Errorf("ulb row %d error: %w", i, err)
		}
	}
	_ = br.Close()

	var count int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM geo.urban_local_bodies").Scan(&count)
	return ImportStats{TableName: "geo.urban_local_bodies", Expected: expected, Imported: count, Duration: time.Since(start)}, nil
}

// 5. Rural Local Bodies
func importRuralLocalBodies(ctx context.Context, pool *pgxpool.Pool, filePath string, expected int) (ImportStats, error) {
	start := time.Now()
	records, header, err := readCSVRecords(filePath)
	if err != nil {
		return ImportStats{}, err
	}
	idx := buildHeaderMap(header)

	const chunkSize = 1000
	for i := 0; i < len(records); i += chunkSize {
		end := i + chunkSize
		if end > len(records) {
			end = len(records)
		}
		chunk := records[i:end]
		batch := &pgx.Batch{}
		for _, r := range chunk {
			lbCode := val(r, idx, "local_body_code")
			if lbCode == "" {
				continue
			}
			lbTypeCode := nullVal(r, idx, "local_body_type_code")
			lbTypeName := nullVal(r, idx, "local_body_type_name")
			lbVer := nullVal(r, idx, "local_body_version")
			lbName := val(r, idx, "local_body_name")
			lbNameLocal := nullVal(r, idx, "local_body_name_local")
			parentCode := nullVal(r, idx, "parent_local_body_code")

			query := `
				INSERT INTO geo.rural_local_bodies (local_body_code, local_body_type_code, local_body_type_name, local_body_version, local_body_name, local_body_name_local, parent_local_body_code)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
				ON CONFLICT (local_body_code) DO UPDATE SET
					local_body_type_code = EXCLUDED.local_body_type_code,
					local_body_type_name = EXCLUDED.local_body_type_name,
					local_body_version = EXCLUDED.local_body_version,
					local_body_name = EXCLUDED.local_body_name,
					local_body_name_local = EXCLUDED.local_body_name_local,
					parent_local_body_code = EXCLUDED.parent_local_body_code;`
			batch.Queue(query, lbCode, lbTypeCode, lbTypeName, lbVer, lbName, lbNameLocal, parentCode)
		}
		br := pool.SendBatch(ctx, batch)
		for j := 0; j < batch.Len(); j++ {
			if _, err := br.Exec(); err != nil {
				_ = br.Close()
				return ImportStats{}, fmt.Errorf("rlb row error: %w", err)
			}
		}
		_ = br.Close()
	}

	var count int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM geo.rural_local_bodies").Scan(&count)
	return ImportStats{TableName: "geo.rural_local_bodies", Expected: expected, Imported: count, Duration: time.Since(start)}, nil
}

// 6. Villages
func importVillages(ctx context.Context, pool *pgxpool.Pool, filePath string, expected int) (ImportStats, error) {
	start := time.Now()
	records, header, err := readCSVRecords(filePath)
	if err != nil {
		return ImportStats{}, err
	}
	idx := buildHeaderMap(header)

	const chunkSize = 1000
	for i := 0; i < len(records); i += chunkSize {
		end := i + chunkSize
		if end > len(records) {
			end = len(records)
		}
		chunk := records[i:end]
		batch := &pgx.Batch{}
		for _, r := range chunk {
			vCode := val(r, idx, "village_code")
			if vCode == "" {
				continue
			}
			dCode := val(r, idx, "district_code")
			dName := nullVal(r, idx, "district_name")
			sCode := nullVal(r, idx, "subdistrict_code")
			sName := nullVal(r, idx, "subdistrict_name")
			vVer := nullVal(r, idx, "village_version")
			vName := val(r, idx, "village_name")
			vNameLocal := nullVal(r, idx, "village_name_local")
			vStatus := nullVal(r, idx, "village_status")
			c2001 := nullVal(r, idx, "census_2001_code")
			c2011 := nullVal(r, idx, "census_2011_code")

			query := `
				INSERT INTO geo.villages (village_code, district_code, district_name, subdistrict_code, subdistrict_name, village_version, village_name, village_name_local, village_status, census_2001_code, census_2011_code)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
				ON CONFLICT (village_code) DO UPDATE SET
					district_code = EXCLUDED.district_code,
					district_name = EXCLUDED.district_name,
					subdistrict_code = EXCLUDED.subdistrict_code,
					subdistrict_name = EXCLUDED.subdistrict_name,
					village_version = EXCLUDED.village_version,
					village_name = EXCLUDED.village_name,
					village_name_local = EXCLUDED.village_name_local,
					village_status = EXCLUDED.village_status,
					census_2001_code = EXCLUDED.census_2001_code,
					census_2011_code = EXCLUDED.census_2011_code;`
			batch.Queue(query, vCode, dCode, dName, sCode, sName, vVer, vName, vNameLocal, vStatus, c2001, c2011)
		}
		br := pool.SendBatch(ctx, batch)
		for j := 0; j < batch.Len(); j++ {
			if _, err := br.Exec(); err != nil {
				_ = br.Close()
				return ImportStats{}, fmt.Errorf("village row error: %w", err)
			}
		}
		_ = br.Close()
	}

	var count int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM geo.villages").Scan(&count)
	return ImportStats{TableName: "geo.villages", Expected: expected, Imported: count, Duration: time.Since(start)}, nil
}

// 7. Urban Wards
func importUrbanWards(ctx context.Context, pool *pgxpool.Pool, filePath string, expected int) (ImportStats, error) {
	start := time.Now()
	records, header, err := readCSVRecords(filePath)
	if err != nil {
		return ImportStats{}, err
	}
	idx := buildHeaderMap(header)

	const chunkSize = 1000
	for i := 0; i < len(records); i += chunkSize {
		end := i + chunkSize
		if end > len(records) {
			end = len(records)
		}
		chunk := records[i:end]
		batch := &pgx.Batch{}
		for _, r := range chunk {
			wCode := val(r, idx, "ward_code")
			if wCode == "" {
				continue
			}
			lbCode := val(r, idx, "local_body_code")
			lbName := nullVal(r, idx, "local_body_name")
			wNum := nullVal(r, idx, "ward_number")
			wName := nullVal(r, idx, "ward_name")

			query := `
				INSERT INTO geo.urban_wards (ward_code, local_body_code, local_body_name, ward_number, ward_name)
				VALUES ($1, $2, $3, $4, $5)
				ON CONFLICT (ward_code) DO UPDATE SET
					local_body_code = EXCLUDED.local_body_code,
					local_body_name = EXCLUDED.local_body_name,
					ward_number = EXCLUDED.ward_number,
					ward_name = EXCLUDED.ward_name;`
			batch.Queue(query, wCode, lbCode, lbName, wNum, wName)
		}
		br := pool.SendBatch(ctx, batch)
		for j := 0; j < batch.Len(); j++ {
			if _, err := br.Exec(); err != nil {
				_ = br.Close()
				return ImportStats{}, fmt.Errorf("urban ward row error: %w", err)
			}
		}
		_ = br.Close()
	}

	var count int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM geo.urban_wards").Scan(&count)
	return ImportStats{TableName: "geo.urban_wards", Expected: expected, Imported: count, Duration: time.Since(start)}, nil
}

// 8. Urban City Areas (Selector)
func importUrbanCityAreas(ctx context.Context, pool *pgxpool.Pool, filePath string, expected int) (ImportStats, error) {
	start := time.Now()
	records, header, err := readCSVRecords(filePath)
	if err != nil {
		return ImportStats{}, err
	}
	idx := buildHeaderMap(header)

	const chunkSize = 1000
	for i := 0; i < len(records); i += chunkSize {
		end := i + chunkSize
		if end > len(records) {
			end = len(records)
		}
		chunk := records[i:end]
		batch := &pgx.Batch{}
		for _, r := range chunk {
			wCode := val(r, idx, "ward_code")
			if wCode == "" {
				continue
			}
			sCode := val(r, idx, "state_code")
			if sCode == "" {
				sCode = "33"
			}
			sName := val(r, idx, "state_name")
			if sName == "" {
				sName = "Tamil Nadu"
			}
			dCode := val(r, idx, "district_code")
			dName := nullVal(r, idx, "district_name")
			cCode := val(r, idx, "city_code")
			cName := nullVal(r, idx, "city_name")
			wNum := nullVal(r, idx, "ward_number")
			aName := nullVal(r, idx, "area_name")

			query := `
				INSERT INTO geo.urban_city_areas (ward_code, state_code, state_name, district_code, district_name, city_code, city_name, ward_number, area_name)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
				ON CONFLICT (ward_code) DO UPDATE SET
					state_code = EXCLUDED.state_code,
					state_name = EXCLUDED.state_name,
					district_code = EXCLUDED.district_code,
					district_name = EXCLUDED.district_name,
					city_code = EXCLUDED.city_code,
					city_name = EXCLUDED.city_name,
					ward_number = EXCLUDED.ward_number,
					area_name = EXCLUDED.area_name;`
			batch.Queue(query, wCode, sCode, sName, dCode, dName, cCode, cName, wNum, aName)
		}
		br := pool.SendBatch(ctx, batch)
		for j := 0; j < batch.Len(); j++ {
			if _, err := br.Exec(); err != nil {
				_ = br.Close()
				return ImportStats{}, fmt.Errorf("urban city area error: %w", err)
			}
		}
		_ = br.Close()
	}

	var count int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM geo.urban_city_areas").Scan(&count)
	return ImportStats{TableName: "geo.urban_city_areas", Expected: expected, Imported: count, Duration: time.Since(start)}, nil
}

// 9. Urban Ward Coverage
func importUrbanWardCoverage(ctx context.Context, pool *pgxpool.Pool, filePath string, expected int) (ImportStats, error) {
	start := time.Now()
	records, header, err := readCSVRecords(filePath)
	if err != nil {
		return ImportStats{}, err
	}
	idx := buildHeaderMap(header)

	const chunkSize = 1000
	for i := 0; i < len(records); i += chunkSize {
		end := i + chunkSize
		if end > len(records) {
			end = len(records)
		}
		chunk := records[i:end]
		batch := &pgx.Batch{}
		for _, r := range chunk {
			lbCode := val(r, idx, "local_body_code")
			wCode := val(r, idx, "ward_code")
			if lbCode == "" || wCode == "" {
				continue
			}
			lbName := nullVal(r, idx, "local_body_name")
			wNum := nullVal(r, idx, "ward_number")
			wName := nullVal(r, idx, "ward_name")
			dCode := nullVal(r, idx, "district_code")
			dName := nullVal(r, idx, "district_name")
			sCode := nullVal(r, idx, "subdistrict_code")
			sName := nullVal(r, idx, "subdistrict_name")

			query := `
				INSERT INTO geo.urban_ward_coverage (local_body_code, local_body_name, ward_code, ward_number, ward_name, district_code, district_name, subdistrict_code, subdistrict_name)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
				ON CONFLICT (local_body_code, ward_code, district_code, subdistrict_code) DO NOTHING;`
			batch.Queue(query, lbCode, lbName, wCode, wNum, wName, dCode, dName, sCode, sName)
		}
		br := pool.SendBatch(ctx, batch)
		for j := 0; j < batch.Len(); j++ {
			if _, err := br.Exec(); err != nil {
				_ = br.Close()
				return ImportStats{}, fmt.Errorf("urban ward cov error: %w", err)
			}
		}
		_ = br.Close()
	}

	var count int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM geo.urban_ward_coverage").Scan(&count)
	return ImportStats{TableName: "geo.urban_ward_coverage", Expected: expected, Imported: count, Duration: time.Since(start)}, nil
}

// 10. Rural Wards
func importRuralWards(ctx context.Context, pool *pgxpool.Pool, filePath string, expected int) (ImportStats, error) {
	start := time.Now()
	records, header, err := readCSVRecords(filePath)
	if err != nil {
		return ImportStats{}, err
	}
	idx := buildHeaderMap(header)

	const chunkSize = 2000
	for i := 0; i < len(records); i += chunkSize {
		end := i + chunkSize
		if end > len(records) {
			end = len(records)
		}
		chunk := records[i:end]
		batch := &pgx.Batch{}
		for _, r := range chunk {
			lbCode := val(r, idx, "local_body_code")
			wCode := val(r, idx, "ward_code")
			wNum := val(r, idx, "ward_number")
			if lbCode == "" || wNum == "" {
				continue
			}
			lbName := nullVal(r, idx, "local_body_name")
			lbTypeName := nullVal(r, idx, "local_body_type_name")
			dParentName := nullVal(r, idx, "district_parent_name")
			iParentName := nullVal(r, idx, "intermediate_parent_name")
			wName := nullVal(r, idx, "ward_name")
			wNameLocal := nullVal(r, idx, "ward_name_local")

			query := `
				INSERT INTO geo.rural_wards (local_body_code, local_body_name, local_body_type_name, district_parent_name, intermediate_parent_name, ward_code, ward_number, ward_name, ward_name_local)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
				ON CONFLICT (local_body_code, ward_code, ward_number) DO NOTHING;`
			batch.Queue(query, lbCode, lbName, lbTypeName, dParentName, iParentName, wCode, wNum, wName, wNameLocal)
		}
		br := pool.SendBatch(ctx, batch)
		for j := 0; j < batch.Len(); j++ {
			if _, err := br.Exec(); err != nil {
				_ = br.Close()
				return ImportStats{}, fmt.Errorf("rural ward row error: %w", err)
			}
		}
		_ = br.Close()
	}

	var count int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM geo.rural_wards").Scan(&count)
	return ImportStats{TableName: "geo.rural_wards", Expected: expected, Imported: count, Duration: time.Since(start)}, nil
}

// 11. Village Gram Panchayat Mapping
func importVillageGramPanchayatMapping(ctx context.Context, pool *pgxpool.Pool, filePath string, expected int) (ImportStats, error) {
	start := time.Now()
	records, header, err := readCSVRecords(filePath)
	if err != nil {
		return ImportStats{}, err
	}
	idx := buildHeaderMap(header)

	const chunkSize = 1000
	for i := 0; i < len(records); i += chunkSize {
		end := i + chunkSize
		if end > len(records) {
			end = len(records)
		}
		chunk := records[i:end]
		batch := &pgx.Batch{}
		for _, r := range chunk {
			vCode := val(r, idx, "village_code")
			if vCode == "" {
				continue
			}
			lbCode := nullVal(r, idx, "local_body_code")
			dCode := nullVal(r, idx, "district_code")
			dName := nullVal(r, idx, "district_name")
			dc2011 := nullVal(r, idx, "district_census_2011_code")
			dc2001 := nullVal(r, idx, "district_census_2001_code")
			sCode := nullVal(r, idx, "subdistrict_code")
			sName := nullVal(r, idx, "subdistrict_name")
			sc2011 := nullVal(r, idx, "subdistrict_census_2011_code")
			sc2001 := nullVal(r, idx, "subdistrict_census_2001_code")
			vName := nullVal(r, idx, "village_name")
			vc2011 := nullVal(r, idx, "village_census_2011_code")
			vc2001 := nullVal(r, idx, "village_census_2001_code")
			lbName := nullVal(r, idx, "local_body_name")

			query := `
				INSERT INTO geo.village_gram_panchayat_mapping (district_code, district_name, district_census_2011_code, district_census_2001_code, subdistrict_code, subdistrict_name, subdistrict_census_2011_code, subdistrict_census_2001_code, village_code, village_name, village_census_2011_code, village_census_2001_code, local_body_code, local_body_name)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
				ON CONFLICT (village_code, local_body_code) DO NOTHING;`
			batch.Queue(query, dCode, dName, dc2011, dc2001, sCode, sName, sc2011, sc2001, vCode, vName, vc2011, vc2001, lbCode, lbName)
		}
		br := pool.SendBatch(ctx, batch)
		for j := 0; j < batch.Len(); j++ {
			if _, err := br.Exec(); err != nil {
				_ = br.Close()
				return ImportStats{}, fmt.Errorf("village gp mapping error: %w", err)
			}
		}
		_ = br.Close()
	}

	var count int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM geo.village_gram_panchayat_mapping").Scan(&count)
	return ImportStats{TableName: "geo.village_gram_panchayat_mapping", Expected: expected, Imported: count, Duration: time.Since(start)}, nil
}

// 12. Block Village Mapping
func importBlockVillageMapping(ctx context.Context, pool *pgxpool.Pool, filePath string, expected int) (ImportStats, error) {
	start := time.Now()
	records, header, err := readCSVRecords(filePath)
	if err != nil {
		return ImportStats{}, err
	}
	idx := buildHeaderMap(header)

	const chunkSize = 1000
	for i := 0; i < len(records); i += chunkSize {
		end := i + chunkSize
		if end > len(records) {
			end = len(records)
		}
		chunk := records[i:end]
		batch := &pgx.Batch{}
		for _, r := range chunk {
			vCode := val(r, idx, "village_code")
			if vCode == "" {
				continue
			}
			sCode := val(r, idx, "state_code")
			if sCode == "" {
				sCode = "33"
			}
			sName := val(r, idx, "state_name")
			if sName == "" {
				sName = "Tamil Nadu"
			}
			dCode := val(r, idx, "district_code")
			dName := nullVal(r, idx, "district_name")
			bCode := val(r, idx, "block_code")
			bName := nullVal(r, idx, "block_name")
			vName := nullVal(r, idx, "village_name")

			query := `
				INSERT INTO geo.block_village_mapping (village_code, state_code, state_name, district_code, district_name, block_code, block_name, village_name)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
				ON CONFLICT (village_code) DO UPDATE SET
					state_code = EXCLUDED.state_code,
					state_name = EXCLUDED.state_name,
					district_code = EXCLUDED.district_code,
					district_name = EXCLUDED.district_name,
					block_code = EXCLUDED.block_code,
					block_name = EXCLUDED.block_name,
					village_name = EXCLUDED.village_name;`
			batch.Queue(query, vCode, sCode, sName, dCode, dName, bCode, bName, vName)
		}
		br := pool.SendBatch(ctx, batch)
		for j := 0; j < batch.Len(); j++ {
			if _, err := br.Exec(); err != nil {
				_ = br.Close()
				return ImportStats{}, fmt.Errorf("block village mapping error: %w", err)
			}
		}
		_ = br.Close()
	}

	var count int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM geo.block_village_mapping").Scan(&count)
	return ImportStats{TableName: "geo.block_village_mapping", Expected: expected, Imported: count, Duration: time.Since(start)}, nil
}

// 13. Rural Place Hierarchy
func importRuralPlaceHierarchy(ctx context.Context, pool *pgxpool.Pool, filePath string, expected int) (ImportStats, error) {
	start := time.Now()
	records, header, err := readCSVRecords(filePath)
	if err != nil {
		return ImportStats{}, err
	}
	idx := buildHeaderMap(header)

	const chunkSize = 1000
	for i := 0; i < len(records); i += chunkSize {
		end := i + chunkSize
		if end > len(records) {
			end = len(records)
		}
		chunk := records[i:end]
		batch := &pgx.Batch{}
		for _, r := range chunk {
			vCode := val(r, idx, "village_code")
			if vCode == "" {
				continue
			}
			sCode := val(r, idx, "state_code")
			if sCode == "" {
				sCode = "33"
			}
			sName := val(r, idx, "state_name")
			if sName == "" {
				sName = "Tamil Nadu"
			}
			dCode := val(r, idx, "district_code")
			dName := nullVal(r, idx, "district_name")
			bCode := val(r, idx, "block_code")
			bName := nullVal(r, idx, "block_name")
			subCode := nullVal(r, idx, "subdistrict_code")
			subName := nullVal(r, idx, "subdistrict_name")
			vName := nullVal(r, idx, "village_name")
			vStatus := nullVal(r, idx, "village_status")

			query := `
				INSERT INTO geo.rural_place_hierarchy (village_code, state_code, state_name, district_code, district_name, block_code, block_name, subdistrict_code, subdistrict_name, village_name, village_status)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
				ON CONFLICT (village_code) DO UPDATE SET
					state_code = EXCLUDED.state_code,
					state_name = EXCLUDED.state_name,
					district_code = EXCLUDED.district_code,
					district_name = EXCLUDED.district_name,
					block_code = EXCLUDED.block_code,
					block_name = EXCLUDED.block_name,
					subdistrict_code = EXCLUDED.subdistrict_code,
					subdistrict_name = EXCLUDED.subdistrict_name,
					village_name = EXCLUDED.village_name,
					village_status = EXCLUDED.village_status;`
			batch.Queue(query, vCode, sCode, sName, dCode, dName, bCode, bName, subCode, subName, vName, vStatus)
		}
		br := pool.SendBatch(ctx, batch)
		for j := 0; j < batch.Len(); j++ {
			if _, err := br.Exec(); err != nil {
				_ = br.Close()
				return ImportStats{}, fmt.Errorf("rural place hierarchy error: %w", err)
			}
		}
		_ = br.Close()
	}

	var count int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM geo.rural_place_hierarchy").Scan(&count)
	return ImportStats{TableName: "geo.rural_place_hierarchy", Expected: expected, Imported: count, Duration: time.Since(start)}, nil
}
