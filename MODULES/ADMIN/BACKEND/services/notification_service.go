package services

import (
	"context"

	"github.com/google/uuid"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/models"
)

// ListNotifications returns broadcast notices for the college.
func (s *NotificationService) ListNotifications(ctx context.Context, collegeID uuid.UUID) ([]models.Notification, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Notification service is not initialized")
	}
	return s.repo.ListNotifications(ctx, collegeID)
}
