package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

type BlockService struct {
	repo *repository.Repository
}

func NewBlockService(repo *repository.Repository) *BlockService {
	return &BlockService{
		repo: repo,
	}
}

func (s *BlockService) Create(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	code string,
	name string,
	description *string,
) (repository.Block, error) {
	return s.repo.CreateBlock(
		ctx,
		collegeID,
		hostelID,
		code,
		name,
		description,
	)
}

func (s *BlockService) Get(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	blockID uuid.UUID,
) (repository.Block, error) {
	return s.repo.GetBlock(ctx, collegeID, hostelID, blockID)
}

func (s *BlockService) List(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
) ([]repository.Block, error) {
	return s.repo.ListBlocks(ctx, collegeID, hostelID)
}

func (s *BlockService) Update(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	blockID uuid.UUID,
	code string,
	name string,
	description *string,
) (repository.Block, error) {
	return s.repo.UpdateBlock(
		ctx,
		collegeID,
		hostelID,
		blockID,
		code,
		name,
		description,
	)
}

func (s *BlockService) UpdateStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	blockID uuid.UUID,
	status string,
) (repository.Block, error) {
	return s.repo.UpdateBlockStatus(
		ctx,
		collegeID,
		hostelID,
		blockID,
		status,
	)
}
