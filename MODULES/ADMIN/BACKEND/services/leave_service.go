package services

import (
	"context"

	"github.com/google/uuid"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/models"
)

// ListLeaveRequests returns leave applications for review by college administration.
func (s *LeaveService) ListLeaveRequests(ctx context.Context, collegeID uuid.UUID) ([]models.LeaveRequest, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Leave service is not initialized")
	}
	return s.repo.ListLeaveRequests(ctx, collegeID)
}

// GetLeaveSummary returns aggregated status counts for student leaves.
func (s *LeaveService) GetLeaveSummary(ctx context.Context, collegeID uuid.UUID) (*models.LeaveSummary, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Leave service is not initialized")
	}
	return s.repo.GetLeaveSummary(ctx, collegeID)
}
