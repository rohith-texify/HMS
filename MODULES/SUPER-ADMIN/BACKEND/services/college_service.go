package services

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/yourusername/hostel-management-system/API/database"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
	"golang.org/x/crypto/bcrypt"
)

type ContextKey string

const (
	// ActorRoleContextKey stores the actor role in context.
	ActorRoleContextKey ContextKey = "super_admin_actor_role"
)

// CollegeService handles business logic for college management.
type CollegeService struct {
	repo *repository.Repository
	db   *database.Database
}

// NewCollegeService creates a new college service.
func NewCollegeService(
	db *database.Database,
	repo *repository.Repository,
) *CollegeService {
	return &CollegeService{
		repo: repo,
		db:   db,
	}
}

// ListColleges retrieves a list of colleges with optional filtering and pagination.
func (s *CollegeService) ListColleges(
	ctx context.Context,
	params models.ListCollegesParams,
) ([]models.College, *models.PaginationMeta, error) {
	if s == nil || s.repo == nil {
		return nil, nil, apierrors.New(
			apierrors.InternalError,
			"College service is not configured",
		)
	}

	// Set defaults for pagination
	limit := 20
	if params.Limit > 0 {
		limit = params.Limit
	}

	offset := 0
	if params.Offset > 0 {
		offset = params.Offset
	}

	// Prepare status filter
	var statusFilter *string
	if params.Status != "" {
		statusFilter = &params.Status
	}

	// Prepare search filter
	var searchFilter *string
	if strings.TrimSpace(params.Search) != "" {
		trimmed := strings.TrimSpace(params.Search)
		searchFilter = &trimmed
	}

	// Call repository
	colleges, total, err := s.repo.ListCollegesWithFilter(ctx, statusFilter, searchFilter, limit, offset)
	if err != nil {
		return nil, nil, apierrors.New(
			apierrors.InternalError,
			"Failed to retrieve colleges",
		)
	}

	meta := models.NewPaginationMeta(limit, offset, total)

	return colleges, meta, nil
}

// GetCollege retrieves a single college by its ID.
func (s *CollegeService) GetCollege(
	ctx context.Context,
	collegeID uuid.UUID,
) (*models.College, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"College service is not configured",
		)
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"College ID is required",
		)
	}

	college, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, apierrors.New(
				apierrors.NotFound,
				"College not found",
			)
		}
		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to retrieve college",
		)
	}

	return college, nil
}

// CreateCollege creates a new college with validation.
func (s *CollegeService) CreateCollege(
	ctx context.Context,
	req models.CreateCollegeRequest,
) (*models.College, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"College service is not configured",
		)
	}

	actorID, _ := database.PlatformUserIDFromContext(ctx)
	if actorID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.Unauthorized,
			"Authenticated actor user ID is required",
		)
	}
	actorRole, _ := ctx.Value(ActorRoleContextKey).(string)
	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	// Validate college code format (alphanumeric, hyphens, underscores)
	if !validators.IsValidCollegeCode(req.CollegeCode) {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"College code must contain only alphanumeric characters, hyphens, and underscores",
		)
	}

	// Check for duplicate college code
	existing, err := s.repo.GetCollegeByCode(ctx, req.CollegeCode)
	if err != nil && err != pgx.ErrNoRows {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to check college code availability",
		)
	}
	if existing != nil {
		return nil, apierrors.New(
			apierrors.Conflict,
			"College code already exists",
		)
	}

	// Default timezone to Indian Standard Time (IST - Asia/Kolkata) if omitted
	if strings.TrimSpace(req.Timezone) == "" {
		req.Timezone = "Asia/Kolkata"
	}

	// Validate timezone
	if !validators.IsValidTimezone(req.Timezone) {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"Invalid timezone format",
		)
	}

	// Validate contact email if provided
	if req.ContactEmail != nil && *req.ContactEmail != "" {
		if !validators.IsValidEmailFormat(*req.ContactEmail) {
			return nil, apierrors.New(
				apierrors.ValidationError,
				"Invalid email format",
			)
		}
	}

	// Validate location codes against geo database
	if err := s.repo.ValidateLocationCodes(ctx, req.StateCode, req.State, req.LocationType, req.DistrictCode, req.SubdistrictCode, req.BlockCode, req.CityCode, req.WardCode, req.VillageCode); err != nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			err.Error(),
		)
	}

	// Create college within a transaction
	var college *models.College
	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var txErr error

		college, txErr = s.repo.CreateCollege(txCtx, req)
		if txErr != nil {
			return txErr
		}

		if err := s.repo.SeedCollegeOnboarding(txCtx, college.CollegeID); err != nil {
			return err
		}

		if req.Password != nil && strings.TrimSpace(*req.Password) != "" {
			hash, hashErr := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
			if hashErr != nil {
				return fmt.Errorf("failed to hash admin password: %w", hashErr)
			}

			adminEmail := ""
			if req.AdminEmail != nil && strings.TrimSpace(*req.AdminEmail) != "" {
				adminEmail = strings.TrimSpace(strings.ToLower(*req.AdminEmail))
			} else if req.ContactEmail != nil && strings.TrimSpace(*req.ContactEmail) != "" {
				adminEmail = strings.TrimSpace(strings.ToLower(*req.ContactEmail))
			} else {
				adminEmail = strings.ToLower(fmt.Sprintf("%s.admin@hms.local", req.CollegeCode))
			}

			adminAccount, adminErr := s.repo.UpsertCollegeAdmin(txCtx, college.CollegeID, adminEmail, string(hash), actorID)
			if adminErr != nil {
				return fmt.Errorf("failed to initialize college admin credentials: %w", adminErr)
			}
			college.Admin = adminAccount

			_ = s.repo.RecordCollegeAdminPasswordAudit(txCtx, repository.CollegeAdminPasswordAuditParams{
				CollegeID:   college.CollegeID,
				ActorUserID: actorID,
				ActorRole:   actorRole,
				Action:      "COLLEGE_ADMIN_CREATED",
				AdminEmail:  adminEmail,
			})
		}

		return s.repo.RecordCollegeCreationAudit(txCtx, repository.CollegeCreationAuditParams{
			CollegeID:   college.CollegeID,
			ActorUserID: actorID,
			ActorRole:   actorRole,
			CollegeCode: college.CollegeCode,
			Name:        college.Name,
		})
	})

	if err != nil {
		if IsDuplicateCollegeCodeError(err) {
			return nil, apierrors.New(
				apierrors.Conflict,
				"College code already exists",
			)
		}
		return nil, apierrors.New(
			apierrors.InternalError,
			fmt.Sprintf("Failed to create college: %v", err),
		)
	}

	return college, nil
}

