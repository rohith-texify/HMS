package services

import (
	"context"

	"github.com/google/uuid"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/models"
)

// ListHostels returns all hostels belonging to the college tenant.
func (s *HostelService) ListHostels(ctx context.Context, collegeID uuid.UUID) ([]models.Hostel, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Hostel service is not initialized")
	}
	return s.repo.ListHostels(ctx, collegeID)
}

// ListBlocks returns all blocks for a given hostel.
func (s *HostelService) ListBlocks(ctx context.Context, collegeID, hostelID uuid.UUID) ([]models.Block, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Hostel service is not initialized")
	}
	if hostelID == uuid.Nil {
		return nil, apierrors.New(apierrors.InvalidInput, "Valid hostel ID is required")
	}
	return s.repo.ListBlocks(ctx, collegeID, hostelID)
}

// ListFloors returns all floors for a given block.
func (s *HostelService) ListFloors(ctx context.Context, collegeID, blockID uuid.UUID) ([]models.Floor, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Hostel service is not initialized")
	}
	if blockID == uuid.Nil {
		return nil, apierrors.New(apierrors.InvalidInput, "Valid block ID is required")
	}
	return s.repo.ListFloors(ctx, collegeID, blockID)
}

// ListRooms returns all rooms for a given floor.
func (s *HostelService) ListRooms(ctx context.Context, collegeID, floorID uuid.UUID) ([]models.Room, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Hostel service is not initialized")
	}
	if floorID == uuid.Nil {
		return nil, apierrors.New(apierrors.InvalidInput, "Valid floor ID is required")
	}
	return s.repo.ListRooms(ctx, collegeID, floorID)
}

// ListBeds returns all beds for a given room.
func (s *HostelService) ListBeds(ctx context.Context, collegeID, roomID uuid.UUID) ([]models.Bed, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Hostel service is not initialized")
	}
	if roomID == uuid.Nil {
		return nil, apierrors.New(apierrors.InvalidInput, "Valid room ID is required")
	}
	return s.repo.ListBeds(ctx, collegeID, roomID)
}
