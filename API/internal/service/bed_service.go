package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

type BedService struct {
	repo *repository.Repository
}

func NewBedService(repo *repository.Repository) *BedService {
	return &BedService{
		repo: repo,
	}
}

func (s *BedService) Create(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	blockID uuid.UUID,
	floorID uuid.UUID,
	roomID uuid.UUID,
	code string,
	name *string,
) (repository.Bed, error) {
	return s.repo.CreateBed(
		ctx,
		collegeID,
		hostelID,
		blockID,
		floorID,
		roomID,
		code,
		name,
	)
}

func (s *BedService) Get(
	ctx context.Context,
	collegeID uuid.UUID,
	roomID uuid.UUID,
	bedID uuid.UUID,
) (repository.Bed, error) {
	return s.repo.GetBed(ctx, collegeID, roomID, bedID)
}

func (s *BedService) List(
	ctx context.Context,
	collegeID uuid.UUID,
	roomID uuid.UUID,
) ([]repository.Bed, error) {
	return s.repo.ListBeds(ctx, collegeID, roomID)
}

func (s *BedService) Update(
	ctx context.Context,
	collegeID uuid.UUID,
	roomID uuid.UUID,
	bedID uuid.UUID,
	code string,
	name *string,
) (repository.Bed, error) {
	return s.repo.UpdateBed(
		ctx,
		collegeID,
		roomID,
		bedID,
		code,
		name,
	)
}

func (s *BedService) UpdateStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	roomID uuid.UUID,
	bedID uuid.UUID,
	status string,
) (repository.Bed, error) {
	return s.repo.UpdateBedStatus(
		ctx,
		collegeID,
		roomID,
		bedID,
		status,
	)
}
