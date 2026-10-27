package geo

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository interface {
	GetDistricts(ctx context.Context) ([]District, error)
	GetSubdistrictsByDistrict(ctx context.Context, districtCode string) ([]Subdistrict, error)
	GetBlocksByDistrict(ctx context.Context, districtCode string) ([]Block, error)
	GetVillages(ctx context.Context, districtCode, subdistrictCode, blockCode, search string, limit, offset int) ([]Village, int, error)
	GetUrbanLocalBodiesByDistrict(ctx context.Context, districtCode string) ([]UrbanLocalBody, error)
	GetUrbanWardsByLocalBody(ctx context.Context, localBodyCode string) ([]UrbanWard, error)
	GetUrbanCityAreas(ctx context.Context, districtCode, cityCode string) ([]UrbanCityArea, error)
	GetRuralHierarchy(ctx context.Context, districtCode, blockCode string, limit, offset int) ([]RuralPlaceHierarchy, int, error)
}

type repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) Repository {
	return &repository{pool: pool}
}

// 1. Districts (Tamil Nadu state code 33)
func (r *repository) GetDistricts(ctx context.Context) ([]District, error) {
	query := `
		SELECT district_code, district_version, district_name, district_name_local,
		       census_2001_code, census_2011_code, state_code, state_name, created_at
		FROM geo.districts
		WHERE state_code = '33'
		ORDER BY district_name ASC;`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query districts: %w", err)
	}
	defer rows.Close()

	var districts []District
	for rows.Next() {
		var d District
		if err := rows.Scan(
			&d.DistrictCode, &d.DistrictVersion, &d.DistrictName, &d.DistrictNameLocal,
			&d.Census2001Code, &d.Census2011Code, &d.StateCode, &d.StateName, &d.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan district row: %w", err)
		}
		districts = append(districts, d)
	}
	return districts, nil
}

// 2. Subdistricts by District
func (r *repository) GetSubdistrictsByDistrict(ctx context.Context, districtCode string) ([]Subdistrict, error) {
	query := `
		SELECT subdistrict_code, district_code, district_name, subdistrict_version,
		       subdistrict_name, census_2001_code, census_2011_code, created_at
		FROM geo.subdistricts
		WHERE district_code = $1
		ORDER BY subdistrict_name ASC;`

	rows, err := r.pool.Query(ctx, query, districtCode)
	if err != nil {
		return nil, fmt.Errorf("failed to query subdistricts: %w", err)
	}
	defer rows.Close()

	var subdistricts []Subdistrict
	for rows.Next() {
		var s Subdistrict
		if err := rows.Scan(
			&s.SubdistrictCode, &s.DistrictCode, &s.DistrictName, &s.SubdistrictVersion,
			&s.SubdistrictName, &s.Census2001Code, &s.Census2011Code, &s.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan subdistrict row: %w", err)
		}
		subdistricts = append(subdistricts, s)
	}
	return subdistricts, nil
}

// 3. Blocks by District
func (r *repository) GetBlocksByDistrict(ctx context.Context, districtCode string) ([]Block, error) {
	query := `
		SELECT block_code, district_code, district_name, block_version, block_name, created_at
		FROM geo.blocks
		WHERE district_code = $1
		ORDER BY block_name ASC;`

	rows, err := r.pool.Query(ctx, query, districtCode)
	if err != nil {
		return nil, fmt.Errorf("failed to query blocks: %w", err)
	}
	defer rows.Close()

	var blocks []Block
	for rows.Next() {
		var b Block
		if err := rows.Scan(
			&b.BlockCode, &b.DistrictCode, &b.DistrictName, &b.BlockVersion, &b.BlockName, &b.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan block row: %w", err)
		}
		blocks = append(blocks, b)
	}
	return blocks, nil
}

// 4. Villages by District, Subdistrict or Block
func (r *repository) GetVillages(ctx context.Context, districtCode, subdistrictCode, blockCode, search string, limit, offset int) ([]Village, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	var whereClauses []string
	var args []interface{}
	argIdx := 1

	if blockCode != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("bvm.block_code = $%d", argIdx))
		args = append(args, blockCode)
		argIdx++
	}
	if districtCode != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("v.district_code = $%d", argIdx))
		args = append(args, districtCode)
		argIdx++
	}
	if subdistrictCode != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("v.subdistrict_code = $%d", argIdx))
		args = append(args, subdistrictCode)
		argIdx++
	}
	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(v.village_name ILIKE $%d OR v.village_code ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	fromSQL := "FROM geo.villages v"
	if blockCode != "" {
		fromSQL += " JOIN geo.block_village_mapping bvm ON bvm.village_code = v.village_code"
	} else {
		fromSQL += " LEFT JOIN geo.block_village_mapping bvm ON bvm.village_code = v.village_code"
	}

	countQuery := fmt.Sprintf("SELECT count(*) %s %s", fromSQL, whereSQL)
	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count villages: %w", err)
	}

	selectQuery := fmt.Sprintf(`
		SELECT v.village_code, v.district_code, v.district_name, v.subdistrict_code, v.subdistrict_name,
		       v.village_version, v.village_name, v.village_name_local, v.village_status,
		       v.census_2001_code, v.census_2011_code, bvm.block_code, bvm.block_name, v.created_at
		%s
		%s
		ORDER BY v.village_name ASC
		LIMIT $%d OFFSET $%d;`, fromSQL, whereSQL, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query villages: %w", err)
	}
	defer rows.Close()

	var villages []Village
	for rows.Next() {
		var v Village
		if err := rows.Scan(
			&v.VillageCode, &v.DistrictCode, &v.DistrictName, &v.SubdistrictCode, &v.SubdistrictName,
			&v.VillageVersion, &v.VillageName, &v.VillageNameLocal, &v.VillageStatus,
			&v.Census2001Code, &v.Census2011Code, &v.BlockCode, &v.BlockName, &v.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan village row: %w", err)
		}
		villages = append(villages, v)
	}
	return villages, total, nil
}

