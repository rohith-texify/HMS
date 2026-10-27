package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type SecurityAssignment struct {
	ID            uuid.UUID  `json:"id"`
	CollegeID     uuid.UUID  `json:"college_id"`
	StaffID       uuid.UUID  `json:"staff_id"`
	GateID        uuid.UUID  `json:"gate_id"`
	ShiftName     *string    `json:"shift_name,omitempty"`
	ShiftStart    *time.Time `json:"shift_start,omitempty"`
	ShiftEnd      *time.Time `json:"shift_end,omitempty"`
	AssignedFrom  time.Time  `json:"assigned_from"`
	AssignedUntil *time.Time `json:"assigned_until,omitempty"`
	IsActive      bool       `json:"is_active"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

var ErrSecurityAssignmentNotFound = ErrNotFound

func (r *Repository) ListSecurityAssignments(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]SecurityAssignment, error) {
	rows, err := r.Executor(ctx).Query(ctx, `
		SELECT
			id,
			college_id,
			staff_id,
			gate_id,
			shift_name,
			shift_start,
			shift_end,
			assigned_from,
			assigned_until,
			is_active,
			created_at,
			updated_at
		FROM app.security_assignments
		WHERE college_id = $1
		ORDER BY assigned_from DESC, created_at DESC
	`, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []SecurityAssignment

	for rows.Next() {
		var item SecurityAssignment

		if err := rows.Scan(
			&item.ID,
			&item.CollegeID,
			&item.StaffID,
			&item.GateID,
			&item.ShiftName,
			&item.ShiftStart,
			&item.ShiftEnd,
			&item.AssignedFrom,
			&item.AssignedUntil,
			&item.IsActive,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}

		result = append(result, item)
	}

	return result, rows.Err()
}

func (r *Repository) GetSecurityAssignment(
	ctx context.Context,
	collegeID,
	assignmentID uuid.UUID,
) (SecurityAssignment, error) {
	var item SecurityAssignment

	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT
			id,
			college_id,
			staff_id,
			gate_id,
			shift_name,
			shift_start,
			shift_end,
			assigned_from,
			assigned_until,
			is_active,
			created_at,
			updated_at
		FROM app.security_assignments
		WHERE college_id = $1
		  AND id = $2
	`, collegeID, assignmentID).Scan(
		&item.ID,
		&item.CollegeID,
		&item.StaffID,
		&item.GateID,
		&item.ShiftName,
		&item.ShiftStart,
		&item.ShiftEnd,
		&item.AssignedFrom,
		&item.AssignedUntil,
		&item.IsActive,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SecurityAssignment{}, ErrNotFound
		}

		return SecurityAssignment{}, err
	}

	return item, nil
}

func (r *Repository) CreateSecurityAssignment(
	ctx context.Context,
	collegeID,
	staffID,
	gateID uuid.UUID,
	shiftName *string,
	shiftStart,
	shiftEnd *time.Time,
	assignedFrom time.Time,
	assignedUntil *time.Time,
	isActive bool,
) (SecurityAssignment, error) {
	var item SecurityAssignment

	err := r.Executor(ctx).QueryRow(ctx, `
		INSERT INTO app.security_assignments (
			college_id,
			staff_id,
			gate_id,
			shift_name,
			shift_start,
			shift_end,
			assigned_from,
			assigned_until,
			is_active
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		RETURNING
			id,
			college_id,
			staff_id,
			gate_id,
			shift_name,
			shift_start,
			shift_end,
			assigned_from,
			assigned_until,
			is_active,
			created_at,
			updated_at
	`,
		collegeID,
		staffID,
		gateID,
		shiftName,
		shiftStart,
		shiftEnd,
		assignedFrom,
		assignedUntil,
		isActive,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.StaffID,
		&item.GateID,
		&item.ShiftName,
		&item.ShiftStart,
		&item.ShiftEnd,
		&item.AssignedFrom,
		&item.AssignedUntil,
		&item.IsActive,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	return item, err
}

func (r *Repository) UpdateSecurityAssignment(
	ctx context.Context,
	collegeID,
	assignmentID uuid.UUID,
	shiftName *string,
	shiftStart,
	shiftEnd *time.Time,
	assignedFrom time.Time,
	assignedUntil *time.Time,
	isActive bool,
) (SecurityAssignment, error) {
	var item SecurityAssignment

	err := r.Executor(ctx).QueryRow(ctx, `
		UPDATE app.security_assignments
		SET
			shift_name = $3,
			shift_start = $4,
			shift_end = $5,
			assigned_from = $6,
			assigned_until = $7,
			is_active = $8,
			updated_at = CURRENT_TIMESTAMP
		WHERE college_id = $1
		  AND id = $2
		RETURNING
			id,
			college_id,
			staff_id,
			gate_id,
			shift_name,
			shift_start,
			shift_end,
			assigned_from,
			assigned_until,
			is_active,
			created_at,
			updated_at
	`,
		collegeID,
		assignmentID,
		shiftName,
		shiftStart,
		shiftEnd,
		assignedFrom,
		assignedUntil,
		isActive,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.StaffID,
		&item.GateID,
		&item.ShiftName,
		&item.ShiftStart,
		&item.ShiftEnd,
		&item.AssignedFrom,
		&item.AssignedUntil,
		&item.IsActive,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SecurityAssignment{}, ErrNotFound
		}

		return SecurityAssignment{}, err
	}

	return item, nil
}

func (r *Repository) DeleteSecurityAssignment(
	ctx context.Context,
	collegeID,
	assignmentID uuid.UUID,
) error {
	tag, err := r.Executor(ctx).Exec(ctx, `
		DELETE FROM app.security_assignments
		WHERE college_id = $1
		  AND id = $2
	`, collegeID, assignmentID)

	if err != nil {
		return err
	}

	if tag.RowsAffected() == 0 {
		return ErrSecurityAssignmentNotFound
	}

	return nil
}
