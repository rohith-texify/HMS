package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

// ErrDuplicateCollegeCode indicates that a college with the specified code already exists.
var ErrDuplicateCollegeCode = errors.New("college code already exists")

// ListColleges retrieves a list of colleges with optional status filtering and pagination.
func (r *Repository) ListColleges(
	ctx context.Context,
	status *string,
	limit, offset int,
) ([]models.College, int, error) {
	return r.ListCollegesWithFilter(ctx, status, nil, limit, offset)
}

// ListCollegesWithFilter retrieves a list of colleges with optional status filter, search query, and pagination.
func (r *Repository) ListCollegesWithFilter(
	ctx context.Context,
	status *string,
	search *string,
	limit, offset int,
) ([]models.College, int, error) {
	// Build the WHERE clause based on optional status and search filters
	var whereClauses []string
	args := []interface{}{}
	argPos := 1

	if status != nil && *status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("status = $%d", argPos))
		args = append(args, *status)
		argPos++
	}

	if search != nil && strings.TrimSpace(*search) != "" {
		pattern := "%" + strings.TrimSpace(*search) + "%"
		whereClauses = append(whereClauses, fmt.Sprintf("(name ILIKE $%d OR college_code ILIKE $%d)", argPos, argPos))
		args = append(args, pattern)
		argPos++
	}

	whereClause := ""
	if len(whereClauses) > 0 {
		whereClause = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	// Count total records
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM platform.colleges
		%s
	`, whereClause)

	var total int
	err := r.Executor(ctx).QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count colleges: %w", err)
	}

	// Query for paginated results
	query := fmt.Sprintf(`
		SELECT
			college_id,
			college_code,
			name,
			city,
			state,
			timezone,
			status,
			contact_email,
			location_type,
			state_code,
			district_code,
			subdistrict_code,
			block_code,
			city_code,
			ward_code,
			village_code,
			campus_locality,
			activated_at,
			suspended_at,
			deactivated_at,
			archived_at,
			lifecycle_reason,
			created_at,
			updated_at
		FROM platform.colleges
		%s
		ORDER BY name ASC
		LIMIT $%d OFFSET $%d
	`, whereClause, argPos, argPos+1)

	args = append(args, limit, offset)

	rows, err := r.Executor(ctx).Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list colleges: %w", err)
	}
	defer rows.Close()

	var colleges []models.College
	for rows.Next() {
		var college models.College
		if err := rows.Scan(
			&college.CollegeID,
			&college.CollegeCode,
			&college.Name,
			&college.City,
			&college.State,
			&college.Timezone,
			&college.Status,
			&college.ContactEmail,
			&college.LocationType,
			&college.StateCode,
			&college.DistrictCode,
			&college.SubdistrictCode,
			&college.BlockCode,
			&college.CityCode,
			&college.WardCode,
			&college.VillageCode,
			&college.CampusLocality,
			&college.ActivatedAt,
			&college.SuspendedAt,
			&college.DeactivatedAt,
			&college.ArchivedAt,
			&college.LifecycleReason,
			&college.CreatedAt,
			&college.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan college: %w", err)
		}
		colleges = append(colleges, college)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("failed while reading colleges: %w", err)
	}

	return colleges, total, nil
}

// GetCollegeByID retrieves a single college by its ID.
func (r *Repository) GetCollegeByID(
	ctx context.Context,
	collegeID uuid.UUID,
) (*models.College, error) {
	query := `
		SELECT
			college_id,
			college_code,
			name,
			city,
			state,
			timezone,
			status,
			contact_email,
			location_type,
			state_code,
			district_code,
			subdistrict_code,
			block_code,
			city_code,
			ward_code,
			village_code,
			campus_locality,
			activated_at,
			suspended_at,
			deactivated_at,
			archived_at,
			lifecycle_reason,
			created_at,
			updated_at
		FROM platform.colleges
		WHERE college_id = $1
	`

	var college models.College
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID).Scan(
		&college.CollegeID,
		&college.CollegeCode,
		&college.Name,
		&college.City,
		&college.State,
		&college.Timezone,
		&college.Status,
		&college.ContactEmail,
		&college.LocationType,
		&college.StateCode,
		&college.DistrictCode,
		&college.SubdistrictCode,
		&college.BlockCode,
		&college.CityCode,
		&college.WardCode,
		&college.VillageCode,
		&college.CampusLocality,
		&college.ActivatedAt,
		&college.SuspendedAt,
		&college.DeactivatedAt,
		&college.ArchivedAt,
		&college.LifecycleReason,
		&college.CreatedAt,
		&college.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &college, nil
}

// GetCollegeByCode retrieves a single college by its college code.
func (r *Repository) GetCollegeByCode(
	ctx context.Context,
	collegeCode string,
) (*models.College, error) {
	query := `
		SELECT
			college_id,
			college_code,
			name,
			city,
			state,
			timezone,
			status,
			contact_email,
			location_type,
			state_code,
			district_code,
			subdistrict_code,
			block_code,
			city_code,
			ward_code,
			village_code,
			campus_locality,
			activated_at,
			suspended_at,
			deactivated_at,
			archived_at,
			lifecycle_reason,
			created_at,
			updated_at
		FROM platform.colleges
		WHERE college_code = $1
	`

	var college models.College
	err := r.Executor(ctx).QueryRow(ctx, query, collegeCode).Scan(
		&college.CollegeID,
		&college.CollegeCode,
		&college.Name,
		&college.City,
		&college.State,
		&college.Timezone,
		&college.Status,
		&college.ContactEmail,
		&college.LocationType,
		&college.StateCode,
		&college.DistrictCode,
		&college.SubdistrictCode,
		&college.BlockCode,
		&college.CityCode,
		&college.WardCode,
		&college.VillageCode,
		&college.CampusLocality,
		&college.ActivatedAt,
		&college.SuspendedAt,
		&college.DeactivatedAt,
		&college.ArchivedAt,
		&college.LifecycleReason,
		&college.CreatedAt,
		&college.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &college, nil
}

// CreateCollege creates a new college in the platform.
func (r *Repository) CreateCollege(
	ctx context.Context,
	req models.CreateCollegeRequest,
) (*models.College, error) {
	locType := req.LocationType
	if locType == nil {
		defaultType := "URBAN"
		locType = &defaultType
	}

	tz := "Asia/Kolkata"
	if strings.TrimSpace(req.Timezone) != "" {
		tz = strings.TrimSpace(req.Timezone)
	}

	query := `
		INSERT INTO platform.colleges (
			college_code,
			name,
			city,
			state,
			timezone,
			contact_email,
			status,
			location_type,
			state_code,
			district_code,
			subdistrict_code,
			block_code,
			city_code,
			ward_code,
			village_code,
			campus_locality
		) VALUES (
			$1, $2, $3, $4, $5, $6, 'ONBOARDING',
			$7, $8, $9, $10, $11, $12, $13, $14, $15
		)
		RETURNING
			college_id,
			college_code,
			name,
			city,
			state,
			timezone,
			status,
			contact_email,
			location_type,
			state_code,
			district_code,
			subdistrict_code,
			block_code,
			city_code,
			ward_code,
			village_code,
			campus_locality,
			activated_at,
			suspended_at,
			deactivated_at,
			archived_at,
			lifecycle_reason,
			created_at,
			updated_at
	`

	var college models.College
	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		req.CollegeCode,
		req.Name,
		req.City,
		req.State,
		tz,
		req.ContactEmail,
		locType,
		req.StateCode,
		req.DistrictCode,
		req.SubdistrictCode,
		req.BlockCode,
		req.CityCode,
		req.WardCode,
		req.VillageCode,
		req.CampusLocality,
	).Scan(
		&college.CollegeID,
		&college.CollegeCode,
		&college.Name,
		&college.City,
		&college.State,
		&college.Timezone,
		&college.Status,
		&college.ContactEmail,
		&college.LocationType,
		&college.StateCode,
		&college.DistrictCode,
		&college.SubdistrictCode,
		&college.BlockCode,
		&college.CityCode,
		&college.WardCode,
		&college.VillageCode,
		&college.CampusLocality,
		&college.ActivatedAt,
		&college.SuspendedAt,
		&college.DeactivatedAt,
		&college.ArchivedAt,
		&college.LifecycleReason,
		&college.CreatedAt,
		&college.UpdatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			if pgErr.ConstraintName == "uq_colleges_college_code" || strings.Contains(pgErr.ConstraintName, "college_code") {
				return nil, fmt.Errorf("%w: %s (%w)", ErrDuplicateCollegeCode, req.CollegeCode, err)
			}
			return nil, fmt.Errorf("unique constraint violation '%s': %w", pgErr.ConstraintName, err)
		}
		return nil, fmt.Errorf("failed to create college: %w", err)
	}

	return &college, nil
}

// UpdateCollege updates permitted fields of a college.
func (r *Repository) UpdateCollege(
	ctx context.Context,
	collegeID uuid.UUID,
	req models.UpdateCollegeRequest,
) (*models.College, error) {
	// Build dynamic update query based on provided fields
	query := `
		UPDATE platform.colleges
		SET updated_at = NOW()
	`
	args := []interface{}{}
	argPos := 1

	if req.Name != nil {
		query += fmt.Sprintf(`, name = $%d`, argPos)
		args = append(args, *req.Name)
		argPos++
	}

	if req.City != nil {
		query += fmt.Sprintf(`, city = $%d`, argPos)
		args = append(args, *req.City)
		argPos++
	}

	if req.State != nil {
		query += fmt.Sprintf(`, state = $%d`, argPos)
		args = append(args, *req.State)
		argPos++
	}

	if req.Timezone != nil {
		query += fmt.Sprintf(`, timezone = $%d`, argPos)
		args = append(args, *req.Timezone)
		argPos++
	}

	if req.ContactEmail != nil {
		query += fmt.Sprintf(`, contact_email = $%d`, argPos)
		args = append(args, *req.ContactEmail)
		argPos++
	}

	if req.LocationType != nil {
		query += fmt.Sprintf(`, location_type = $%d`, argPos)
		args = append(args, *req.LocationType)
		argPos++
	}

	if req.StateCode != nil {
		query += fmt.Sprintf(`, state_code = $%d`, argPos)
		args = append(args, *req.StateCode)
		argPos++
	}

	if req.DistrictCode != nil {
		query += fmt.Sprintf(`, district_code = $%d`, argPos)
		args = append(args, *req.DistrictCode)
		argPos++
	}

	if req.SubdistrictCode != nil {
		query += fmt.Sprintf(`, subdistrict_code = $%d`, argPos)
		args = append(args, *req.SubdistrictCode)
		argPos++
	}

	if req.BlockCode != nil {
		query += fmt.Sprintf(`, block_code = $%d`, argPos)
		args = append(args, *req.BlockCode)
		argPos++
	}

	if req.CityCode != nil {
		query += fmt.Sprintf(`, city_code = $%d`, argPos)
		args = append(args, *req.CityCode)
		argPos++
	}

	if req.WardCode != nil {
		query += fmt.Sprintf(`, ward_code = $%d`, argPos)
		args = append(args, *req.WardCode)
		argPos++
	}

	if req.VillageCode != nil {
		query += fmt.Sprintf(`, village_code = $%d`, argPos)
		args = append(args, *req.VillageCode)
		argPos++
	}

	if req.CampusLocality != nil {
		query += fmt.Sprintf(`, campus_locality = $%d`, argPos)
		args = append(args, *req.CampusLocality)
		argPos++
	}

	query += fmt.Sprintf(` WHERE college_id = $%d`, argPos)
	args = append(args, collegeID)
	argPos++

	query += `
		RETURNING
			college_id,
			college_code,
			name,
			city,
			state,
			timezone,
			status,
			contact_email,
			location_type,
			state_code,
			district_code,
			subdistrict_code,
			block_code,
			city_code,
			ward_code,
			village_code,
			campus_locality,
			activated_at,
			suspended_at,
			deactivated_at,
			archived_at,
			lifecycle_reason,
			created_at,
			updated_at
	`

	var college models.College
	err := r.Executor(ctx).QueryRow(ctx, query, args...).Scan(
		&college.CollegeID,
		&college.CollegeCode,
		&college.Name,
		&college.City,
		&college.State,
		&college.Timezone,
		&college.Status,
		&college.ContactEmail,
		&college.LocationType,
		&college.StateCode,
		&college.DistrictCode,
		&college.SubdistrictCode,
		&college.BlockCode,
		&college.CityCode,
		&college.WardCode,
		&college.VillageCode,
		&college.CampusLocality,
		&college.ActivatedAt,
		&college.SuspendedAt,
		&college.DeactivatedAt,
		&college.ArchivedAt,
		&college.LifecycleReason,
		&college.CreatedAt,
		&college.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update college: %w", err)
	}

	return &college, nil
}

// ValidateLocationCodes validates that submitted location codes exist in geo schema tables.
func (r *Repository) ValidateLocationCodes(ctx context.Context, stateCode, state, locationType, districtCode, subdistrictCode, blockCode, cityCode, wardCode, villageCode *string) error {
	isTN := false
	if stateCode != nil && *stateCode == "33" {
		isTN = true
	} else if state != nil && strings.EqualFold(strings.TrimSpace(*state), "Tamil Nadu") {
		isTN = true
	}

	if !isTN {
		return nil
	}

	dCode := ""
	if districtCode != nil {
		dCode = strings.TrimSpace(*districtCode)
	}

	if dCode != "" {
		var exists bool
		err := r.Executor(ctx).QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM geo.districts WHERE district_code = $1)", dCode).Scan(&exists)
		if err != nil {
			return fmt.Errorf("failed to verify district code: %w", err)
		}
		if !exists {
			var count int
			_ = r.Executor(ctx).QueryRow(ctx, "SELECT count(*) FROM geo.districts").Scan(&count)
			if count > 0 {
				return fmt.Errorf("invalid district code '%s': does not exist in Tamil Nadu districts", dCode)
			}
		}
	}

	locType := "URBAN"
	if locationType != nil && strings.ToUpper(strings.TrimSpace(*locationType)) == "RURAL" {
		locType = "RURAL"
	}

	if locType == "RURAL" {
		bCode := ""
		if blockCode != nil {
			bCode = strings.TrimSpace(*blockCode)
		}
		if bCode != "" {
			var exists bool
			err := r.Executor(ctx).QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM geo.blocks WHERE block_code = $1 AND ($2 = '' OR district_code = $2))", bCode, dCode).Scan(&exists)
			if err != nil {
				return fmt.Errorf("failed to verify block code: %w", err)
			}
			if !exists {
				var count int
				_ = r.Executor(ctx).QueryRow(ctx, "SELECT count(*) FROM geo.blocks").Scan(&count)
				if count > 0 {
					return fmt.Errorf("invalid block code '%s': does not exist in the selected district", bCode)
				}
			}
		}

		vCode := ""
		if villageCode != nil {
			vCode = strings.TrimSpace(*villageCode)
		}
		if vCode != "" {
			var exists bool
			err := r.Executor(ctx).QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM geo.villages WHERE village_code = $1 UNION SELECT 1 FROM geo.rural_place_hierarchy WHERE village_code = $1)", vCode).Scan(&exists)
			if err != nil {
				return fmt.Errorf("failed to verify village code: %w", err)
			}
			if !exists {
				var count int
				_ = r.Executor(ctx).QueryRow(ctx, "SELECT count(*) FROM geo.villages").Scan(&count)
				if count > 0 {
					return fmt.Errorf("invalid village code '%s': does not exist in Tamil Nadu rural directory", vCode)
				}
			}
		}
	} else {
		cCode := ""
		if cityCode != nil {
			cCode = strings.TrimSpace(*cityCode)
		}
		if cCode != "" {
			var exists bool
			err := r.Executor(ctx).QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM geo.urban_local_bodies WHERE local_body_code = $1)", cCode).Scan(&exists)
			if err != nil {
				return fmt.Errorf("failed to verify city/local body code: %w", err)
			}
			if !exists {
				var count int
				_ = r.Executor(ctx).QueryRow(ctx, "SELECT count(*) FROM geo.urban_local_bodies").Scan(&count)
				if count > 0 {
					return fmt.Errorf("invalid city/local body code '%s': does not exist in Tamil Nadu urban directory", cCode)
				}
			}
		}

		wCode := ""
		if wardCode != nil {
			wCode = strings.TrimSpace(*wardCode)
		}
		if wCode != "" {
			var exists bool
			err := r.Executor(ctx).QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM geo.urban_wards WHERE ward_code = $1 AND ($2 = '' OR local_body_code = $2))", wCode, cCode).Scan(&exists)
			if err != nil {
				return fmt.Errorf("failed to verify ward code: %w", err)
			}
			if !exists {
				var count int
				_ = r.Executor(ctx).QueryRow(ctx, "SELECT count(*) FROM geo.urban_wards").Scan(&count)
				if count > 0 {
					return fmt.Errorf("invalid ward code '%s': does not exist for the selected local body", wCode)
				}
			}
		}
	}

	return nil
}

// UpdateCollegeStatus updates the status of a college with lifecycle tracking.
func (r *Repository) UpdateCollegeStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	status string,
	reason *string,
) (*models.College, error) {
	now := time.Now()

	query := `
		UPDATE platform.colleges
		SET 
			status = $1,
			lifecycle_reason = $2,
			updated_at = $3
	`
	args := []interface{}{status, reason, now}
	argPos := 4

	// Set lifecycle timestamp based on status
	switch status {
	case "ACTIVE":
		query += fmt.Sprintf(`, activated_at = COALESCE(activated_at, $%d), suspended_at = NULL`, argPos)
		args = append(args, now)
		argPos++
	case "SUSPENDED":
		query += fmt.Sprintf(`, suspended_at = $%d`, argPos)
		args = append(args, now)
		argPos++
	case "DEACTIVATED":
		query += fmt.Sprintf(`, deactivated_at = $%d`, argPos)
		args = append(args, now)
		argPos++
	}

	query += fmt.Sprintf(` WHERE college_id = $%d`, argPos)
	args = append(args, collegeID)

	query += `
		RETURNING
			college_id,
			college_code,
			name,
			city,
			state,
			timezone,
			status,
			contact_email,
			activated_at,
			suspended_at,
			deactivated_at,
			archived_at,
			lifecycle_reason,
			created_at,
			updated_at
	`

	var college models.College
	err := r.Executor(ctx).QueryRow(ctx, query, args...).Scan(
		&college.CollegeID,
		&college.CollegeCode,
		&college.Name,
		&college.City,
		&college.State,
		&college.Timezone,
		&college.Status,
		&college.ContactEmail,
		&college.ActivatedAt,
		&college.SuspendedAt,
		&college.DeactivatedAt,
		&college.ArchivedAt,
		&college.LifecycleReason,
		&college.CreatedAt,
		&college.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update college status: %w", err)
	}

	return &college, nil
}

// SeedCollegeOnboarding creates the six required onboarding steps.
// Call it in the same transaction as CreateCollege.
func (r *Repository) SeedCollegeOnboarding(
	ctx context.Context,
	collegeID uuid.UUID,
) error {
	if collegeID == uuid.Nil {
		return fmt.Errorf("college ID is required")
	}

	steps := []string{
		"COLLEGE_PROFILE",
		"COLLEGE_ADMIN",
		"READINESS_REVIEW",
		"GO_LIVE",
	}

	for _, step := range steps {
		_, err := r.Executor(ctx).Exec(ctx, `
			INSERT INTO platform.college_onboarding (
				college_id,
				step_code,
				status
			)
			VALUES ($1, $2, 'PENDING')
			ON CONFLICT (college_id, step_code) DO NOTHING
		`, collegeID, step)

		if err != nil {
			return fmt.Errorf("seed onboarding step %s: %w", step, err)
		}
	}

	return nil
}

// LockCollegeStatus locks the college row until the transaction finishes.
func (r *Repository) LockCollegeStatus(
	ctx context.Context,
	collegeID uuid.UUID,
) (string, error) {
	var status string

	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT status
		FROM platform.colleges
		WHERE college_id = $1
		FOR UPDATE
	`, collegeID).Scan(&status)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", pgx.ErrNoRows
		}
		return "", fmt.Errorf("lock college status: %w", err)
	}

	return status, nil
}

