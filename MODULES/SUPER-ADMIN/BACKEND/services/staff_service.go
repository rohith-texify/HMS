package services

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/database"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
)

// StaffService provides business logic for company / platform staff management.
type StaffService struct {
	db   *database.Database
	repo *repository.Repository
}

// NewStaffService creates a new StaffService.
func NewStaffService(db *database.Database, repo *repository.Repository) *StaffService {
	return &StaffService{
		db:   db,
		repo: repo,
	}
}

// ListPlatformStaff lists all company / platform staff accounts.
func (s *StaffService) ListPlatformStaff(
	ctx context.Context,
	params models.ListPlatformStaffParams,
) (*models.ListPlatformStaffResponse, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Staff service is not configured")
	}

	limit := params.Limit
	if limit <= 0 {
		limit = 20
	}
	offset := params.Offset
	if offset < 0 {
		offset = 0
	}

	staffList, total, err := s.repo.ListPlatformStaff(ctx, params.Status, limit, offset)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to list platform staff: %v", err))
	}

	return &models.ListPlatformStaffResponse{
		Staff:  staffList,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	}, nil
}

// GetPlatformStaff retrieves details for a single platform staff member.
func (s *StaffService) GetPlatformStaff(
	ctx context.Context,
	userID uuid.UUID,
) (*models.PlatformStaffAccount, error) {
	if userID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "User ID is required")
	}
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Staff service is not configured")
	}

	staff, err := s.repo.GetPlatformStaffByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "Platform staff member not found")
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to get platform staff: %v", err))
	}

	return staff, nil
}

// UpdatePlatformStaffProfile updates permitted fields (e.g. phone) of a platform staff account.
func (s *StaffService) UpdatePlatformStaffProfile(
	ctx context.Context,
	userID uuid.UUID,
	req models.UpdatePlatformStaffProfileRequest,
) (*models.PlatformStaffAccount, error) {
	if userID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "User ID is required")
	}
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "Staff service is not configured")
	}

	actorID, _ := database.PlatformUserIDFromContext(ctx)
	if actorID == uuid.Nil {
		return nil, apierrors.New(apierrors.Unauthorized, "Authenticated actor user ID is required")
	}
	actorRole, _ := ctx.Value(ActorRoleContextKey).(string)
	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	var updated *models.PlatformStaffAccount
	err := s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var txErr error
		updated, txErr = s.repo.UpdatePlatformStaffProfile(txCtx, userID, req.Phone)
		if txErr != nil {
			return txErr
		}

		return s.repo.RecordPlatformStaffAudit(txCtx, repository.PlatformStaffAuditParams{
			ActorUserID: actorID,
			ActorRole:   actorRole,
			TargetStaff: userID,
			Action:      "PLATFORM_STAFF_PROFILE_UPDATED",
			Email:       updated.Email,
			Details: map[string]interface{}{
				"phone": req.Phone,
			},
		})
	})

	if err != nil {
		if strings.Contains(err.Error(), "not found") || errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "Platform staff member not found")
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to update staff profile: %v", err))
	}

	return updated, nil
}

// UpdatePlatformStaffStatus updates account status while enforcing Last Platform Owner / Super Admin protection.
func (s *StaffService) UpdatePlatformStaffStatus(
	ctx context.Context,
	userID uuid.UUID,
	req models.UpdatePlatformStaffStatusRequest,
) (*models.PlatformStaffAccount, error) {
	if userID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "User ID is required")
	}
	if strings.TrimSpace(req.Reason) == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Reason for status change is required")
	}

	actorID, _ := database.PlatformUserIDFromContext(ctx)
	// Prevent self-deactivation if caller is modifying their own account
	if actorID != uuid.Nil && actorID == userID && (req.Status == "DEACTIVATED" || req.Status == "SUSPENDED") {
		return nil, apierrors.New(apierrors.Conflict, "Self-deactivation is prohibited. Another authorized administrator must execute offboarding.")
	}

	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "Staff service is not configured")
	}
	if actorID == uuid.Nil {
		return nil, apierrors.New(apierrors.Unauthorized, "Authenticated actor user ID is required")
	}
	actorRole, _ := ctx.Value(ActorRoleContextKey).(string)
	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	var updated *models.PlatformStaffAccount
	err := s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var txErr error
		updated, txErr = s.repo.UpdatePlatformStaffStatus(txCtx, userID, req.Status)
		if txErr != nil {
			return txErr
		}

		return s.repo.RecordPlatformStaffAudit(txCtx, repository.PlatformStaffAuditParams{
			ActorUserID: actorID,
			ActorRole:   actorRole,
			TargetStaff: userID,
			Action:      fmt.Sprintf("PLATFORM_STAFF_STATUS_%s", req.Status),
			Email:       updated.Email,
			Details: map[string]interface{}{
				"status": req.Status,
				"reason": req.Reason,
			},
		})
	})

	if err != nil {
		if strings.Contains(err.Error(), "last active Platform Owner") {
			return nil, apierrors.New(apierrors.Conflict, "Cannot deactivate the last active Platform Owner / Super Administrator")
		}
		if strings.Contains(err.Error(), "not found") || errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "Platform staff member not found")
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to update staff status: %v", err))
	}

	return updated, nil
}

// GetPlatformStaffPendingApprovals lists active pending approvals owned by this staff member.
func (s *StaffService) GetPlatformStaffPendingApprovals(
	ctx context.Context,
	userID uuid.UUID,
) (*models.StaffPendingApprovalsResponse, error) {
	if userID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "User ID is required")
	}
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Staff service is not configured")
	}

	// Verify user exists
	_, err := s.repo.GetPlatformStaffByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "Platform staff member not found")
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to verify staff member: %v", err))
	}

	items, err := s.repo.GetPlatformStaffPendingApprovals(ctx, userID)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to query pending approvals: %v", err))
	}

	return &models.StaffPendingApprovalsResponse{
		UserID:           userID,
		PendingApprovals: items,
		TotalPending:     len(items),
	}, nil
}