// IsDuplicateCollegeCodeError determines if an error represents a PostgreSQL unique violation
// specifically on the college_code constraint (uq_colleges_college_code), even through %w wrapping.
func IsDuplicateCollegeCodeError(err error) bool {
	if err == nil {
		return false
	}

	// Direct check for repository sentinel error
	if errors.Is(err, repository.ErrDuplicateCollegeCode) {
		return true
	}

	// Inspect unwrapped pgconn.PgError
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		if pgErr.Code == "23505" {
			// Ensure it specifically targets the college_code unique constraint
			if pgErr.ConstraintName == "uq_colleges_college_code" ||
				strings.Contains(pgErr.ConstraintName, "college_code") ||
				strings.Contains(pgErr.Detail, "college_code") {
				return true
			}
			// Unrelated unique constraint violation (e.g. uq_users_email, etc.)
			return false
		}
	}

	return false
}

// UpdateCollege updates permitted fields of a college.
func (s *CollegeService) UpdateCollege(
	ctx context.Context,
	collegeID uuid.UUID,
	req models.UpdateCollegeRequest,
) (*models.College, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"College service is not configured",
		)
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"College ID is required",
		)
	}

	actorID, _ := database.PlatformUserIDFromContext(ctx)
	if actorID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.Unauthorized,
			"Authenticated actor user ID is required",
		)
	}
	actorRole, _ := ctx.Value(ActorRoleContextKey).(string)
	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	// Verify college exists
	existing, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, apierrors.New(
				apierrors.NotFound,
				"College not found",
			)
		}
		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to retrieve college",
		)
	}

	// Lifecycle restriction: cannot update deactivated or archived college
	if existing.Status == "DEACTIVATED" || existing.Status == "ARCHIVED" {
		return nil, apierrors.New(
			apierrors.ValidationError,
			fmt.Sprintf("cannot update college profile for college with status '%s'", existing.Status),
		)
	}

	// Validate timezone if provided
	if req.Timezone != nil && !validators.IsValidTimezone(*req.Timezone) {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"Invalid timezone format",
		)
	}

	// Validate contact email if provided
	if req.ContactEmail != nil && *req.ContactEmail != "" && !validators.IsValidEmailFormat(*req.ContactEmail) {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"Invalid email format",
		)
	}

	// Validate that at least one field is being updated
	if req.Name == nil && req.City == nil && req.State == nil &&
		req.Timezone == nil && req.ContactEmail == nil &&
		req.LocationType == nil && req.StateCode == nil && req.DistrictCode == nil &&
		req.SubdistrictCode == nil && req.BlockCode == nil && req.CityCode == nil &&
		req.WardCode == nil && req.VillageCode == nil && req.CampusLocality == nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"At least one field must be provided for update",
		)
	}

	// Validate location codes against geo database if provided
	effStateCode := req.StateCode
	if effStateCode == nil {
		effStateCode = existing.StateCode
	}
	effState := req.State
	if effState == nil {
		effState = existing.State
	}
	effLocType := req.LocationType
	if effLocType == nil {
		effLocType = existing.LocationType
	}
	if err := s.repo.ValidateLocationCodes(ctx, effStateCode, effState, effLocType, req.DistrictCode, req.SubdistrictCode, req.BlockCode, req.CityCode, req.WardCode, req.VillageCode); err != nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			err.Error(),
		)
	}

	oldData := make(map[string]interface{})
	newData := make(map[string]interface{})

	if req.Name != nil && *req.Name != existing.Name {
		oldData["name"] = existing.Name
		newData["name"] = *req.Name
	}
	if req.City != nil && (existing.City == nil || *req.City != *existing.City) {
		oldData["city"] = existing.City
		newData["city"] = *req.City
	}
	if req.State != nil && (existing.State == nil || *req.State != *existing.State) {
		oldData["state"] = existing.State
		newData["state"] = *req.State
	}
	if req.Timezone != nil && *req.Timezone != existing.Timezone {
		oldData["timezone"] = existing.Timezone
		newData["timezone"] = *req.Timezone
	}
	if req.ContactEmail != nil && (existing.ContactEmail == nil || *req.ContactEmail != *existing.ContactEmail) {
		oldData["contact_email"] = existing.ContactEmail
		newData["contact_email"] = *req.ContactEmail
	}

	// Update college within a transaction
	var college *models.College
	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var txErr error
		college, txErr = s.repo.UpdateCollege(txCtx, collegeID, req)
		if txErr != nil {
			return txErr
		}

		if len(newData) > 0 {
			if auditErr := s.repo.RecordCollegeProfileUpdateAudit(txCtx, repository.CollegeProfileUpdateAuditParams{
				CollegeID:   collegeID,
				ActorUserID: actorID,
				ActorRole:   actorRole,
				OldData:     oldData,
				NewData:     newData,
			}); auditErr != nil {
				return fmt.Errorf("failed to record profile update audit: %w", auditErr)
			}
		}
		return nil
	})

	if err != nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to update college",
		)
	}

	return college, nil
}