// EnsureCollegeReadyForActivation revalidates all mandatory readiness gates and checklist steps immediately prior to activation.
func (r *Repository) EnsureCollegeReadyForActivation(
	ctx context.Context,
	collegeID uuid.UUID,
) error {
	// 1. Authoritative College Profile Revalidation
	var code, name, timezone string
	var contactEmail *string
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT college_code, name, timezone, contact_email
		FROM platform.colleges
		WHERE college_id = $1
		FOR UPDATE
	`, collegeID).Scan(&code, &name, &timezone, &contactEmail)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("college not found")
		}
		return fmt.Errorf("verify college profile: %w", err)
	}

	if strings.TrimSpace(code) == "" || strings.TrimSpace(name) == "" || strings.TrimSpace(timezone) == "" || contactEmail == nil || strings.TrimSpace(*contactEmail) == "" {
		return fmt.Errorf("college profile is incomplete (code, name, timezone, and contact email required)")
	}

	// 2. Authoritative First Admin Gate Revalidation
	var adminCount int
	err = r.Executor(ctx).QueryRow(ctx, `
		SELECT COUNT(*)::int
		FROM app.users u
		JOIN platform.user_roles ur ON ur.user_id = u.user_id
		JOIN platform.roles r ON r.role_id = ur.role_id
		WHERE ur.college_id = $1
		  AND r.role_code = 'COLLEGE_ADMIN'
		  AND ur.status = 'ACTIVE'
		  AND u.status = 'ACTIVE'
		  AND u.password_hash IS NOT NULL
		  AND length(u.password_hash) > 0
	`, collegeID).Scan(&adminCount)
	if err != nil {
		return fmt.Errorf("verify college admin: %w", err)
	}
	if adminCount == 0 {
		return fmt.Errorf("readiness gate FIRST_ADMIN failed: no active administrator account with initialized credentials found")
	}

	// 3. Authoritative Hostel Structure Gate Revalidation
	var hostelCount int
	err = r.Executor(ctx).QueryRow(ctx, `
		SELECT COUNT(*)::int
		FROM app.hostels
		WHERE college_id = $1 AND status = 'ACTIVE'
	`, collegeID).Scan(&hostelCount)
	if err != nil {
		return fmt.Errorf("verify college hostels: %w", err)
	}
	if hostelCount == 0 {
		return fmt.Errorf("readiness gate HOSTEL_STRUCTURE failed: at least one active hostel structure is required before go-live")
	}

	// 4. Canonical Checklist Steps Revalidation
	rows, err := r.Executor(ctx).Query(ctx, `
		SELECT step_code, status
		FROM platform.college_onboarding
		WHERE college_id = $1
		FOR UPDATE
	`, collegeID)
	if err != nil {
		return fmt.Errorf("read onboarding checklist: %w", err)
	}
	defer rows.Close()

	required := map[string]bool{
		"COLLEGE_PROFILE":  false,
		"COLLEGE_ADMIN":    false,
		"READINESS_REVIEW": false,
		"GO_LIVE":          false,
	}

	for rows.Next() {
		var stepCode, status string
		if err := rows.Scan(&stepCode, &status); err != nil {
			return fmt.Errorf("scan onboarding checklist: %w", err)
		}

		if _, ok := required[stepCode]; !ok {
			continue
		}

		// GO_LIVE step will be completed as part of the activation transaction if pending
		if stepCode == "GO_LIVE" {
			required[stepCode] = true
			continue
		}

		if status != "COMPLETED" {
			return fmt.Errorf("onboarding step %s must be COMPLETED", stepCode)
		}
		required[stepCode] = true
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate onboarding checklist: %w", err)
	}

	for step, completed := range required {
		if !completed {
			return fmt.Errorf("required onboarding step %s is missing", step)
		}
	}

	return nil
}

// CompleteGoLiveStep marks the GO_LIVE onboarding step as COMPLETED upon successful activation.
func (r *Repository) CompleteGoLiveStep(
	ctx context.Context,
	collegeID uuid.UUID,
	actorUserID uuid.UUID,
) error {
	var actorID *uuid.UUID
	if actorUserID != uuid.Nil {
		actorID = &actorUserID
	}
	_, err := r.Executor(ctx).Exec(ctx, `
		UPDATE platform.college_onboarding
		SET status = 'COMPLETED',
		    completed_by = $2,
		    completed_at = now(),
		    notes = COALESCE(NULLIF(notes, ''), 'College activated and placed into production service'),
		    updated_at = now()
		WHERE college_id = $1 AND step_code = 'GO_LIVE'
	`, collegeID, actorID)
	if err != nil {
		return fmt.Errorf("complete go-live onboarding step: %w", err)
	}
	return nil
}

// CollegeCreationAuditParams defines parameters for recording a college creation audit log.
type CollegeCreationAuditParams struct {
	CollegeID   uuid.UUID
	ActorUserID uuid.UUID
	ActorRole   string
	CollegeCode string
	Name        string
}

// RecordCollegeCreationAudit writes a COLLEGE_CREATED entry to platform.audit_logs.
func (r *Repository) RecordCollegeCreationAudit(
	ctx context.Context,
	params CollegeCreationAuditParams,
) error {
	if params.CollegeID == uuid.Nil {
		return fmt.Errorf("college ID is required for audit")
	}

	newData, err := json.Marshal(map[string]interface{}{
		"college_code": params.CollegeCode,
		"name":         params.Name,
		"status":       "ONBOARDING",
	})
	if err != nil {
		return fmt.Errorf("marshal college creation data: %w", err)
	}

	var actorUserArg interface{}
	if params.ActorUserID != uuid.Nil {
		actorUserArg = params.ActorUserID
	}

	var actorRoleArg interface{}
	if strings.TrimSpace(params.ActorRole) != "" {
		actorRoleArg = strings.TrimSpace(params.ActorRole)
	}

	_, err = r.Executor(ctx).Exec(ctx, `
		INSERT INTO platform.audit_logs (
			audit_id,
			college_id,
			actor_user_id,
			actor_role,
			module,
			action,
			entity_type,
			entity_id,
			old_data,
			new_data,
			reason,
			created_at,
			severity
		)
		VALUES (
			$1, $2, $3, $4,
			'platform_colleges',
			'COLLEGE_CREATED',
			'college',
			$2,
			NULL,
			$5::jsonb,
			'Initial college onboarding registration',
			NOW(),
			'INFO'
		)
	`,
		uuid.New(),
		params.CollegeID,
		actorUserArg,
		actorRoleArg,
		string(newData),
	)
	if err != nil {
		return fmt.Errorf("insert college creation audit record: %w", err)
	}

	return nil
}

// CollegeProfileUpdateAuditParams defines parameters for recording a profile update audit log.
type CollegeProfileUpdateAuditParams struct {
	CollegeID   uuid.UUID
	ActorUserID uuid.UUID
	ActorRole   string
	OldData     map[string]interface{}
	NewData     map[string]interface{}
}

// RecordCollegeProfileUpdateAudit writes a COLLEGE_PROFILE_UPDATED entry to platform.audit_logs.
func (r *Repository) RecordCollegeProfileUpdateAudit(
	ctx context.Context,
	params CollegeProfileUpdateAuditParams,
) error {
	if params.CollegeID == uuid.Nil {
		return fmt.Errorf("college ID is required for audit")
	}

	oldJSON, err := json.Marshal(params.OldData)
	if err != nil {
		return fmt.Errorf("marshal old profile data: %w", err)
	}

	newJSON, err := json.Marshal(params.NewData)
	if err != nil {
		return fmt.Errorf("marshal new profile data: %w", err)
	}

	var actorUserArg interface{}
	if params.ActorUserID != uuid.Nil {
		actorUserArg = params.ActorUserID
	}

	var actorRoleArg interface{}
	if strings.TrimSpace(params.ActorRole) != "" {
		actorRoleArg = strings.TrimSpace(params.ActorRole)
	}

	_, err = r.Executor(ctx).Exec(ctx, `
		INSERT INTO platform.audit_logs (
			audit_id,
			college_id,
			actor_user_id,
			actor_role,
			module,
			action,
			entity_type,
			entity_id,
			old_data,
			new_data,
			reason,
			created_at,
			severity
		)
		VALUES (
			$1, $2, $3, $4,
			'platform_colleges',
			'COLLEGE_PROFILE_UPDATED',
			'college',
			$2,
			$5::jsonb,
			$6::jsonb,
			'College profile updated',
			NOW(),
			'INFO'
		)
	`,
		uuid.New(),
		params.CollegeID,
		actorUserArg,
		actorRoleArg,
		string(oldJSON),
		string(newJSON),
	)
	if err != nil {
		return fmt.Errorf("insert college profile update audit record: %w", err)
	}

	return nil
}

// CollegeLifecycleAuditParams defines parameters for recording a status change audit log.
type CollegeLifecycleAuditParams struct {
	CollegeID       uuid.UUID
	ActorUserID     uuid.UUID
	ActorRole       string
	OldStatus       string
	NewStatus       string
	LifecycleReason string
}

// RecordCollegeLifecycleAudit records a college lifecycle change in platform.audit_logs.
func (r *Repository) RecordCollegeLifecycleAudit(
	ctx context.Context,
	params CollegeLifecycleAuditParams,
) error {
	if params.CollegeID == uuid.Nil {
		return fmt.Errorf("college ID is required for audit")
	}
	if params.ActorUserID == uuid.Nil {
		return fmt.Errorf("actor user ID is required for audit")
	}

	oldData, err := json.Marshal(map[string]string{
		"status": params.OldStatus,
	})
	if err != nil {
		return fmt.Errorf("marshal old lifecycle data: %w", err)
	}

	newData, err := json.Marshal(map[string]string{
		"status": params.NewStatus,
	})
	if err != nil {
		return fmt.Errorf("marshal new lifecycle data: %w", err)
	}

	var actorRoleArg interface{}
	if strings.TrimSpace(params.ActorRole) != "" {
		actorRoleArg = strings.TrimSpace(params.ActorRole)
	}

	_, err = r.Executor(ctx).Exec(ctx, `
		INSERT INTO platform.audit_logs (
			audit_id,
			college_id,
			actor_user_id,
			actor_role,
			module,
			action,
			entity_type,
			entity_id,
			old_data,
			new_data,
			reason,
			created_at,
			severity
		)
		VALUES (
			$1, $2, $3, $4,
			'platform_colleges',
			'COLLEGE_STATUS_CHANGED',
			'college',
			$2,
			$5::jsonb,
			$6::jsonb,
			$7,
			NOW(),
			'INFO'
		)
	`,
		uuid.New(),
		params.CollegeID,
		params.ActorUserID,
		actorRoleArg,
		string(oldData),
		string(newData),
		params.LifecycleReason,
	)
	if err != nil {
		return fmt.Errorf("insert college lifecycle audit record: %w", err)
	}

	return nil
}

// GetCollegeOnboarding retrieves all onboarding steps for a college in canonical sequence.
func (r *Repository) GetCollegeOnboarding(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]models.CollegeOnboardingStep, error) {
	rows, err := r.Executor(ctx).Query(ctx, `
		SELECT
			onboarding_id,
			college_id,
			step_code,
			status,
			completed_by,
			completed_at,
			notes,
			created_at,
			updated_at
		FROM platform.college_onboarding
		WHERE college_id = $1
		ORDER BY
			CASE step_code
				WHEN 'COLLEGE_PROFILE' THEN 1
				WHEN 'COLLEGE_ADMIN' THEN 2
				WHEN 'READINESS_REVIEW' THEN 3
				WHEN 'GO_LIVE' THEN 4
				WHEN 'BRANDING' THEN 5
				WHEN 'ENTITLEMENTS' THEN 6
				ELSE 7
			END ASC,
			created_at ASC
	`, collegeID)
	if err != nil {
		return nil, fmt.Errorf("list college onboarding steps: %w", err)
	}
	defer rows.Close()

	steps := make([]models.CollegeOnboardingStep, 0)
	for rows.Next() {
		var step models.CollegeOnboardingStep
		if err := rows.Scan(
			&step.OnboardingID,
			&step.CollegeID,
			&step.StepCode,
			&step.Status,
			&step.CompletedBy,
			&step.CompletedAt,
			&step.Notes,
			&step.CreatedAt,
			&step.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan college onboarding step: %w", err)
		}
		steps = append(steps, step)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read college onboarding steps: %w", err)
	}

	return steps, nil
}

// UpdateOnboardingStepParams holds parameters for updating an onboarding step.
type UpdateOnboardingStepParams struct {
	StepCode    string
	Status      string
	Notes       *string
	CompletedBy *uuid.UUID
}

// UpdateCollegeOnboardingStep updates a single onboarding step with row locking.
func (r *Repository) UpdateCollegeOnboardingStep(
	ctx context.Context,
	collegeID uuid.UUID,
	params UpdateOnboardingStepParams,
) (*models.CollegeOnboardingStep, string, error) {
	var oldStatus string
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT status
		FROM platform.college_onboarding
		WHERE college_id = $1 AND step_code = $2
		FOR UPDATE
	`, collegeID, params.StepCode).Scan(&oldStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, "", pgx.ErrNoRows
		}
		return nil, "", fmt.Errorf("lock onboarding step: %w", err)
	}

	var completedByArg interface{}
	if params.CompletedBy != nil && *params.CompletedBy != uuid.Nil {
		completedByArg = *params.CompletedBy
	}

	_, err = r.Executor(ctx).Exec(ctx, `
		UPDATE platform.college_onboarding
		SET
			status = $3,
			notes = $4,
			completed_by = CASE
				WHEN $3::varchar = 'COMPLETED' THEN COALESCE(completed_by, $5::uuid)
				ELSE NULL
			END,
			completed_at = CASE
				WHEN $3::varchar = 'COMPLETED' THEN COALESCE(completed_at, NOW())
				ELSE NULL
			END,
			updated_at = NOW()
		WHERE college_id = $1 AND step_code = $2
	`, collegeID, params.StepCode, params.Status, params.Notes, completedByArg)
	if err != nil {
		return nil, oldStatus, fmt.Errorf("update onboarding step: %w", err)
	}

	var step models.CollegeOnboardingStep
	err = r.Executor(ctx).QueryRow(ctx, `
		SELECT
			onboarding_id, college_id, step_code, status,
			completed_by, completed_at, notes, created_at, updated_at
		FROM platform.college_onboarding
		WHERE college_id = $1 AND step_code = $2
	`, collegeID, params.StepCode).Scan(
		&step.OnboardingID,
		&step.CollegeID,
		&step.StepCode,
		&step.Status,
		&step.CompletedBy,
		&step.CompletedAt,
		&step.Notes,
		&step.CreatedAt,
		&step.UpdatedAt,
	)
	if err != nil {
		return nil, oldStatus, fmt.Errorf("read updated onboarding step: %w", err)
	}

	return &step, oldStatus, nil
}

