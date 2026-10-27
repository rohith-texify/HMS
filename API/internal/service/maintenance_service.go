package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/yourusername/hostel-management-system/API/internal/database"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

var (
	ErrInvalidMaintenanceType   = errors.New("invalid maintenance type")
	ErrInvalidMaintenanceStatus = errors.New("invalid maintenance status")
	ErrMaintenanceDatesInvalid  = errors.New("expected end date must be after started at date")
)

type MaintenanceService struct {
	db   *database.Database
	repo *repository.Repository
}

func NewMaintenanceService(db *database.Database, repo *repository.Repository) *MaintenanceService {
	return &MaintenanceService{
		db:   db,
		repo: repo,
	}
}

type CreateMaintenanceRequest struct {
	RoomID          uuid.UUID  `json:"room_id" binding:"required"`
	MaintenanceType string     `json:"maintenance_type" binding:"required"`
	Reason          string     `json:"reason" binding:"required"`
	StartedAt       time.Time  `json:"started_at" binding:"required"`
	ExpectedEndAt   *time.Time `json:"expected_end_at,omitempty"`
}

type ResolveMaintenanceRequest struct {
	Remarks string `json:"remarks" binding:"required"`
}

func isValidMaintenanceType(t string) bool {
	valid := []string{"GENERAL", "ELECTRICAL", "PLUMBING", "CIVIL", "FURNITURE", "CLEANING", "SAFETY", "OTHER"}
	for _, v := range valid {
		if v == t {
			return true
		}
	}
	return false
}

func (s *MaintenanceService) CreateMaintenance(ctx context.Context, collegeID, reportedBy uuid.UUID, req CreateMaintenanceRequest) (*repository.RoomMaintenance, error) {
	if !isValidMaintenanceType(req.MaintenanceType) {
		return nil, ErrInvalidMaintenanceType
	}
	if req.ExpectedEndAt != nil && req.ExpectedEndAt.Before(req.StartedAt) {
		return nil, ErrMaintenanceDatesInvalid
	}

	rm := &repository.RoomMaintenance{
		CollegeID:       collegeID,
		RoomID:          req.RoomID,
		MaintenanceType: repository.MaintenanceType(req.MaintenanceType),
		Reason:          strings.TrimSpace(req.Reason),
		StartedAt:       req.StartedAt,
		ExpectedEndAt:   req.ExpectedEndAt,
		Status:          repository.RoomMaintenanceStatusOpen,
		ReportedBy:      &reportedBy,
	}

	if err := s.repo.CreateRoomMaintenance(ctx, rm); err != nil {
		return nil, err
	}

	return rm, nil
}

func (s *MaintenanceService) GetMaintenance(ctx context.Context, collegeID, id uuid.UUID) (*repository.RoomMaintenance, error) {
	return s.repo.GetRoomMaintenance(ctx, collegeID, id)
}

func (s *MaintenanceService) ListMaintenance(ctx context.Context, collegeID uuid.UUID) ([]repository.RoomMaintenance, error) {
	return s.repo.ListRoomMaintenance(ctx, collegeID)
}

func (s *MaintenanceService) ResolveMaintenance(ctx context.Context, collegeID, id, resolvedBy uuid.UUID, req ResolveMaintenanceRequest) error {
	return s.db.WithTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
		rm, err := s.repo.GetRoomMaintenance(txCtx, collegeID, id)
		if err != nil {
			return err
		}

		if rm.Status == repository.RoomMaintenanceStatusCompleted || rm.Status == repository.RoomMaintenanceStatusCancelled {
			return ErrInvalidMaintenanceStatus
		}

		rm.Status = repository.RoomMaintenanceStatusCompleted
		rm.ResolvedBy = &resolvedBy
		now := time.Now()
		rm.CompletedAt = &now
		rm.Remarks = &req.Remarks

		return s.repo.UpdateRoomMaintenanceState(txCtx, rm)
	})
}