// UpdateCollegeStatus updates the status of a college with lifecycle tracking.
func (s *CollegeService) UpdateCollegeStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	req models.UpdateCollegeStatusRequest,
	actorUserID uuid.UUID,
	actorRole string,
) (*models.College, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"College service is not configured",
		)
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"College ID is required",
		)
	}

	if actorUserID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.Unauthorized,
			"Authenticated actor user ID is required",
		)
	}

	actorRole = strings.TrimSpace(actorRole)
	if actorRole == "" {
		return nil, apierrors.New(
			apierrors.Unauthorized,
			"Authenticated actor role is required",
		)
	}

	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	switch req.Status {
	case "ONBOARDING", "ACTIVE", "SUSPENDED", "DEACTIVATED":
		// Valid status
	default:
		return nil, apierrors.New(
			apierrors.ValidationError,
			fmt.Sprintf("Invalid college status: %s", req.Status),
		)
	}

	reason := strings.TrimSpace(req.GetReason())
	if reason == "" {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"Lifecycle reason is required",
		)
	}

	var college *models.College
	err := s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		// 1. Row locking to prevent concurrent status changes from bypassing validation
		currentStatus, err := s.repo.LockCollegeStatus(txCtx, collegeID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apierrors.New(
					apierrors.NotFound,
					"College not found",
				)
			}
			return apierrors.New(
				apierrors.InternalError,
				fmt.Sprintf("Failed to lock college: %v", err),
			)
		}

		// 2. Reject repeat requests that repeat current status
		if currentStatus == req.Status {
			return apierrors.New(
				apierrors.ValidationError,
				fmt.Sprintf("college status is already %s", currentStatus),
			)
		}

		// 3. Reject unsupported transitions
		if !isValidStatusTransition(currentStatus, req.Status) {
			return apierrors.New(
				apierrors.ValidationError,
				fmt.Sprintf("invalid college status transition: %s -> %s", currentStatus, req.Status),
			)
		}

		// 4. Activation only when all mandatory gates and canonical steps are satisfied
		if req.Status == "ACTIVE" {
			if err := s.repo.EnsureCollegeReadyForActivation(txCtx, collegeID); err != nil {
				return apierrors.New(
					apierrors.ValidationError,
					fmt.Sprintf("college onboarding is not ready for activation: %v", err),
				)
			}
			// Mark GO_LIVE step COMPLETED upon successful activation
			_ = s.repo.CompleteGoLiveStep(txCtx, collegeID, actorUserID)
		}

		// 5. Update status
		college, err = s.repo.UpdateCollegeStatus(txCtx, collegeID, req.Status, &reason)
		if err != nil {
			return apierrors.New(
				apierrors.InternalError,
				fmt.Sprintf("Failed to update college status: %v", err),
			)
		}

		// 6. Record immutable audit record in platform.audit_logs
		auditErr := s.repo.RecordCollegeLifecycleAudit(txCtx, repository.CollegeLifecycleAuditParams{
			CollegeID:       collegeID,
			ActorUserID:     actorUserID,
			ActorRole:       actorRole,
			OldStatus:       currentStatus,
			NewStatus:       req.Status,
			LifecycleReason: reason,
		})
		if auditErr != nil {
			return apierrors.New(
				apierrors.InternalError,
				fmt.Sprintf("Failed to record lifecycle audit: %v", auditErr),
			)
		}

		return nil
	})

	if err != nil {
		var apiErr *apierrors.APIError
		if errors.As(err, &apiErr) {
			return nil, apiErr
		}
		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to update college status",
		)
	}

	return college, nil
}

// GetCollegeOnboarding retrieves the onboarding checklist for a college.
func (s *CollegeService) GetCollegeOnboarding(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]models.CollegeOnboardingStep, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "College service is not configured")
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID is required")
	}

	// Confirm the college exists
	if _, err := s.repo.GetCollegeByID(ctx, collegeID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "College not found")
		}
		return nil, apierrors.New(apierrors.InternalError, "Failed to retrieve college")
	}

	steps, err := s.repo.GetCollegeOnboarding(ctx, collegeID)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, "Failed to retrieve onboarding steps")
	}

	return steps, nil
}