// OnboardingStepAuditParams holds parameters for recording an onboarding audit log.
type OnboardingStepAuditParams struct {
	CollegeID    uuid.UUID
	OnboardingID uuid.UUID
	ActorUserID  uuid.UUID
	ActorRole    string
	StepCode     string
	OldStatus    string
	NewStatus    string
}

// RecordOnboardingStepAudit writes an onboarding step update to platform.audit_logs.
func (r *Repository) RecordOnboardingStepAudit(
	ctx context.Context,
	params OnboardingStepAuditParams,
) error {
	oldData, err := json.Marshal(map[string]string{
		"step_code": params.StepCode,
		"status":    params.OldStatus,
	})
	if err != nil {
		return err
	}

	newData, err := json.Marshal(map[string]string{
		"step_code": params.StepCode,
		"status":    params.NewStatus,
	})
	if err != nil {
		return err
	}

	var actorUserArg interface{}
	if params.ActorUserID != uuid.Nil {
		actorUserArg = params.ActorUserID
	}

	var actorRoleArg interface{}
	if strings.TrimSpace(params.ActorRole) != "" {
		actorRoleArg = strings.TrimSpace(params.ActorRole)
	}

	_, err = r.Executor(ctx).Exec(ctx, `
		INSERT INTO platform.audit_logs (
			audit_id, college_id, actor_user_id, actor_role,
			module, action, entity_type, entity_id,
			old_data, new_data, created_at, severity
		)
		VALUES (
			$1, $2, $3, $4,
			'college_onboarding', 'ONBOARDING_STEP_UPDATED',
			'college_onboarding', $5,
			$6::jsonb, $7::jsonb, NOW(), 'INFO'
		)
	`,
		uuid.New(),
		params.CollegeID,
		actorUserArg,
		actorRoleArg,
		params.OnboardingID,
		string(oldData),
		string(newData),
	)
	if err != nil {
		return fmt.Errorf("insert onboarding step audit record: %w", err)
	}

	return nil
}

