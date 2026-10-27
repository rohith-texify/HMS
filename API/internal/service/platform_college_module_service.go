package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/internal/database"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

type PlatformCollegeModuleService struct {
	db   *database.Database
	repo *repository.Repository
}

func NewPlatformCollegeModuleService(
	db *database.Database,
	repo *repository.Repository,
) *PlatformCollegeModuleService {
	return &PlatformCollegeModuleService{
		db:   db,
		repo: repo,
	}
}

func (s *PlatformCollegeModuleService) ListCollegeModules(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]repository.CollegeModule, error) {
	if collegeID == uuid.Nil {
		return nil, fmt.Errorf(
			"college ID is required",
		)
	}

	modules, err := s.repo.ListCollegeModules(
		ctx,
		collegeID,
	)
	if err != nil {
		return nil, fmt.Errorf(
			"failed to list college modules: %w",
			err,
		)
	}

	return modules, nil
}

type AssignCollegeModuleRequest struct {
	ModuleID      uuid.UUID
	Status        string
	Mode          string
	EffectiveFrom *time.Time
	EffectiveTo   *time.Time
	ChangeReason  *string
	ChangedBy     uuid.UUID
}

func (s *PlatformCollegeModuleService) AssignCollegeModule(
	ctx context.Context,
	collegeID uuid.UUID,
	req AssignCollegeModuleRequest,
) (repository.CollegeModule, error) {
	if collegeID == uuid.Nil {
		return repository.CollegeModule{}, fmt.Errorf(
			"college ID is required",
		)
	}

	if req.ModuleID == uuid.Nil {
		return repository.CollegeModule{}, fmt.Errorf(
			"module ID is required",
		)
	}

	if req.ChangedBy == uuid.Nil {
		return repository.CollegeModule{}, fmt.Errorf(
			"changed_by user ID is required",
		)
	}

	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	req.Mode = strings.ToUpper(strings.TrimSpace(req.Mode))

	if req.Status == "" {
		return repository.CollegeModule{}, fmt.Errorf(
			"status is required",
		)
	}

	switch req.Status {
	case "ACTIVE", "DISABLED", "SCHEDULED":
	default:
		return repository.CollegeModule{}, fmt.Errorf(
			"status must be ACTIVE, DISABLED or SCHEDULED",
		)
	}

	if req.Mode == "" {
		return repository.CollegeModule{}, fmt.Errorf(
			"mode is required",
		)
	}

	switch req.Mode {
	case "FULL", "READ_ONLY":
	default:
		return repository.CollegeModule{}, fmt.Errorf(
			"mode must be FULL or READ_ONLY",
		)
	}

	// The database requires:
	// effective_to > effective_from
	if req.EffectiveFrom != nil &&
		req.EffectiveTo != nil &&
		!req.EffectiveTo.After(*req.EffectiveFrom) {
		return repository.CollegeModule{}, fmt.Errorf(
			"effective_to must be later than effective_from",
		)
	}

	params := repository.AssignCollegeModuleParams{
		CollegeID:     collegeID,
		ModuleID:      req.ModuleID,
		Status:        req.Status,
		Mode:          req.Mode,
		EffectiveFrom: req.EffectiveFrom,
		EffectiveTo:   req.EffectiveTo,
		ChangeReason:  req.ChangeReason,
		ChangedBy:     req.ChangedBy,
	}

	var result repository.CollegeModule

	err := s.db.WithPlatformTransaction(
		ctx,
		func(txCtx context.Context, _ pgx.Tx) error {
			var err error

			result, err = s.repo.AssignCollegeModule(
				txCtx,
				params,
			)

			return err
		},
	)

	if err != nil {
		return repository.CollegeModule{}, err
	}

	return result, nil
}

func (s *PlatformCollegeModuleService) UpdateCollegeEntitlement(
	ctx context.Context,
	collegeID uuid.UUID,
	req AssignCollegeModuleRequest,
) (repository.CollegeModule, error) {
	if collegeID == uuid.Nil {
		return repository.CollegeModule{}, fmt.Errorf(
			"college ID is required",
		)
	}

	if req.ModuleID == uuid.Nil {
		return repository.CollegeModule{}, fmt.Errorf(
			"module ID is required",
		)
	}

	if req.ChangedBy == uuid.Nil {
		return repository.CollegeModule{}, fmt.Errorf(
			"changed_by user ID is required",
		)
	}

	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	req.Mode = strings.ToUpper(strings.TrimSpace(req.Mode))

	switch req.Status {
	case "ACTIVE", "DISABLED", "SCHEDULED":
	default:
		return repository.CollegeModule{}, fmt.Errorf(
			"status must be ACTIVE, DISABLED or SCHEDULED",
		)
	}

	switch req.Mode {
	case "FULL", "READ_ONLY":
	default:
		return repository.CollegeModule{}, fmt.Errorf(
			"mode must be FULL or READ_ONLY",
		)
	}

	if req.EffectiveFrom == nil {
		return repository.CollegeModule{}, fmt.Errorf(
			"effective_from is required",
		)
	}

	if req.EffectiveTo != nil &&
		!req.EffectiveTo.After(*req.EffectiveFrom) {
		return repository.CollegeModule{}, fmt.Errorf(
			"effective_to must be later than effective_from",
		)
	}

	params := repository.UpdateCollegeEntitlementParams{
		ModuleID:      req.ModuleID,
		Status:        req.Status,
		Mode:          req.Mode,
		EffectiveFrom: req.EffectiveFrom,
		EffectiveTo:   req.EffectiveTo,
		ChangeReason:  req.ChangeReason,
		ChangedBy:     req.ChangedBy,
	}

	var result repository.CollegeModule

	err := s.db.WithPlatformTransaction(
		ctx,
		func(txCtx context.Context, _ pgx.Tx) error {
			var err error

			result, err = s.repo.UpdateCollegeEntitlement(
				txCtx,
				collegeID,
				params,
			)

			return err
		},
	)

	if err != nil {
		return repository.CollegeModule{}, err
	}

	return result, nil
}
