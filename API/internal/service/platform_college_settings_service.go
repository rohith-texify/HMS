package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/internal/database"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

type PlatformCollegeSettingsService struct {
	db   *database.Database
	repo *repository.Repository
}

func NewPlatformCollegeSettingsService(
	db *database.Database,
	repo *repository.Repository,
) *PlatformCollegeSettingsService {
	return &PlatformCollegeSettingsService{
		db:   db,
		repo: repo,
	}
}

func (s *PlatformCollegeSettingsService) ListSettings(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]repository.CollegeSetting, error) {
	if collegeID == uuid.Nil {
		return nil, fmt.Errorf("college_id is required")
	}

	return s.repo.ListCollegeSettings(ctx, collegeID)
}

func (s *PlatformCollegeSettingsService) UpdateSetting(
	ctx context.Context,
	collegeID uuid.UUID,
	key string,
	value string,
	changedBy uuid.UUID,
) (repository.CollegeSetting, error) {
	if collegeID == uuid.Nil {
		return repository.CollegeSetting{}, fmt.Errorf("college_id is required")
	}

	if changedBy == uuid.Nil {
		return repository.CollegeSetting{}, fmt.Errorf("changed_by is required")
	}

	key = strings.TrimSpace(key)
	value = strings.TrimSpace(value)

	if key == "" {
		return repository.CollegeSetting{}, fmt.Errorf("setting key is required")
	}

	if value == "" {
		return repository.CollegeSetting{}, fmt.Errorf("setting value is required")
	}

	var setting repository.CollegeSetting

	err := s.db.WithPlatformTransaction(
		ctx,
		func(txCtx context.Context, _ pgx.Tx) error {
			var err error

			setting, err = s.repo.UpsertCollegeSetting(
				txCtx,
				collegeID,
				key,
				value,
			)
			if err != nil {
				return err
			}

			return nil
		},
	)

	if err != nil {
		return repository.CollegeSetting{}, fmt.Errorf(
			"failed to update college setting: %w",
			err,
		)
	}

	return setting, nil
}
