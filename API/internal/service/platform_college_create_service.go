package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

type CreateCollegeInput struct {
	CollegeCode string
	Name        string
}

func (s *PlatformCollegeService) CreateCollege(
	ctx context.Context,
	input CreateCollegeInput,
) (repository.PlatformCollege, error) {
	input.CollegeCode = strings.TrimSpace(input.CollegeCode)
	input.Name = strings.TrimSpace(input.Name)

	if input.CollegeCode == "" {
		return repository.PlatformCollege{}, fmt.Errorf(
			"college code is required",
		)
	}

	if input.Name == "" {
		return repository.PlatformCollege{}, fmt.Errorf(
			"college name is required",
		)
	}

	var college repository.PlatformCollege

	err := s.db.WithPlatformTransaction(
		ctx,
		func(txCtx context.Context, _ pgx.Tx) error {
			var err error

			college, err = s.repo.CreateCollege(
				txCtx,
				repository.CreateCollegeParams{
					CollegeCode: input.CollegeCode,
					Name:        input.Name,
				},
			)
			if err != nil {
				return err
			}

			if err := s.repo.CreateInitialCollegeOnboardingSteps(
				txCtx,
				college.CollegeID,
			); err != nil {
				return err
			}

			return nil
		},
	)
	if err != nil {
		return repository.PlatformCollege{}, fmt.Errorf(
			"failed to create college: %w",
			err,
		)
	}

	return college, nil
}