// UpdateCollegeOnboarding updates an onboarding step and records an audit log.
func (s *CollegeService) UpdateCollegeOnboarding(
	ctx context.Context,
	collegeID uuid.UUID,
	stepCode string,
	req models.UpdateCollegeOnboardingRequest,
	actorUserID uuid.UUID,
	actorRole string,
) (*models.CollegeOnboardingStep, error) {
	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID is required")
	}

	if actorUserID == uuid.Nil {
		return nil, apierrors.New(apierrors.Unauthorized, "Authenticated actor user ID is required")
	}

	actorRole = strings.TrimSpace(actorRole)
	if actorRole == "" {
		return nil, apierrors.New(apierrors.Unauthorized, "Authenticated actor role is required")
	}

	stepCode = strings.ToUpper(strings.TrimSpace(stepCode))
	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))

	switch stepCode {
	case "COLLEGE_PROFILE", "COLLEGE_ADMIN", "BRANDING",
		"ENTITLEMENTS", "READINESS_REVIEW", "GO_LIVE":
	default:
		return nil, apierrors.New(apierrors.ValidationError, "Invalid onboarding step code")
	}

	switch req.Status {
	case "PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED", "FAILED":
	default:
		return nil, apierrors.New(apierrors.ValidationError, "Invalid onboarding status")
	}

	// Disallow skipping mandatory onboarding steps (only BRANDING / GENERAL_CONFIG may be skipped)
	if req.Status == "SKIPPED" && stepCode != "BRANDING" {
		return nil, apierrors.New(
			apierrors.ValidationError,
			fmt.Sprintf("cannot skip mandatory onboarding step %s (only BRANDING may be skipped)", stepCode),
		)
	}

	if req.Status == "COMPLETED" && (req.Notes == nil || strings.TrimSpace(*req.Notes) == "") {
		return nil, apierrors.New(apierrors.ValidationError, "Notes are required to document step completion")
	}

	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "College service is not configured")
	}

	var updatedStep *models.CollegeOnboardingStep
	err := s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		// Lock college row first to enforce consistent lock ordering
		collegeStatus, err := s.repo.LockCollegeStatus(txCtx, collegeID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apierrors.New(apierrors.NotFound, "College not found")
			}
			return apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to lock college: %v", err))
		}

		// Prevent onboarding modifications on deactivated, archived, or suspended colleges
		if collegeStatus == "DEACTIVATED" || collegeStatus == "ARCHIVED" || collegeStatus == "SUSPENDED" {
			return apierrors.New(
				apierrors.ValidationError,
				fmt.Sprintf("cannot update onboarding steps for college with status '%s'", collegeStatus),
			)
		}

		// Prevent reopening or invalidating completed onboarding steps on active colleges
		if collegeStatus == "ACTIVE" && req.Status != "COMPLETED" && req.Status != "SKIPPED" {
			return apierrors.New(
				apierrors.ValidationError,
				"cannot revert onboarding step for an active college",
			)
		}

		// Validate onboarding prerequisite sequence and authoritative DB conditions before marking step completed
		if req.Status == "COMPLETED" {
			existingSteps, err := s.repo.GetCollegeOnboarding(txCtx, collegeID)
			if err != nil {
				return apierrors.New(apierrors.InternalError, fmt.Sprintf("failed to retrieve onboarding state: %v", err))
			}

			stepStatuses := make(map[string]string)
			for _, st := range existingSteps {
				stepStatuses[st.StepCode] = st.Status
			}

			// 1. Prerequisite Sequence Checks
			switch stepCode {
			case "COLLEGE_ADMIN":
				if stepStatuses["COLLEGE_PROFILE"] != "COMPLETED" {
					return apierrors.New(
						apierrors.ValidationError,
						fmt.Sprintf("preceding onboarding step COLLEGE_PROFILE must be COMPLETED before completing %s", stepCode),
					)
				}
			case "READINESS_REVIEW":
				prereqs := []string{"COLLEGE_PROFILE", "COLLEGE_ADMIN"}
				for _, p := range prereqs {
					if stepStatuses[p] != "COMPLETED" {
						return apierrors.New(
							apierrors.ValidationError,
							fmt.Sprintf("preceding onboarding step %s must be COMPLETED before completing READINESS_REVIEW", p),
						)
					}
				}
			case "GO_LIVE":
				prereqs := []string{"COLLEGE_PROFILE", "COLLEGE_ADMIN", "READINESS_REVIEW"}
				for _, p := range prereqs {
					if stepStatuses[p] != "COMPLETED" {
						return apierrors.New(
							apierrors.ValidationError,
							fmt.Sprintf("preceding onboarding step %s must be COMPLETED before completing GO_LIVE", p),
						)
					}
				}
			}

			// 2. Authoritative Database Condition Checks (Prevent False Completion)
			switch stepCode {
			case "COLLEGE_PROFILE":
				col, err := s.repo.GetCollegeByID(txCtx, collegeID)
				if err != nil {
					return apierrors.New(apierrors.InternalError, fmt.Sprintf("failed to check college profile: %v", err))
				}
				if strings.TrimSpace(col.CollegeCode) == "" ||
					strings.TrimSpace(col.Name) == "" ||
					strings.TrimSpace(col.Timezone) == "" ||
					col.ContactEmail == nil || strings.TrimSpace(*col.ContactEmail) == "" {
					return apierrors.New(
						apierrors.ValidationError,
						"cannot complete COLLEGE_PROFILE: college profile is incomplete (code, name, timezone, and contact email required)",
					)
				}

			case "COLLEGE_ADMIN":
				admin, err := s.repo.GetCollegeAdmin(txCtx, collegeID)
				if err != nil || admin == nil || admin.Status != "ACTIVE" || !admin.HasPassword {
					return apierrors.New(
						apierrors.ValidationError,
						"cannot complete COLLEGE_ADMIN: no active administrator account with initialized credentials found for this college",
					)
				}

			case "READINESS_REVIEW", "GO_LIVE":
				// Profile gate
				col, err := s.repo.GetCollegeByID(txCtx, collegeID)
				if err != nil || strings.TrimSpace(col.CollegeCode) == "" || strings.TrimSpace(col.Name) == "" || strings.TrimSpace(col.Timezone) == "" || col.ContactEmail == nil || strings.TrimSpace(*col.ContactEmail) == "" {
					return apierrors.New(apierrors.ValidationError, "cannot complete readiness review: mandatory gate COLLEGE_PROFILE is incomplete")
				}
				// Admin gate
				admin, err := s.repo.GetCollegeAdmin(txCtx, collegeID)
				if err != nil || admin == nil || admin.Status != "ACTIVE" || !admin.HasPassword {
					return apierrors.New(apierrors.ValidationError, "cannot complete readiness review: mandatory gate FIRST_ADMIN is unmet (active admin with initialized password required)")
				}
				// Hostel structure gate
				hostelCount, err := s.repo.CountCollegeHostels(txCtx, collegeID)
				if err != nil || hostelCount == 0 {
					return apierrors.New(apierrors.ValidationError, "cannot complete readiness review: mandatory gate HOSTEL_STRUCTURE is unmet (at least one active hostel structure is required)")
				}
			}
		}

		step, oldStatus, err := s.repo.UpdateCollegeOnboardingStep(
			txCtx,
			collegeID,
			repository.UpdateOnboardingStepParams{
				StepCode:    stepCode,
				Status:      req.Status,
				Notes:       req.Notes,
				CompletedBy: &actorUserID,
			},
		)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apierrors.New(apierrors.NotFound, "Onboarding step not found")
			}
			return apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to update onboarding step: %v", err))
		}

		auditErr := s.repo.RecordOnboardingStepAudit(txCtx, repository.OnboardingStepAuditParams{
			CollegeID:    collegeID,
			OnboardingID: step.OnboardingID,
			ActorUserID:  actorUserID,
			ActorRole:    actorRole,
			StepCode:     stepCode,
			OldStatus:    oldStatus,
			NewStatus:    req.Status,
		})
		if auditErr != nil {
			return apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to record onboarding audit: %v", auditErr))
		}

		updatedStep = step
		return nil
	})

	if err != nil {
		var apiErr *apierrors.APIError
		if errors.As(err, &apiErr) {
			return nil, apiErr
		}
		return nil, apierrors.New(apierrors.InternalError, "Failed to update onboarding step")
	}

	return updatedStep, nil
}

