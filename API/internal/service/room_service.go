package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

type RoomService struct {
	repo *repository.Repository
}

func NewRoomService(repo *repository.Repository) *RoomService {
	return &RoomService{
		repo: repo,
	}
}

func (s *RoomService) Create(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	blockID uuid.UUID,
	floorID uuid.UUID,
	code string,
	name string,
	roomType string,
	capacity int,
	description *string,
) (repository.Room, error) {
	return s.repo.CreateRoom(
		ctx,
		collegeID,
		hostelID,
		blockID,
		floorID,
		code,
		name,
		roomType,
		capacity,
		description,
	)
}

func (s *RoomService) Get(
	ctx context.Context,
	collegeID uuid.UUID,
	floorID uuid.UUID,
	roomID uuid.UUID,
) (repository.Room, error) {
	return s.repo.GetRoom(ctx, collegeID, floorID, roomID)
}

func (s *RoomService) List(
	ctx context.Context,
	collegeID uuid.UUID,
	floorID uuid.UUID,
) ([]repository.Room, error) {
	return s.repo.ListRooms(ctx, collegeID, floorID)
}

func (s *RoomService) Update(
	ctx context.Context,
	collegeID uuid.UUID,
	floorID uuid.UUID,
	roomID uuid.UUID,
	code string,
	name string,
	roomType string,
	capacity int,
	description *string,
) (repository.Room, error) {
	return s.repo.UpdateRoom(
		ctx,
		collegeID,
		floorID,
		roomID,
		code,
		name,
		roomType,
		capacity,
		description,
	)
}

func (s *RoomService) UpdateStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	floorID uuid.UUID,
	roomID uuid.UUID,
	status string,
) (repository.Room, error) {
	return s.repo.UpdateRoomStatus(
		ctx,
		collegeID,
		floorID,
		roomID,
		status,
	)
}
