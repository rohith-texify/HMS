package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

type UpdateCollegeInput struct {
	CollegeCode string
	Name        string
	Timezone    string
}

func (s *PlatformCollegeService) UpdateCollege(
	ctx context.Context,
	collegeID uuid.UUID,
	input UpdateCollegeInput,
) (repository.PlatformCollege, error) {
	if collegeID == uuid.Nil {
		return repository.PlatformCollege{}, fmt.Errorf(
			"college ID is required",
		)
	}

	input.CollegeCode = strings.TrimSpace(input.CollegeCode)
	input.Name = strings.TrimSpace(input.Name)
	input.Timezone = strings.TrimSpace(input.Timezone)

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

	if input.Timezone == "" {
		return repository.PlatformCollege{}, fmt.Errorf(
			"timezone is required",
		)
	}

	var college repository.PlatformCollege

	err := s.db.WithPlatformTransaction(
		ctx,
		func(txCtx context.Context, _ pgx.Tx) error {
			var err error

			college, err = s.repo.UpdateCollege(
				txCtx,
				collegeID,
				repository.UpdateCollegeParams{
					CollegeCode: input.CollegeCode,
					Name:        input.Name,
					Timezone:    input.Timezone,
				},
			)

			return err
		},
	)

	if err != nil {
		return repository.PlatformCollege{}, fmt.Errorf(
			"failed to update college: %w",
			err,
		)
	}

	return college, nil
}