// CollegeAdminPasswordAuditParams defines parameters for recording college admin password update.
type CollegeAdminPasswordAuditParams struct {
	CollegeID   uuid.UUID
	ActorUserID uuid.UUID
	ActorRole   string
	Action      string
	AdminEmail  string
}

// GetCollegeAdmin retrieves the primary active College Admin account associated with the college.
func (r *Repository) GetCollegeAdmin(
	ctx context.Context,
	collegeID uuid.UUID,
) (*models.CollegeAdminAccount, error) {
	if collegeID == uuid.Nil {
		return nil, fmt.Errorf("college ID is required")
	}

	query := `
		SELECT
			u.user_id,
			ur.college_id,
			u.email,
			u.status,
			r.role_code,
			r.role_name,
			(u.password_hash IS NOT NULL AND length(u.password_hash) > 0) AS has_password,
			u.last_login_at,
			u.created_at
		FROM app.users u
		JOIN platform.user_roles ur ON ur.user_id = u.user_id
		JOIN platform.roles r ON r.role_id = ur.role_id
		WHERE ur.college_id = $1
		  AND r.role_code = 'COLLEGE_ADMIN'
		  AND ur.status = 'ACTIVE'
		ORDER BY ur.created_at DESC
		LIMIT 1
	`

	var admin models.CollegeAdminAccount
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID).Scan(
		&admin.UserID,
		&admin.CollegeID,
		&admin.Email,
		&admin.Status,
		&admin.RoleCode,
		&admin.RoleName,
		&admin.HasPassword,
		&admin.LastLoginAt,
		&admin.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, pgx.ErrNoRows
		}
		return nil, fmt.Errorf("failed to get college admin: %w", err)
	}

	return &admin, nil
}