// 5. Urban Local Bodies by District (using supplied ward coverage mapping)
func (r *repository) GetUrbanLocalBodiesByDistrict(ctx context.Context, districtCode string) ([]UrbanLocalBody, error) {
	query := `
		SELECT DISTINCT ulb.local_body_code, ulb.local_body_type_code, ulb.local_body_type_name,
		       ulb.local_body_version, ulb.local_body_name, ulb.local_body_name_local,
		       ulb.census_2001_code, ulb.census_2011_code,
		       cov.district_code, cov.district_name, ulb.created_at
		FROM geo.urban_ward_coverage cov
		JOIN geo.urban_local_bodies ulb ON ulb.local_body_code = cov.local_body_code
		WHERE cov.district_code = $1
		ORDER BY ulb.local_body_name ASC;`

	rows, err := r.pool.Query(ctx, query, districtCode)
	if err != nil {
		return nil, fmt.Errorf("failed to query urban local bodies: %w", err)
	}
	defer rows.Close()

	var ulbs []UrbanLocalBody
	for rows.Next() {
		var u UrbanLocalBody
		if err := rows.Scan(
			&u.LocalBodyCode, &u.LocalBodyTypeCode, &u.LocalBodyTypeName,
			&u.LocalBodyVersion, &u.LocalBodyName, &u.LocalBodyNameLocal,
			&u.Census2001Code, &u.Census2011Code, &u.DistrictCode, &u.DistrictName, &u.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan urban local body row: %w", err)
		}
		ulbs = append(ulbs, u)
	}
	return ulbs, nil
}

// 6. Urban Wards by Local Body
func (r *repository) GetUrbanWardsByLocalBody(ctx context.Context, localBodyCode string) ([]UrbanWard, error) {
	query := `
		SELECT ward_code, local_body_code, local_body_name, ward_number, ward_name, created_at
		FROM geo.urban_wards
		WHERE local_body_code = $1
		ORDER BY NULLIF(regexp_replace(ward_number, '\D', '', 'g'), '')::int NULLS LAST, ward_number ASC;`

	rows, err := r.pool.Query(ctx, query, localBodyCode)
	if err != nil {
		return nil, fmt.Errorf("failed to query urban wards: %w", err)
	}
	defer rows.Close()

	var wards []UrbanWard
	for rows.Next() {
		var w UrbanWard
		if err := rows.Scan(
			&w.WardCode, &w.LocalBodyCode, &w.LocalBodyName, &w.WardNumber, &w.WardName, &w.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan urban ward row: %w", err)
		}
		wards = append(wards, w)
	}
	return wards, nil
}

// 7. Urban City Areas (Quick Selector)
func (r *repository) GetUrbanCityAreas(ctx context.Context, districtCode, cityCode string) ([]UrbanCityArea, error) {
	var whereClauses []string
	var args []interface{}
	argIdx := 1

	if districtCode != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("district_code = $%d", argIdx))
		args = append(args, districtCode)
		argIdx++
	}
	if cityCode != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("city_code = $%d", argIdx))
		args = append(args, cityCode)
		argIdx++
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	query := fmt.Sprintf(`
		SELECT ward_code, state_code, state_name, district_code, district_name,
		       city_code, city_name, ward_number, area_name, created_at
		FROM geo.urban_city_areas
		%s
		ORDER BY city_name ASC, NULLIF(regexp_replace(ward_number, '\D', '', 'g'), '')::int NULLS LAST, ward_number ASC;`, whereSQL)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query urban city areas: %w", err)
	}
	defer rows.Close()

	var areas []UrbanCityArea
	for rows.Next() {
		var a UrbanCityArea
		if err := rows.Scan(
			&a.WardCode, &a.StateCode, &a.StateName, &a.DistrictCode, &a.DistrictName,
			&a.CityCode, &a.CityName, &a.WardNumber, &a.AreaName, &a.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan urban city area row: %w", err)
		}
		areas = append(areas, a)
	}
	return areas, nil
}

// 8. Rural Place Hierarchy (Quick Selector)
func (r *repository) GetRuralHierarchy(ctx context.Context, districtCode, blockCode string, limit, offset int) ([]RuralPlaceHierarchy, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	var whereClauses []string
	var args []interface{}
	argIdx := 1

	if districtCode != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("district_code = $%d", argIdx))
		args = append(args, districtCode)
		argIdx++
	}
	if blockCode != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("block_code = $%d", argIdx))
		args = append(args, blockCode)
		argIdx++
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	countQuery := fmt.Sprintf("SELECT count(*) FROM geo.rural_place_hierarchy %s", whereSQL)
	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count rural hierarchy: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT village_code, state_code, state_name, district_code, district_name,
		       block_code, block_name, subdistrict_code, subdistrict_name,
		       village_name, village_status, created_at
		FROM geo.rural_place_hierarchy
		%s
		ORDER BY village_name ASC
		LIMIT $%d OFFSET $%d;`, whereSQL, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query rural hierarchy: %w", err)
	}
	defer rows.Close()

	var list []RuralPlaceHierarchy
	for rows.Next() {
		var item RuralPlaceHierarchy
		if err := rows.Scan(
			&item.VillageCode, &item.StateCode, &item.StateName, &item.DistrictCode, &item.DistrictName,
			&item.BlockCode, &item.BlockName, &item.SubdistrictCode, &item.SubdistrictName,
			&item.VillageName, &item.VillageStatus, &item.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan rural hierarchy row: %w", err)
		}
		list = append(list, item)
	}
	return list, total, nil
}
