package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type MaintenanceType string
type RoomMaintenanceStatus string

const (
	MaintenanceTypeGeneral    MaintenanceType = "GENERAL"
	MaintenanceTypeElectrical MaintenanceType = "ELECTRICAL"
	MaintenanceTypePlumbing   MaintenanceType = "PLUMBING"
	MaintenanceTypeCivil      MaintenanceType = "CIVIL"
	MaintenanceTypeFurniture  MaintenanceType = "FURNITURE"
	MaintenanceTypeCleaning   MaintenanceType = "CLEANING"
	MaintenanceTypeSafety     MaintenanceType = "SAFETY"
	MaintenanceTypeOther      MaintenanceType = "OTHER"

	RoomMaintenanceStatusOpen       RoomMaintenanceStatus = "OPEN"
	RoomMaintenanceStatusInProgress RoomMaintenanceStatus = "IN_PROGRESS"
	RoomMaintenanceStatusCompleted  RoomMaintenanceStatus = "COMPLETED"
	RoomMaintenanceStatusCancelled  RoomMaintenanceStatus = "CANCELLED"
)

type RoomMaintenance struct {
	ID              uuid.UUID             `json:"id"`
	CollegeID       uuid.UUID             `json:"college_id"`
	RoomID          uuid.UUID             `json:"room_id"`
	MaintenanceType MaintenanceType       `json:"maintenance_type"`
	Reason          string                `json:"reason"`
	StartedAt       time.Time             `json:"started_at"`
	ExpectedEndAt   *time.Time            `json:"expected_end_at,omitempty"`
	CompletedAt     *time.Time            `json:"completed_at,omitempty"`
	Status          RoomMaintenanceStatus `json:"status"`
	ReportedBy      *uuid.UUID            `json:"reported_by,omitempty"`
	ResolvedBy      *uuid.UUID            `json:"resolved_by,omitempty"`
	Remarks         *string               `json:"remarks,omitempty"`
	CreatedAt       time.Time             `json:"created_at"`
	UpdatedAt       time.Time             `json:"updated_at"`
}

var ErrMaintenanceNotFound = ErrNotFound

func (r *Repository) CreateRoomMaintenance(ctx context.Context, rm *RoomMaintenance) error {
	query := `
		INSERT INTO app.room_maintenance (college_id, room_id, maintenance_type, reason, started_at, expected_end_at, status, reported_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
		RETURNING id, created_at, updated_at
	`
	err := r.Executor(ctx).QueryRow(ctx, query,
		rm.CollegeID, rm.RoomID, rm.MaintenanceType, rm.Reason, rm.StartedAt, rm.ExpectedEndAt, rm.Status, rm.ReportedBy,
	).Scan(&rm.ID, &rm.CreatedAt, &rm.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create room maintenance: %w", err)
	}
	return nil
}

func (r *Repository) GetRoomMaintenance(ctx context.Context, collegeID, id uuid.UUID) (*RoomMaintenance, error) {
	query := `
		SELECT id, college_id, room_id, maintenance_type, reason, started_at, expected_end_at, completed_at, status, reported_by, resolved_by, remarks, created_at, updated_at
		FROM app.room_maintenance
		WHERE college_id = $1 AND id = $2
	`
	var rm RoomMaintenance
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID, id).Scan(
		&rm.ID, &rm.CollegeID, &rm.RoomID, &rm.MaintenanceType, &rm.Reason, &rm.StartedAt, &rm.ExpectedEndAt, &rm.CompletedAt, &rm.Status, &rm.ReportedBy, &rm.ResolvedBy, &rm.Remarks, &rm.CreatedAt, &rm.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrMaintenanceNotFound
		}
		return nil, err
	}
	return &rm, nil
}

func (r *Repository) ListRoomMaintenance(ctx context.Context, collegeID uuid.UUID) ([]RoomMaintenance, error) {
	query := `
		SELECT id, college_id, room_id, maintenance_type, reason, started_at, expected_end_at, completed_at, status, reported_by, resolved_by, remarks, created_at, updated_at
		FROM app.room_maintenance
		WHERE college_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.Executor(ctx).Query(ctx, query, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []RoomMaintenance
	for rows.Next() {
		var rm RoomMaintenance
		if err := rows.Scan(&rm.ID, &rm.CollegeID, &rm.RoomID, &rm.MaintenanceType, &rm.Reason, &rm.StartedAt, &rm.ExpectedEndAt, &rm.CompletedAt, &rm.Status, &rm.ReportedBy, &rm.ResolvedBy, &rm.Remarks, &rm.CreatedAt, &rm.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, rm)
	}
	return list, nil
}

func (r *Repository) UpdateRoomMaintenanceState(ctx context.Context, rm *RoomMaintenance) error {
	query := `
		UPDATE app.room_maintenance
		SET status = $1, resolved_by = $2, completed_at = $3, remarks = $4, updated_at = now()
		WHERE college_id = $5 AND id = $6
	`
	_, err := r.Executor(ctx).Exec(ctx, query, rm.Status, rm.ResolvedBy, rm.CompletedAt, rm.Remarks, rm.CollegeID, rm.ID)
	return err
}