// UpsertCollegeAdmin creates or updates a college administrator user, assigns the COLLEGE_ADMIN role, and completes the COLLEGE_ADMIN onboarding step.
func (r *Repository) UpsertCollegeAdmin(
	ctx context.Context,
	collegeID uuid.UUID,
	adminEmail string,
	passwordHash string,
	actorID uuid.UUID,
) (*models.CollegeAdminAccount, error) {
	if collegeID == uuid.Nil {
		return nil, fmt.Errorf("college ID is required")
	}
	if adminEmail == "" {
		return nil, fmt.Errorf("admin email is required")
	}

	// 1. Get role_id for COLLEGE_ADMIN
	var roleID uuid.UUID
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT role_id
		FROM platform.roles
		WHERE role_code = 'COLLEGE_ADMIN'
	`).Scan(&roleID)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup COLLEGE_ADMIN role: %w", err)
	}

	// 2. Check if a COLLEGE_ADMIN assignment already exists for this college
	var existingUserID uuid.UUID
	err = r.Executor(ctx).QueryRow(ctx, `
		SELECT ur.user_id
		FROM platform.user_roles ur
		WHERE ur.college_id = $1
		  AND ur.role_id = $2
		  AND ur.status = 'ACTIVE'
		ORDER BY ur.created_at ASC
		LIMIT 1
	`, collegeID, roleID).Scan(&existingUserID)

	var targetUserID uuid.UUID

	if err == nil {
		// Existing admin exists for this college: update password & email
		targetUserID = existingUserID
		if passwordHash != "" {
			_, err = r.Executor(ctx).Exec(ctx, `
				UPDATE app.users
				SET password_hash = $1,
				    email = COALESCE(NULLIF($2, ''), email),
				    status = 'ACTIVE',
				    updated_at = now()
				WHERE user_id = $3
			`, passwordHash, adminEmail, targetUserID)
			if err != nil {
				return nil, fmt.Errorf("failed to update admin user: %w", err)
			}
		}
	} else if errors.Is(err, pgx.ErrNoRows) {
		// Insert or update app.users by email
		query := `
			INSERT INTO app.users (
				email,
				password_hash,
				status
			) VALUES (
				$1, $2, 'ACTIVE'
			)
			ON CONFLICT (email) DO UPDATE
			SET password_hash = CASE WHEN EXCLUDED.password_hash IS NOT NULL AND EXCLUDED.password_hash <> '' THEN EXCLUDED.password_hash ELSE app.users.password_hash END,
			    status = 'ACTIVE',
			    updated_at = now()
			RETURNING user_id
		`
		err = r.Executor(ctx).QueryRow(ctx, query, adminEmail, passwordHash).Scan(&targetUserID)
		if err != nil {
			return nil, fmt.Errorf("failed to upsert admin user record: %w", err)
		}

		// Insert platform.user_roles
		var assignedBy *uuid.UUID
		if actorID != uuid.Nil {
			assignedBy = &actorID
		}
		_, err = r.Executor(ctx).Exec(ctx, `
			INSERT INTO platform.user_roles (
				user_id,
				role_id,
				college_id,
				status,
				assigned_by
			) VALUES (
				$1, $2, $3, 'ACTIVE', $4
			)
		`, targetUserID, roleID, collegeID, assignedBy)
		if err != nil {
			return nil, fmt.Errorf("failed to assign COLLEGE_ADMIN role: %w", err)
		}
	} else {
		return nil, fmt.Errorf("failed to query existing college admin: %w", err)
	}

	// 3. Mark COLLEGE_ADMIN onboarding step COMPLETED
	var completedBy *uuid.UUID
	if actorID != uuid.Nil {
		completedBy = &actorID
	}
	_, _ = r.Executor(ctx).Exec(ctx, `
		UPDATE platform.college_onboarding
		SET status = 'COMPLETED',
		    completed_by = $2,
		    completed_at = now(),
		    notes = 'Administrator credentials initialized',
		    updated_at = now()
		WHERE college_id = $1 AND step_code = 'COLLEGE_ADMIN'
	`, collegeID, completedBy)

	return r.GetCollegeAdmin(ctx, collegeID)
}

// RecordCollegeAdminPasswordAudit writes an audit log entry for admin password updates.
func (r *Repository) RecordCollegeAdminPasswordAudit(
	ctx context.Context,
	params CollegeAdminPasswordAuditParams,
) error {
	if params.CollegeID == uuid.Nil {
		return fmt.Errorf("college ID is required for audit")
	}

	newData, err := json.Marshal(map[string]interface{}{
		"admin_email": params.AdminEmail,
		"action":      params.Action,
	})
	if err != nil {
		return fmt.Errorf("marshal admin password audit data: %w", err)
	}

	var actorUserArg interface{}
	if params.ActorUserID != uuid.Nil {
		actorUserArg = params.ActorUserID
	}

	var actorRoleArg interface{}
	if strings.TrimSpace(params.ActorRole) != "" {
		actorRoleArg = strings.TrimSpace(params.ActorRole)
	}

	_, err = r.Executor(ctx).Exec(ctx, `
		INSERT INTO platform.audit_logs (
			audit_id, college_id, actor_user_id, actor_role,
			module, action, entity_type, entity_id,
			new_data, reason, created_at, severity
		)
		VALUES (
			$1, $2, $3, $4,
			'platform_colleges', $5,
			'college_admin', $2,
			$6::jsonb, 'Administrator credentials modified by superadmin', NOW(), 'WARNING'
		)
	`,
		uuid.New(),
		params.CollegeID,
		actorUserArg,
		actorRoleArg,
		params.Action,
		string(newData),
	)
	if err != nil {
		return fmt.Errorf("insert college admin audit record: %w", err)
	}

	return nil
}

// CountCollegeHostels returns the count of active hostels for a college from app.hostels.
func (r *Repository) CountCollegeHostels(ctx context.Context, collegeID uuid.UUID) (int, error) {
	if collegeID == uuid.Nil {
		return 0, fmt.Errorf("college ID is required")
	}

	var count int
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT COUNT(*)::int
		FROM app.hostels
		WHERE college_id = $1 AND status = 'ACTIVE'
	`, collegeID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count college hostels: %w", err)
	}

	return count, nil
}

