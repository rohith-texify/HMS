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

type InchargeHostelService struct {
	db   *database.Database
	repo *repository.Repository
}

func NewInchargeHostelService(
	db *database.Database,
	repo *repository.Repository,
) *InchargeHostelService {
	return &InchargeHostelService{
		db:   db,
		repo: repo,
	}
}

func (s *InchargeHostelService) List(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
) ([]repository.InchargeHostel, error) {
	if collegeID == uuid.Nil {
		return nil, fmt.Errorf("college ID is required")
	}

	if hostelID == uuid.Nil {
		return nil, fmt.Errorf("hostel ID is required")
	}

	return s.repo.ListInchargeHostels(ctx, collegeID, hostelID)
}

func (s *InchargeHostelService) Get(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	assignmentID uuid.UUID,
) (repository.InchargeHostel, error) {
	if collegeID == uuid.Nil {
		return repository.InchargeHostel{}, fmt.Errorf("college ID is required")
	}

	if hostelID == uuid.Nil {
		return repository.InchargeHostel{}, fmt.Errorf("hostel ID is required")
	}

	if assignmentID == uuid.Nil {
		return repository.InchargeHostel{}, fmt.Errorf("assignment ID is required")
	}

	return s.repo.GetInchargeHostel(
		ctx,
		collegeID,
		hostelID,
		assignmentID,
	)
}

func (s *InchargeHostelService) Create(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	staffID uuid.UUID,
	assignedFrom time.Time,
	assignedUntil *time.Time,
	isPrimary bool,
) (repository.InchargeHostel, error) {
	if collegeID == uuid.Nil {
		return repository.InchargeHostel{}, fmt.Errorf("college ID is required")
	}

	if hostelID == uuid.Nil {
		return repository.InchargeHostel{}, fmt.Errorf("hostel ID is required")
	}

	if staffID == uuid.Nil {
		return repository.InchargeHostel{}, fmt.Errorf("staff ID is required")
	}

	if assignedFrom.IsZero() {
		assignedFrom = time.Now().UTC()
	}

	if assignedUntil != nil && assignedUntil.Before(assignedFrom) {
		return repository.InchargeHostel{}, fmt.Errorf(
			"assigned_until must be greater than or equal to assigned_from",
		)
	}

	var result repository.InchargeHostel

	err := s.db.WithTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
		_ = tx

		if isPrimary {
			if err := s.repo.ClearPrimaryIncharge(
				txCtx,
				collegeID,
				hostelID,
			); err != nil {
				return err
			}
		}

		var err error

		result, err = s.repo.CreateInchargeHostel(
			txCtx,
			collegeID,
			staffID,
			hostelID,
			assignedFrom,
			assignedUntil,
			isPrimary,
		)

		return err
	})

	if err != nil {
		return repository.InchargeHostel{}, err
	}

	return result, nil
}

func (s *InchargeHostelService) Update(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	assignmentID uuid.UUID,
	assignedFrom time.Time,
	assignedUntil *time.Time,
	isPrimary bool,
) (repository.InchargeHostel, error) {
	if collegeID == uuid.Nil {
		return repository.InchargeHostel{}, fmt.Errorf("college ID is required")
	}

	if hostelID == uuid.Nil {
		return repository.InchargeHostel{}, fmt.Errorf("hostel ID is required")
	}

	if assignmentID == uuid.Nil {
		return repository.InchargeHostel{}, fmt.Errorf("assignment ID is required")
	}

	if assignedFrom.IsZero() {
		return repository.InchargeHostel{}, fmt.Errorf(
			"assigned_from is required",
		)
	}

	if assignedUntil != nil && assignedUntil.Before(assignedFrom) {
		return repository.InchargeHostel{}, fmt.Errorf(
			"assigned_until must be greater than or equal to assigned_from",
		)
	}

	var result repository.InchargeHostel

	err := s.db.WithTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
		_ = tx

		if isPrimary {
			if err := s.repo.ClearPrimaryIncharge(
				txCtx,
				collegeID,
				hostelID,
			); err != nil {
				return err
			}
		}

		var err error

		result, err = s.repo.UpdateInchargeHostel(
			txCtx,
			collegeID,
			hostelID,
			assignmentID,
			assignedFrom,
			assignedUntil,
			isPrimary,
		)

		return err
	})

	if err != nil {
		return repository.InchargeHostel{}, err
	}

	return result, nil
}

func (s *InchargeHostelService) Delete(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	assignmentID uuid.UUID,
) error {
	if collegeID == uuid.Nil {
		return fmt.Errorf("college ID is required")
	}

	if hostelID == uuid.Nil {
		return fmt.Errorf("hostel ID is required")
	}

	if assignmentID == uuid.Nil {
		return fmt.Errorf("assignment ID is required")
	}

	return s.repo.DeleteInchargeHostel(
		ctx,
		collegeID,
		hostelID,
		assignmentID,
	)
}

func normalizeName(value string) string {
	return strings.TrimSpace(value)
}
