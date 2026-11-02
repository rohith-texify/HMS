package services

import (
	"context"

	"github.com/google/uuid"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/models"
)

// ListMealTimings returns dining operational hours for a hostel.
func (s *MessService) ListMealTimings(ctx context.Context, collegeID, hostelID uuid.UUID) ([]models.MealTiming, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Mess service is not initialized")
	}
	return s.repo.ListMealTimings(ctx, collegeID, hostelID)
}

// ListMealMenus returns dining menus for a hostel.
func (s *MessService) ListMealMenus(ctx context.Context, collegeID, hostelID uuid.UUID) ([]models.MealMenu, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Mess service is not initialized")
	}
	return s.repo.ListMealMenus(ctx, collegeID, hostelID)
}