// isValidCollegeCode checks if the college code contains only valid characters.
func isValidCollegeCode(code string) bool {
	return validators.IsValidCollegeCode(code)
}

// isValidTimezone performs basic timezone validation.
func isValidTimezone(tz string) bool {
	return validators.IsValidTimezone(tz)
}

// IsValidStatusTransition validates college status transitions.
// Enforces allowed lifecycle design:
// - ONBOARDING -> ACTIVE or DEACTIVATED
// - ACTIVE -> SUSPENDED or DEACTIVATED
// - SUSPENDED -> ACTIVE or DEACTIVATED
// - DEACTIVATED -> ACTIVE
// Rejects repeating current status and all other transitions.
func IsValidStatusTransition(currentStatus, newStatus string) bool {
	if currentStatus == newStatus {
		return false
	}

	transitions := map[string][]string{
		"ONBOARDING":  {"ACTIVE", "DEACTIVATED"},
		"ACTIVE":      {"SUSPENDED", "DEACTIVATED"},
		"SUSPENDED":   {"ACTIVE", "DEACTIVATED"},
		"DEACTIVATED": {"ACTIVE"},
	}

	allowedTransitions, exists := transitions[currentStatus]
	if !exists {
		return false
	}

	for _, allowed := range allowedTransitions {
		if newStatus == allowed {
			return true
		}
	}

	return false
}

// ValidateStatusTransition returns a domain error if the transition is invalid.
func ValidateStatusTransition(currentStatus, newStatus string) error {
	if currentStatus == newStatus {
		return apierrors.New(
			apierrors.ValidationError,
			fmt.Sprintf("college status is already %s", currentStatus),
		)
	}

	if !IsValidStatusTransition(currentStatus, newStatus) {
		return apierrors.New(
			apierrors.ValidationError,
			fmt.Sprintf("invalid college status transition: %s -> %s", currentStatus, newStatus),
		)
	}

	return nil
}

func isValidStatusTransition(currentStatus, newStatus string) bool {
	return IsValidStatusTransition(currentStatus, newStatus)
}

// GetCollegeAdmin retrieves the primary active College Admin account for a college.
func (s *CollegeService) GetCollegeAdmin(
	ctx context.Context,
	collegeID uuid.UUID,
) (*models.CollegeAdminAccount, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"College service is not configured",
		)
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"College ID is required",
		)
	}

	admin, err := s.repo.GetCollegeAdmin(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(
				apierrors.NotFound,
				"No administrator account found for this college",
			)
		}
		return nil, apierrors.New(
			apierrors.InternalError,
			fmt.Sprintf("Failed to retrieve college admin: %v", err),
		)
	}

	return admin, nil
}

// UpdateCollegeAdminPassword updates or resets the password for a college administrator.
func (s *CollegeService) UpdateCollegeAdminPassword(
	ctx context.Context,
	collegeID uuid.UUID,
	req models.UpdateCollegeAdminPasswordRequest,
) (*models.CollegeAdminAccount, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"College service is not configured",
		)
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"College ID is required",
		)
	}

	actorID, _ := database.PlatformUserIDFromContext(ctx)
	if actorID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.Unauthorized,
			"Authenticated actor user ID is required",
		)
	}
	actorRole, _ := ctx.Value(ActorRoleContextKey).(string)
	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	// Verify college exists
	college, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(
				apierrors.NotFound,
				"College not found",
			)
		}
		return nil, apierrors.New(
			apierrors.InternalError,
			fmt.Sprintf("Failed to check college existence: %v", err),
		)
	}

	// Determine admin email
	adminEmail := ""
	if req.AdminEmail != nil && strings.TrimSpace(*req.AdminEmail) != "" {
		adminEmail = strings.TrimSpace(strings.ToLower(*req.AdminEmail))
	} else if college.ContactEmail != nil && strings.TrimSpace(*college.ContactEmail) != "" {
		adminEmail = strings.TrimSpace(strings.ToLower(*college.ContactEmail))
	} else {
		adminEmail = strings.ToLower(fmt.Sprintf("%s.admin@hms.local", college.CollegeCode))
	}

	// Hash password
	hash, hashErr := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if hashErr != nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			fmt.Sprintf("Failed to hash password: %v", hashErr),
		)
	}

	var updatedAdmin *models.CollegeAdminAccount
	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var txErr error
		updatedAdmin, txErr = s.repo.UpsertCollegeAdmin(txCtx, collegeID, adminEmail, string(hash), actorID)
		if txErr != nil {
			return txErr
		}

		return s.repo.RecordCollegeAdminPasswordAudit(txCtx, repository.CollegeAdminPasswordAuditParams{
			CollegeID:   collegeID,
			ActorUserID: actorID,
			ActorRole:   actorRole,
			Action:      "COLLEGE_ADMIN_PASSWORD_UPDATED",
			AdminEmail:  adminEmail,
		})
	})

	if err != nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			fmt.Sprintf("Failed to update college admin password: %v", err),
		)
	}

	return updatedAdmin, nil
}

