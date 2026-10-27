package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

func (s *PlatformCollegeService) GetCollege(
	ctx context.Context,
	collegeID uuid.UUID,
) (repository.PlatformCollege, error) {
	if collegeID == uuid.Nil {
		return repository.PlatformCollege{}, fmt.Errorf(
			"college ID is required",
		)
	}

	college, err := s.repo.GetCollege(
		ctx,
		collegeID,
	)
	if err != nil {
		return repository.PlatformCollege{}, fmt.Errorf(
			"failed to get college: %w",
			err,
		)
	}

	return college, nil
}
