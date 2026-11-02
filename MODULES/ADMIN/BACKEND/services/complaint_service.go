package services

import (
	"context"

	"github.com/google/uuid"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/models"
)

// ListComplaints returns maintenance tickets in the college.
func (s *ComplaintService) ListComplaints(ctx context.Context, collegeID uuid.UUID) ([]models.Complaint, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Complaint service is not initialized")
	}
	return s.repo.ListComplaints(ctx, collegeID)
}

// GetComplaintSummary returns service desk metrics.
func (s *ComplaintService) GetComplaintSummary(ctx context.Context, collegeID uuid.UUID) (*models.ComplaintSummary, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Complaint service is not initialized")
	}
	return s.repo.GetComplaintSummary(ctx, collegeID)
}

