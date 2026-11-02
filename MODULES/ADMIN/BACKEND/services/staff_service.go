package services

import (
	"context"

	"github.com/google/uuid"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/models"
)

// ListStaff returns all college staff profiles.
func (s *StaffService) ListStaff(ctx context.Context, collegeID uuid.UUID) ([]models.Staff, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Staff service is not initialized")
	}
	return s.repo.ListStaff(ctx, collegeID)
}

// ListGates returns all campus gates.
func (s *StaffService) ListGates(ctx context.Context, collegeID uuid.UUID) ([]models.Gate, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Staff service is not initialized")
	}
	return s.repo.ListGates(ctx, collegeID)
}

// ListSecurityAssignments returns all gate guard duty assignments.
func (s *StaffService) ListSecurityAssignments(ctx context.Context, collegeID uuid.UUID) ([]models.SecurityAssignment, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Staff service is not initialized")
	}
	return s.repo.ListSecurityAssignments(ctx, collegeID)
}
