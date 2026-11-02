package services

import (
	"context"

	"github.com/google/uuid"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/models"
)

// ListBedAllocations returns all bed allocation records in the college tenant.
func (s *AllocationService) ListBedAllocations(ctx context.Context, collegeID uuid.UUID) ([]models.BedAllocation, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Allocation service is not initialized")
	}
	return s.repo.ListBedAllocations(ctx, collegeID)
}

// GetCurrentAllocation returns the active bed allocation for a specific student.
func (s *AllocationService) GetCurrentAllocation(ctx context.Context, collegeID, studentID uuid.UUID) (*models.BedAllocation, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Allocation service is not initialized")
	}
	if studentID == uuid.Nil {
		return nil, apierrors.New(apierrors.InvalidInput, "Valid student ID is required")
	}
	return s.repo.GetCurrentAllocation(ctx, collegeID, studentID)
}

