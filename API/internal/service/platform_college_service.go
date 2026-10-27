package service

import (
	"context"
	"fmt"

	"github.com/yourusername/hostel-management-system/API/internal/database"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

type PlatformCollegeService struct {
	repo *repository.Repository
	db   *database.Database
}

func NewPlatformCollegeService(
	db *database.Database,
	repo *repository.Repository,
) *PlatformCollegeService {
	return &PlatformCollegeService{
		repo: repo,
		db:   db,
	}
}

func (s *PlatformCollegeService) ListColleges(
	ctx context.Context,
) ([]repository.PlatformCollege, error) {
	colleges, err := s.repo.ListColleges(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list colleges: %w", err)
	}

	return colleges, nil
}