// GetCollegeReadiness evaluates the 7 onboarding checklist stages and returns a comprehensive readiness report.
func (s *CollegeService) GetCollegeReadiness(
	ctx context.Context,
	collegeID uuid.UUID,
) (*models.CollegeReadinessResponse, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "College service is not configured")
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID is required")
	}

	college, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "College not found")
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to retrieve college: %v", err))
	}

	steps, err := s.repo.GetCollegeOnboarding(ctx, collegeID)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to retrieve onboarding steps: %v", err))
	}

	canonicalMap := make(map[string]models.CollegeOnboardingStep)
	completedCanonicalCount := 0
	for _, st := range steps {
		canonicalMap[st.StepCode] = st
		if st.Status == "COMPLETED" || (st.StepCode == "BRANDING" && st.Status == "SKIPPED") {
			completedCanonicalCount++
		}
	}

	gates := make([]models.CollegeReadinessGate, 0, 7)

	// Gate 1: College Profile (Mandatory)
	profileValid := strings.TrimSpace(college.CollegeCode) != "" &&
		strings.TrimSpace(college.Name) != "" &&
		strings.TrimSpace(college.Timezone) != "" &&
		college.ContactEmail != nil && strings.TrimSpace(*college.ContactEmail) != ""

	profileStatus := "FAILED"
	profileMsg := "College profile is incomplete. Code, name, timezone, and contact email are required."
	if profileValid {
		profileStatus = "PASSED"
		profileMsg = fmt.Sprintf("College profile valid (Code: %s, Name: %s, Timezone: %s).", college.CollegeCode, college.Name, college.Timezone)
	}
	gates = append(gates, models.CollegeReadinessGate{
		GateCode:    "COLLEGE_PROFILE",
		Name:        "College Profile Identity",
		Status:      profileStatus,
		IsMandatory: true,
		Message:     profileMsg,
		Details: map[string]interface{}{
			"college_code":  college.CollegeCode,
			"name":          college.Name,
			"timezone":      college.Timezone,
			"contact_email": college.ContactEmail,
			"city":          college.City,
			"state":         college.State,
		},
		ActionStep: "COLLEGE_PROFILE",
	})

	// Gate 2: Hostel Structure (Mandatory)
	hostelCount, _ := s.repo.CountCollegeHostels(ctx, collegeID)
	hostelStatus := "FAILED"
	hostelMsg := "At least one active hostel structure is required before go-live. Currently 0 active hostels found."
	if hostelCount > 0 {
		hostelStatus = "PASSED"
		hostelMsg = fmt.Sprintf("%d active hostel structure(s) registered for this college.", hostelCount)
	}
	gates = append(gates, models.CollegeReadinessGate{
		GateCode:    "HOSTEL_STRUCTURE",
		Name:        "Hostel Structure Seeding",
		Status:      hostelStatus,
		IsMandatory: true,
		Message:     hostelMsg,
		Details: map[string]interface{}{
			"active_hostels": hostelCount,
		},
		ActionStep: "HOSTEL_STRUCTURE",
	})

	// Gate 5: First College Admin (Mandatory)
	admin, _ := s.repo.GetCollegeAdmin(ctx, collegeID)
	adminStatus := "FAILED"
	adminMsg := "No active College Administrator account found with initialized credentials."
	var adminDetails map[string]interface{}
	if admin != nil {
		adminDetails = map[string]interface{}{
			"email":        admin.Email,
			"role":         admin.RoleCode,
			"status":       admin.Status,
			"has_password": admin.HasPassword,
		}
		if admin.Status == "ACTIVE" && admin.HasPassword {
			adminStatus = "PASSED"
			adminMsg = fmt.Sprintf("Active College Admin account verified for %s.", admin.Email)
		} else if !admin.HasPassword {
			adminMsg = fmt.Sprintf("College Admin (%s) exists but password credentials are not set.", admin.Email)
		}
	}
	gates = append(gates, models.CollegeReadinessGate{
		GateCode:    "FIRST_ADMIN",
		Name:        "First College Administrator",
		Status:      adminStatus,
		IsMandatory: true,
		Message:     adminMsg,
		Details:     adminDetails,
		ActionStep:  "COLLEGE_ADMIN",
	})

	// Gate 7: Canonical Onboarding Checklist (Mandatory)
	checklistStatus := "PENDING"
	checklistMsg := fmt.Sprintf("%d of %d canonical onboarding steps completed.", completedCanonicalCount, len(steps))
	if completedCanonicalCount == len(steps) && len(steps) > 0 {
		checklistStatus = "PASSED"
		checklistMsg = "All canonical onboarding checklist steps are COMPLETED."
	}
	gates = append(gates, models.CollegeReadinessGate{
		GateCode:    "ONBOARDING_CHECKLIST",
		Name:        "Canonical Onboarding Steps",
		Status:      checklistStatus,
		IsMandatory: true,
		Message:     checklistMsg,
		Details: map[string]interface{}{
			"completed_steps": completedCanonicalCount,
			"total_steps":     len(steps),
		},
		ActionStep: "READINESS_REVIEW",
	})

	// Calculate summary and overall readiness
	summary := models.ReadinessSummary{
		TotalGates: len(gates),
	}
	for _, g := range gates {
		if g.Status == "PASSED" {
			summary.PassedGates++
			if g.IsMandatory {
				summary.MandatoryPassed++
			}
		}
		if g.IsMandatory {
			summary.TotalMandatory++
		}
	}

	isReady := summary.MandatoryPassed == summary.TotalMandatory

	// Progress calculation: weighted combination of canonical steps (50%) and passed gates (50%)
	progress := 0
	if len(steps) > 0 && summary.TotalGates > 0 {
		stepProgress := (completedCanonicalCount * 50) / len(steps)
		gateProgress := (summary.PassedGates * 50) / summary.TotalGates
		progress = stepProgress + gateProgress
	}
	if !isReady && progress >= 100 {
		progress = 90
	}
	if isReady {
		progress = 100
	}

	// Determine next recommended action
	nextAction := "GO_LIVE"
	if !profileValid {
		nextAction = "COMPLETE_COLLEGE_PROFILE"
	} else if adminStatus != "PASSED" {
		nextAction = "PROVISION_COLLEGE_ADMIN"
	} else if hostelCount == 0 {
		nextAction = "SEED_HOSTEL_STRUCTURE"
	} else if completedCanonicalCount < len(steps) {
		nextAction = "COMPLETE_CHECKLIST_STEPS"
	}

	return &models.CollegeReadinessResponse{
		CollegeID:          college.CollegeID,
		CollegeCode:        college.CollegeCode,
		Name:               college.Name,
		Status:             college.Status,
		IsReady:            isReady,
		ProgressPercentage: progress,
		Summary:            summary,
		Gates:              gates,
		CanonicalSteps:     steps,
		NextAction:         nextAction,
	}, nil
}