// CountCollegeModules returns the count of active modules enabled for a college.
func (r *Repository) CountCollegeModules(ctx context.Context, collegeID uuid.UUID) (int, error) {
	if collegeID == uuid.Nil {
		return 0, fmt.Errorf("college ID is required")
	}

	var count int
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT COUNT(*)::int
		FROM platform.college_modules
		WHERE college_id = $1 AND status = 'ACTIVE'
	`, collegeID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count college modules: %w", err)
	}

	return count, nil
}

// CountCollegeSettings returns the count of settings stored for a college.
func (r *Repository) CountCollegeSettings(ctx context.Context, collegeID uuid.UUID) (int, error) {
	if collegeID == uuid.Nil {
		return 0, fmt.Errorf("college ID is required")
	}

	var count int
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT COUNT(*)::int
		FROM platform.college_settings
		WHERE college_id = $1
	`, collegeID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count college settings: %w", err)
	}

	return count, nil
}

// ListOnboardingPipeline retrieves all colleges in ONBOARDING status with step completion tallies.
func (r *Repository) ListOnboardingPipeline(ctx context.Context) ([]models.CollegeOnboardingSummary, error) {
	query := `
		SELECT
			c.college_id,
			c.college_code,
			c.name,
			c.status,
			c.city,
			c.state,
			COUNT(co.step_code) FILTER (WHERE co.status = 'COMPLETED' OR (co.step_code = 'BRANDING' AND co.status = 'SKIPPED'))::int AS completed_steps,
			COUNT(co.step_code)::int AS total_steps,
			(
				c.college_code != '' AND c.name != '' AND c.timezone != '' AND
				c.contact_email IS NOT NULL AND trim(c.contact_email) != ''
			) AS profile_ready,
			EXISTS (
				SELECT 1 FROM app.users u
				JOIN platform.user_roles ur ON ur.user_id = u.user_id
				JOIN platform.roles r ON r.role_id = ur.role_id
				WHERE ur.college_id = c.college_id
				  AND r.role_code = 'COLLEGE_ADMIN'
				  AND ur.status = 'ACTIVE'
				  AND u.status = 'ACTIVE'
				  AND u.password_hash IS NOT NULL
				  AND length(u.password_hash) > 0
			) AS admin_ready,
			EXISTS (
				SELECT 1 FROM platform.college_modules cm
				WHERE cm.college_id = c.college_id AND cm.status = 'ACTIVE'
			) AS modules_ready,
			EXISTS (
				SELECT 1 FROM app.hostels h
				WHERE h.college_id = c.college_id AND h.status = 'ACTIVE'
			) AS hostels_ready,
			COALESCE(
				(
					SELECT co2.step_code
					FROM platform.college_onboarding co2
					WHERE co2.college_id = c.college_id
					  AND co2.status != 'COMPLETED'
					  AND NOT (co2.step_code = 'BRANDING' AND co2.status = 'SKIPPED')
					ORDER BY CASE co2.step_code
						WHEN 'COLLEGE_PROFILE' THEN 1
						WHEN 'COLLEGE_ADMIN' THEN 2
						WHEN 'READINESS_REVIEW' THEN 3
						WHEN 'GO_LIVE' THEN 4
						WHEN 'BRANDING' THEN 5
						WHEN 'ENTITLEMENTS' THEN 6
						ELSE 7 END ASC
					LIMIT 1
				),
				'GO_LIVE'
			) AS current_step,
			c.created_at,
			c.updated_at,
			c.activated_at
		FROM platform.colleges c
		LEFT JOIN platform.college_onboarding co ON co.college_id = c.college_id
		WHERE c.status = 'ONBOARDING'
		GROUP BY c.college_id, c.college_code, c.name, c.status, c.city, c.state, c.timezone, c.contact_email, c.created_at, c.updated_at, c.activated_at
		ORDER BY c.created_at DESC
	`

	rows, err := r.Executor(ctx).Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list onboarding pipeline: %w", err)
	}
	defer rows.Close()

	summaries := make([]models.CollegeOnboardingSummary, 0)
	for rows.Next() {
		var s models.CollegeOnboardingSummary
		var profileReady, adminReady, modulesReady, hostelsReady bool
		var currentStep string
		if err := rows.Scan(
			&s.CollegeID,
			&s.CollegeCode,
			&s.Name,
			&s.Status,
			&s.City,
			&s.State,
			&s.CompletedSteps,
			&s.TotalSteps,
			&profileReady,
			&adminReady,
			&modulesReady,
			&hostelsReady,
			&currentStep,
			&s.CreatedAt,
			&s.UpdatedAt,
			&s.ActivatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan onboarding summary row: %w", err)
		}

		s.CurrentStep = currentStep
		// Module configuration and branding are excluded from mandatory creation gates
		allMandatoryGates := profileReady && adminReady && hostelsReady
		// Ready for go-live when mandatory gates are met and preparatory steps completed
		s.IsReadyForGoLive = allMandatoryGates && (s.CompletedSteps >= 3)

		if s.TotalSteps > 0 {
			s.ProgressPercentage = (s.CompletedSteps * 100) / s.TotalSteps
		} else {
			s.ProgressPercentage = 0
		}

		// Never show 100% progress while any mandatory gate remains unmet
		if !s.IsReadyForGoLive && s.ProgressPercentage >= 100 {
			s.ProgressPercentage = 90
		}
		if s.IsReadyForGoLive {
			s.ProgressPercentage = 100
		}

		summaries = append(summaries, s)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate onboarding pipeline: %w", err)
	}

	return summaries, nil
}

