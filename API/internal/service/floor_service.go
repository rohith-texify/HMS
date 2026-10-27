package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

type FloorService struct {
	repo *repository.Repository
}

func NewFloorService(repo *repository.Repository) *FloorService {
	return &FloorService{
		repo: repo,
	}
}

func (s *FloorService) Create(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	blockID uuid.UUID,
	code string,
	name string,
	floorNumber int,
	description *string,
) (repository.Floor, error) {
	return s.repo.CreateFloor(
		ctx,
		collegeID,
		hostelID,
		blockID,
		code,
		name,
		floorNumber,
		description,
	)
}

func (s *FloorService) Get(
	ctx context.Context,
	collegeID uuid.UUID,
	blockID uuid.UUID,
	floorID uuid.UUID,
) (repository.Floor, error) {
	return s.repo.GetFloor(ctx, collegeID, blockID, floorID)
}

func (s *FloorService) List(
	ctx context.Context,
	collegeID uuid.UUID,
	blockID uuid.UUID,
) ([]repository.Floor, error) {
	return s.repo.ListFloors(ctx, collegeID, blockID)
}

func (s *FloorService) Update(
	ctx context.Context,
	collegeID uuid.UUID,
	blockID uuid.UUID,
	floorID uuid.UUID,
	code string,
	name string,
	floorNumber int,
	description *string,
) (repository.Floor, error) {
	return s.repo.UpdateFloor(
		ctx,
		collegeID,
		blockID,
		floorID,
		code,
		name,
		floorNumber,
		description,
	)
}

func (s *FloorService) UpdateStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	blockID uuid.UUID,
	floorID uuid.UUID,
	status string,
) (repository.Floor, error) {
	return s.repo.UpdateFloorStatus(
		ctx,
		collegeID,
		blockID,
		floorID,
		status,
	)
}