// ListOnboardingPipeline retrieves all colleges currently undergoing onboarding.
func (s *CollegeService) ListOnboardingPipeline(ctx context.Context) ([]models.CollegeOnboardingSummary, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "College service is not configured")
	}

	summaries, err := s.repo.ListOnboardingPipeline(ctx)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to list onboarding pipeline: %v", err))
	}

	return summaries, nil
}

// TestCollegeNotification evaluates and reports tenant onboarding notification testing capability.
// Truthfully reports UNAVAILABLE when no outbound provider (SMTP/SMS/Webhook) is configured.
func (s *CollegeService) TestCollegeNotification(
	ctx context.Context,
	collegeID uuid.UUID,
) (*models.NotificationTestResult, error) {
	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID is required")
	}

	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "College service is not configured")
	}

	college, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "College not found")
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to retrieve college: %v", err))
	}

	return &models.NotificationTestResult{
		CollegeID: college.CollegeID,
		Status:    "UNAVAILABLE",
		Message:   "Tenant onboarding notification testing is currently unavailable. No platform outbound notification service (SMTP/SMS/Webhook) is configured or exposed to Super Admin.",
		Details: map[string]interface{}{
			"service_available": false,
			"provider_status":   "NOT_CONFIGURED",
			"college_code":      college.CollegeCode,
			"contact_email":     college.ContactEmail,
			"advisory_only":     true,
		},
	}, nil
}

// ListCollegeAdmins lists administrator accounts for a specific college.
func (s *CollegeService) ListCollegeAdmins(
	ctx context.Context,
	collegeID uuid.UUID,
	params models.ListCollegeAdminsParams,
) (*models.ListCollegeAdminsResponse, error) {
	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID is required")
	}
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "College service is not configured")
	}

	// Verify college exists
	_, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "College not found")
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to check college existence: %v", err))
	}

	limit := params.Limit
	if limit <= 0 {
		limit = 20
	}
	offset := params.Offset
	if offset < 0 {
		offset = 0
	}

	admins, total, err := s.repo.ListCollegeAdmins(ctx, collegeID, params.Status, limit, offset)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to list college admins: %v", err))
	}

	return &models.ListCollegeAdminsResponse{
		CollegeID: collegeID,
		Admins:    admins,
		Total:     total,
		Limit:     limit,
		Offset:    offset,
	}, nil
}

// ProvisionFirstCollegeAdmin provisions the initial administrator for a college.
func (s *CollegeService) ProvisionFirstCollegeAdmin(
	ctx context.Context,
	collegeID uuid.UUID,
	req models.ProvisionFirstCollegeAdminRequest,
) (*models.CollegeAdminAccount, error) {
	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID is required")
	}
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "College service is not configured")
	}

	actorID, _ := database.PlatformUserIDFromContext(ctx)
	if actorID == uuid.Nil {
		return nil, apierrors.New(apierrors.Unauthorized, "Authenticated actor user ID is required")
	}
	actorRole, _ := ctx.Value(ActorRoleContextKey).(string)
	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	// Verify target college exists
	_, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "College not found")
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to check college existence: %v", err))
	}

	cleanEmail := strings.TrimSpace(strings.ToLower(req.Email))
	if cleanEmail == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Email is required")
	}
	if len(req.Password) < 8 {
		return nil, apierrors.New(apierrors.ValidationError, "Password must be at least 8 characters")
	}

	hash, hashErr := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if hashErr != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to hash password: %v", hashErr))
	}

	var admin *models.CollegeAdminAccount
	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var txErr error
		admin, txErr = s.repo.ProvisionFirstCollegeAdmin(txCtx, collegeID, cleanEmail, req.Phone, string(hash), actorID)
		if txErr != nil {
			return txErr
		}

		return s.repo.RecordCollegeAdminPasswordAudit(txCtx, repository.CollegeAdminPasswordAuditParams{
			CollegeID:   collegeID,
			ActorUserID: actorID,
			ActorRole:   actorRole,
			Action:      "COLLEGE_ADMIN_PROVISIONED",
			AdminEmail:  cleanEmail,
		})
	})

	if err != nil {
		if strings.Contains(err.Error(), "already been provisioned") {
			return nil, apierrors.New(apierrors.Conflict, "First administrator has already been provisioned for this college")
		}
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			return nil, apierrors.New(apierrors.Conflict, "A user with this email address already exists")
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to provision first administrator: %v", err))
	}

	return admin, nil
}

// UpdateCollegeAdminProfile edits permitted fields of an administrator account.
func (s *CollegeService) UpdateCollegeAdminProfile(
	ctx context.Context,
	collegeID uuid.UUID,
	userID uuid.UUID,
	req models.UpdateCollegeAdminProfileRequest,
) (*models.CollegeAdminAccount, error) {
	if collegeID == uuid.Nil || userID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID and User ID are required")
	}
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "College service is not configured")
	}

	actorID, _ := database.PlatformUserIDFromContext(ctx)
	if actorID == uuid.Nil {
		return nil, apierrors.New(apierrors.Unauthorized, "Authenticated actor user ID is required")
	}
	actorRole, _ := ctx.Value(ActorRoleContextKey).(string)
	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	var updated *models.CollegeAdminAccount
	err := s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var txErr error
		updated, txErr = s.repo.UpdateCollegeAdminProfile(txCtx, collegeID, userID, req.Phone)
		if txErr != nil {
			return txErr
		}

		return s.repo.RecordCollegeAdminPasswordAudit(txCtx, repository.CollegeAdminPasswordAuditParams{
			CollegeID:   collegeID,
			ActorUserID: actorID,
			ActorRole:   actorRole,
			Action:      "COLLEGE_ADMIN_PROFILE_UPDATED",
			AdminEmail:  updated.Email,
		})
	})

	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return nil, apierrors.New(apierrors.NotFound, "Administrator account not found for this college")
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to update admin profile: %v", err))
	}

	return updated, nil
}