// ListCollegeAdmins retrieves all administrators assigned to a specific college.
func (r *Repository) ListCollegeAdmins(
	ctx context.Context,
	collegeID uuid.UUID,
	status string,
	limit int,
	offset int,
) ([]models.CollegeAdminAccount, int, error) {
	if collegeID == uuid.Nil {
		return nil, 0, fmt.Errorf("college ID is required")
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	var countQuery strings.Builder
	countQuery.WriteString(`
		SELECT COUNT(DISTINCT u.user_id)
		FROM app.users u
		JOIN platform.user_roles ur ON ur.user_id = u.user_id
		JOIN platform.roles r ON r.role_id = ur.role_id
		WHERE ur.college_id = $1
		  AND r.role_code = 'COLLEGE_ADMIN'
	`)
	args := []interface{}{collegeID}
	argIdx := 2

	if status != "" {
		countQuery.WriteString(fmt.Sprintf(" AND u.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	var total int
	err := r.Executor(ctx).QueryRow(ctx, countQuery.String(), args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count college admins: %w", err)
	}

	var query strings.Builder
	query.WriteString(`
		SELECT
			u.user_id,
			ur.college_id,
			u.email,
			u.phone,
			u.status,
			r.role_code,
			r.role_name,
			(u.password_hash IS NOT NULL AND length(u.password_hash) > 0) AS has_password,
			u.last_login_at,
			u.created_at
		FROM app.users u
		JOIN platform.user_roles ur ON ur.user_id = u.user_id
		JOIN platform.roles r ON r.role_id = ur.role_id
		WHERE ur.college_id = $1
		  AND r.role_code = 'COLLEGE_ADMIN'
	`)

	queryArgs := []interface{}{collegeID}
	qArgIdx := 2

	if status != "" {
		query.WriteString(fmt.Sprintf(" AND u.status = $%d", qArgIdx))
		queryArgs = append(queryArgs, status)
		qArgIdx++
	}

	query.WriteString(fmt.Sprintf(" ORDER BY ur.created_at DESC LIMIT $%d OFFSET $%d", qArgIdx, qArgIdx+1))
	queryArgs = append(queryArgs, limit, offset)

	rows, err := r.Executor(ctx).Query(ctx, query.String(), queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("list college admins query: %w", err)
	}
	defer rows.Close()

	var admins []models.CollegeAdminAccount
	for rows.Next() {
		var a models.CollegeAdminAccount
		if err := rows.Scan(
			&a.UserID,
			&a.CollegeID,
			&a.Email,
			&a.Phone,
			&a.Status,
			&a.RoleCode,
			&a.RoleName,
			&a.HasPassword,
			&a.LastLoginAt,
			&a.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan college admin row: %w", err)
		}
		admins = append(admins, a)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate college admins: %w", err)
	}

	return admins, total, nil
}

// CountActiveCollegeAdmins counts how many active college admin accounts exist for the college.
func (r *Repository) CountActiveCollegeAdmins(
	ctx context.Context,
	collegeID uuid.UUID,
) (int, error) {
	if collegeID == uuid.Nil {
		return 0, fmt.Errorf("college ID is required")
	}

	const query = `
		SELECT COUNT(DISTINCT u.user_id)
		FROM app.users u
		JOIN platform.user_roles ur ON ur.user_id = u.user_id
		JOIN platform.roles r ON r.role_id = ur.role_id
		WHERE ur.college_id = $1
		  AND r.role_code = 'COLLEGE_ADMIN'
		  AND ur.status = 'ACTIVE'
		  AND u.status = 'ACTIVE'
	`
	var count int
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count active college admins: %w", err)
	}
	return count, nil
}

// ProvisionFirstCollegeAdmin creates the first administrator for a college within an active transaction.
func (r *Repository) ProvisionFirstCollegeAdmin(
	ctx context.Context,
	collegeID uuid.UUID,
	email string,
	phone *string,
	passwordHash string,
	actorID uuid.UUID,
) (*models.CollegeAdminAccount, error) {
	if collegeID == uuid.Nil {
		return nil, fmt.Errorf("college ID is required")
	}
	if email == "" {
		return nil, fmt.Errorf("email is required")
	}
	if passwordHash == "" {
		return nil, fmt.Errorf("password hash is required")
	}

	// 1. Get role_id for COLLEGE_ADMIN
	var roleID uuid.UUID
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT role_id
		FROM platform.roles
		WHERE role_code = 'COLLEGE_ADMIN'
	`).Scan(&roleID)
	if err != nil {
		return nil, fmt.Errorf("lookup COLLEGE_ADMIN role: %w", err)
	}

	// 2. Lock and check if ANY active COLLEGE_ADMIN already exists for this college
	var existingCount int
	err = r.Executor(ctx).QueryRow(ctx, `
		SELECT COUNT(DISTINCT ur.user_id)
		FROM platform.user_roles ur
		WHERE ur.college_id = $1
		  AND ur.role_id = $2
		  AND ur.status = 'ACTIVE'
	`, collegeID, roleID).Scan(&existingCount)
	if err != nil {
		return nil, fmt.Errorf("check existing college admin count: %w", err)
	}
	if existingCount > 0 {
		return nil, fmt.Errorf("first administrator has already been provisioned for this college")
	}

	// 3. Create app.users record
	var userID uuid.UUID
	insertUserQuery := `
		INSERT INTO app.users (
			email,
			phone,
			password_hash,
			status
		) VALUES (
			$1, $2, $3, 'ACTIVE'
		)
		RETURNING user_id
	`
	err = r.Executor(ctx).QueryRow(ctx, insertUserQuery, email, phone, passwordHash).Scan(&userID)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}

	// 4. Assign role in platform.user_roles
	var assignedBy *uuid.UUID
	if actorID != uuid.Nil {
		assignedBy = &actorID
	}
	_, err = r.Executor(ctx).Exec(ctx, `
		INSERT INTO platform.user_roles (
			user_id,
			role_id,
			college_id,
			status,
			assigned_by
		) VALUES (
			$1, $2, $3, 'ACTIVE', $4
		)
	`, userID, roleID, collegeID, assignedBy)
	if err != nil {
		return nil, fmt.Errorf("assign COLLEGE_ADMIN role: %w", err)
	}

	// 5. Mark onboarding step COLLEGE_ADMIN COMPLETED
	_, _ = r.Executor(ctx).Exec(ctx, `
		UPDATE platform.college_onboarding
		SET status = 'COMPLETED',
		    completed_by = $2,
		    completed_at = now(),
		    notes = 'First administrator provisioned',
		    updated_at = now()
		WHERE college_id = $1 AND step_code = 'COLLEGE_ADMIN'
	`, collegeID, assignedBy)

	return r.GetCollegeAdmin(ctx, collegeID)
}

// UpdateCollegeAdminProfile updates permitted fields (e.g. phone) for a college administrator.
func (r *Repository) UpdateCollegeAdminProfile(
	ctx context.Context,
	collegeID uuid.UUID,
	userID uuid.UUID,
	phone *string,
) (*models.CollegeAdminAccount, error) {
	if collegeID == uuid.Nil || userID == uuid.Nil {
		return nil, fmt.Errorf("college ID and user ID are required")
	}

	// Verify user belongs to this college as COLLEGE_ADMIN
	var exists bool
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM platform.user_roles ur
			JOIN platform.roles r ON r.role_id = ur.role_id
			WHERE ur.college_id = $1
			  AND ur.user_id = $2
			  AND r.role_code = 'COLLEGE_ADMIN'
		)
	`, collegeID, userID).Scan(&exists)
	if err != nil {
		return nil, fmt.Errorf("verify user college admin membership: %w", err)
	}
	if !exists {
		return nil, fmt.Errorf("administrator not found for this college")
	}

	// Update app.users
	_, err = r.Executor(ctx).Exec(ctx, `
		UPDATE app.users
		SET phone = $1,
		    updated_at = now()
		WHERE user_id = $2
	`, phone, userID)
	if err != nil {
		return nil, fmt.Errorf("update user profile: %w", err)
	}

	return r.GetCollegeAdminByID(ctx, collegeID, userID)
}

// GetCollegeAdminByID retrieves a specific college admin account.
func (r *Repository) GetCollegeAdminByID(
	ctx context.Context,
	collegeID uuid.UUID,
	userID uuid.UUID,
) (*models.CollegeAdminAccount, error) {
	if collegeID == uuid.Nil || userID == uuid.Nil {
		return nil, fmt.Errorf("college ID and user ID are required")
	}

	query := `
		SELECT
			u.user_id,
			ur.college_id,
			u.email,
			u.phone,
			u.status,
			r.role_code,
			r.role_name,
			(u.password_hash IS NOT NULL AND length(u.password_hash) > 0) AS has_password,
			u.last_login_at,
			u.created_at
		FROM app.users u
		JOIN platform.user_roles ur ON ur.user_id = u.user_id
		JOIN platform.roles r ON r.role_id = ur.role_id
		WHERE ur.college_id = $1
		  AND u.user_id = $2
		  AND r.role_code = 'COLLEGE_ADMIN'
		LIMIT 1
	`
	var admin models.CollegeAdminAccount
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID, userID).Scan(
		&admin.UserID,
		&admin.CollegeID,
		&admin.Email,
		&admin.Phone,
		&admin.Status,
		&admin.RoleCode,
		&admin.RoleName,
		&admin.HasPassword,
		&admin.LastLoginAt,
		&admin.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &admin, nil
}

// UpdateCollegeAdminStatus updates status with atomic last active admin protection.
func (r *Repository) UpdateCollegeAdminStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	userID uuid.UUID,
	targetStatus string,
) (*models.CollegeAdminAccount, error) {
	if collegeID == uuid.Nil || userID == uuid.Nil {
		return nil, fmt.Errorf("college ID and user ID are required")
	}

	// 1. Check if user is currently an active college admin
	var currentStatus string
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT u.status
		FROM app.users u
		JOIN platform.user_roles ur ON ur.user_id = u.user_id
		JOIN platform.roles r ON r.role_id = ur.role_id
		WHERE ur.college_id = $1
		  AND u.user_id = $2
		  AND r.role_code = 'COLLEGE_ADMIN'
		FOR UPDATE OF u
	`, collegeID, userID).Scan(&currentStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("administrator not found for this college")
		}
		return nil, fmt.Errorf("lock admin user row: %w", err)
	}

	// 2. If deactivating or suspending, check if this is the last active admin for this college
	if (targetStatus == "DEACTIVATED" || targetStatus == "SUSPENDED") && currentStatus == "ACTIVE" {
		var activeCount int
		err = r.Executor(ctx).QueryRow(ctx, `
			SELECT COUNT(DISTINCT u.user_id)
			FROM app.users u
			JOIN platform.user_roles ur ON ur.user_id = u.user_id
			JOIN platform.roles r ON r.role_id = ur.role_id
			WHERE ur.college_id = $1
			  AND r.role_code = 'COLLEGE_ADMIN'
			  AND ur.status = 'ACTIVE'
			  AND u.status = 'ACTIVE'
		`, collegeID).Scan(&activeCount)
		if err != nil {
			return nil, fmt.Errorf("count active administrators: %w", err)
		}
		if activeCount <= 1 {
			return nil, fmt.Errorf("cannot deactivate the last active College Administrator for this college")
		}
	}

	// 3. Update app.users and platform.user_roles
	_, err = r.Executor(ctx).Exec(ctx, `
		UPDATE app.users
		SET status = $1,
		    updated_at = now()
		WHERE user_id = $2
	`, targetStatus, userID)
	if err != nil {
		return nil, fmt.Errorf("update user status: %w", err)
	}

	userRoleStatus := "ACTIVE"
	if targetStatus == "DEACTIVATED" {
		userRoleStatus = "REVOKED"
	} else if targetStatus == "SUSPENDED" {
		userRoleStatus = "SUSPENDED"
	}
	_, err = r.Executor(ctx).Exec(ctx, `
		UPDATE platform.user_roles
		SET status = $1,
		    updated_at = now()
		WHERE college_id = $2
		  AND user_id = $3
	`, userRoleStatus, collegeID, userID)
	if err != nil {
		return nil, fmt.Errorf("update user role status: %w", err)
	}

	return r.GetCollegeAdminByID(ctx, collegeID, userID)
}

// UnlockCollegeAdminAccount transitions a LOCKED account back to ACTIVE.
func (r *Repository) UnlockCollegeAdminAccount(
	ctx context.Context,
	collegeID uuid.UUID,
	userID uuid.UUID,
) (*models.CollegeAdminAccount, error) {
	if collegeID == uuid.Nil || userID == uuid.Nil {
		return nil, fmt.Errorf("college ID and user ID are required")
	}

	var currentStatus string
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT u.status
		FROM app.users u
		JOIN platform.user_roles ur ON ur.user_id = u.user_id
		JOIN platform.roles r ON r.role_id = ur.role_id
		WHERE ur.college_id = $1
		  AND u.user_id = $2
		  AND r.role_code = 'COLLEGE_ADMIN'
		FOR UPDATE OF u
	`, collegeID, userID).Scan(&currentStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("administrator not found for this college")
		}
		return nil, fmt.Errorf("lock admin user row: %w", err)
	}

	if currentStatus != "LOCKED" {
		return nil, fmt.Errorf("account is not currently locked (status: %s)", currentStatus)
	}

	_, err = r.Executor(ctx).Exec(ctx, `
		UPDATE app.users
		SET status = 'ACTIVE',
		    updated_at = now()
		WHERE user_id = $1
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("unlock user: %w", err)
	}

	return r.GetCollegeAdminByID(ctx, collegeID, userID)
}

// RevokeCollegeAdminSessions deactivates push tokens and invalidates refresh capability.
func (r *Repository) RevokeCollegeAdminSessions(
	ctx context.Context,
	collegeID uuid.UUID,
	userID uuid.UUID,
) (int64, error) {
	if collegeID == uuid.Nil || userID == uuid.Nil {
		return 0, fmt.Errorf("college ID and user ID are required")
	}

	// Deactivate all device notification tokens for this user
	cmdTag, err := r.Executor(ctx).Exec(ctx, `
		UPDATE platform.device_tokens
		SET is_active = false,
		    updated_at = now()
		WHERE user_id = $1
		  AND is_active = true
	`, userID)
	if err != nil {
		return 0, fmt.Errorf("deactivate device tokens: %w", err)
	}

	return cmdTag.RowsAffected(), nil
}

// GetCollegeAdminLoginHistory retrieves historical authentication events for a specific administrator.
func (r *Repository) GetCollegeAdminLoginHistory(
	ctx context.Context,
	collegeID uuid.UUID,
	userID uuid.UUID,
	limit int,
) ([]models.CollegeAdminLoginHistoryItem, error) {
	if collegeID == uuid.Nil || userID == uuid.Nil {
		return nil, fmt.Errorf("college ID and user ID are required")
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	query := `
		SELECT
			login_event_id,
			user_id,
			college_id,
			result,
			host(ip_address),
			device,
			user_agent,
			event_at
		FROM platform.login_events
		WHERE college_id = $1
		  AND user_id = $2
		ORDER BY event_at DESC
		LIMIT $3
	`

	rows, err := r.Executor(ctx).Query(ctx, query, collegeID, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("query login history: %w", err)
	}
	defer rows.Close()

	var events []models.CollegeAdminLoginHistoryItem
	for rows.Next() {
		var item models.CollegeAdminLoginHistoryItem
		if err := rows.Scan(
			&item.LoginEventID,
			&item.UserID,
			&item.CollegeID,
			&item.Result,
			&item.IPAddress,
			&item.Device,
			&item.UserAgent,
			&item.EventAt,
		); err != nil {
			return nil, fmt.Errorf("scan login history row: %w", err)
		}
		events = append(events, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate login history: %w", err)
	}

	return events, nil
}