// UpdateCollegeAdminStatus updates the account status while preventing deactivation of the last active admin.
func (s *CollegeService) UpdateCollegeAdminStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	userID uuid.UUID,
	req models.UpdateCollegeAdminStatusRequest,
) (*models.CollegeAdminAccount, error) {
	if collegeID == uuid.Nil || userID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID and User ID are required")
	}
	if strings.TrimSpace(req.Reason) == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Reason for status change is required")
	}
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "College service is not configured")
	}

	actorID, _ := database.PlatformUserIDFromContext(ctx)
	if actorID == uuid.Nil {
		return nil, apierrors.New(apierrors.Unauthorized, "Authenticated actor user ID is required")
	}
	actorRole, _ := ctx.Value(ActorRoleContextKey).(string)
	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	var updated *models.CollegeAdminAccount
	err := s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var txErr error
		updated, txErr = s.repo.UpdateCollegeAdminStatus(txCtx, collegeID, userID, req.Status)
		if txErr != nil {
			return txErr
		}

		return s.repo.RecordCollegeAdminPasswordAudit(txCtx, repository.CollegeAdminPasswordAuditParams{
			CollegeID:   collegeID,
			ActorUserID: actorID,
			ActorRole:   actorRole,
			Action:      fmt.Sprintf("COLLEGE_ADMIN_STATUS_%s", req.Status),
			AdminEmail:  updated.Email,
		})
	})

	if err != nil {
		if strings.Contains(err.Error(), "last active College Administrator") {
			return nil, apierrors.New(apierrors.Conflict, "Cannot deactivate the last active College Administrator for this college")
		}
		if strings.Contains(err.Error(), "not found") {
			return nil, apierrors.New(apierrors.NotFound, "Administrator account not found for this college")
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to update status: %v", err))
	}

	return updated, nil
}

// UnlockCollegeAdminAccount unlocks a locked administrator account.
func (s *CollegeService) UnlockCollegeAdminAccount(
	ctx context.Context,
	collegeID uuid.UUID,
	userID uuid.UUID,
) (*models.CollegeAdminAccount, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "College service is not configured")
	}
	if collegeID == uuid.Nil || userID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID and User ID are required")
	}

	actorID, _ := database.PlatformUserIDFromContext(ctx)
	if actorID == uuid.Nil {
		return nil, apierrors.New(apierrors.Unauthorized, "Authenticated actor user ID is required")
	}
	actorRole, _ := ctx.Value(ActorRoleContextKey).(string)
	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	var updated *models.CollegeAdminAccount
	err := s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var txErr error
		updated, txErr = s.repo.UnlockCollegeAdminAccount(txCtx, collegeID, userID)
		if txErr != nil {
			return txErr
		}

		return s.repo.RecordCollegeAdminPasswordAudit(txCtx, repository.CollegeAdminPasswordAuditParams{
			CollegeID:   collegeID,
			ActorUserID: actorID,
			ActorRole:   actorRole,
			Action:      "COLLEGE_ADMIN_UNLOCKED",
			AdminEmail:  updated.Email,
		})
	})

	if err != nil {
		if strings.Contains(err.Error(), "not currently locked") {
			return nil, apierrors.New(apierrors.ValidationError, err.Error())
		}
		if strings.Contains(err.Error(), "not found") {
			return nil, apierrors.New(apierrors.NotFound, "Administrator account not found for this college")
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to unlock administrator: %v", err))
	}

	return updated, nil
}

// RevokeCollegeAdminSessions revokes push tokens and session capabilities.
func (s *CollegeService) RevokeCollegeAdminSessions(
	ctx context.Context,
	collegeID uuid.UUID,
	userID uuid.UUID,
) (map[string]interface{}, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "College service is not configured")
	}
	if collegeID == uuid.Nil || userID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID and User ID are required")
	}

	actorID, _ := database.PlatformUserIDFromContext(ctx)
	if actorID == uuid.Nil {
		return nil, apierrors.New(apierrors.Unauthorized, "Authenticated actor user ID is required")
	}
	actorRole, _ := ctx.Value(ActorRoleContextKey).(string)
	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	admin, err := s.repo.GetCollegeAdminByID(ctx, collegeID, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "Administrator not found for this college")
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to verify administrator: %v", err))
	}

	count, err := s.repo.RevokeCollegeAdminSessions(ctx, collegeID, userID)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to revoke sessions: %v", err))
	}

	_ = s.repo.RecordCollegeAdminPasswordAudit(ctx, repository.CollegeAdminPasswordAuditParams{
		CollegeID:   collegeID,
		ActorUserID: actorID,
		ActorRole:   actorRole,
		Action:      "COLLEGE_ADMIN_SESSIONS_REVOKED",
		AdminEmail:  admin.Email,
	})

	return map[string]interface{}{
		"user_id":               userID,
		"college_id":            collegeID,
		"device_tokens_revoked": count,
		"notice":                "Push device tokens invalidated. Stateless JWT access tokens will naturally expire at their configured duration.",
	}, nil
}

// GetCollegeAdminLoginHistory retrieves security events from platform.login_events.
func (s *CollegeService) GetCollegeAdminLoginHistory(
	ctx context.Context,
	collegeID uuid.UUID,
	userID uuid.UUID,
	limit int,
) ([]models.CollegeAdminLoginHistoryItem, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "College service is not configured")
	}
	if collegeID == uuid.Nil || userID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID and User ID are required")
	}

	// Verify user belongs to this college
	_, err := s.repo.GetCollegeAdminByID(ctx, collegeID, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "Administrator not found for this college")
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to verify administrator: %v", err))
	}

	return s.repo.GetCollegeAdminLoginHistory(ctx, collegeID, userID, limit)
}


