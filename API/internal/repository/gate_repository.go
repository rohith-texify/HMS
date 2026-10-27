package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type Gate struct {
	ID                  uuid.UUID  `json:"id"`
	CollegeID           uuid.UUID  `json:"college_id"`
	HostelID            *uuid.UUID `json:"hostel_id,omitempty"`
	Code                string     `json:"code"`
	Name                string     `json:"name"`
	GateType            string     `json:"gate_type"`
	LocationDescription *string    `json:"location_description,omitempty"`
	Status              string     `json:"status"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

func (r *Repository) ListGates(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]Gate, error) {
	rows, err := r.Executor(ctx).Query(ctx, `
		SELECT
			id,
			college_id,
			hostel_id,
			code,
			name,
			gate_type,
			location_description,
			status,
			created_at,
			updated_at
		FROM app.gates
		WHERE college_id = $1
		ORDER BY name ASC, code ASC
	`, collegeID)
	if err != nil {
		return nil, fmt.Errorf("list gates: %w", err)
	}
	defer rows.Close()

	var gates []Gate

	for rows.Next() {
		var gate Gate

		if err := rows.Scan(
			&gate.ID,
			&gate.CollegeID,
			&gate.HostelID,
			&gate.Code,
			&gate.Name,
			&gate.GateType,
			&gate.LocationDescription,
			&gate.Status,
			&gate.CreatedAt,
			&gate.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan gate: %w", err)
		}

		gates = append(gates, gate)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate gates: %w", err)
	}

	return gates, nil
}

func (r *Repository) CreateGate(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID *uuid.UUID,
	code string,
	name string,
	gateType string,
	locationDescription *string,
	status string,
) (Gate, error) {
	var gate Gate

	err := r.Executor(ctx).QueryRow(ctx, `
		INSERT INTO app.gates (
			college_id,
			hostel_id,
			code,
			name,
			gate_type,
			location_description,
			status
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING
			id,
			college_id,
			hostel_id,
			code,
			name,
			gate_type,
			location_description,
			status,
			created_at,
			updated_at
	`,
		collegeID,
		hostelID,
		code,
		name,
		gateType,
		locationDescription,
		status,
	).Scan(
		&gate.ID,
		&gate.CollegeID,
		&gate.HostelID,
		&gate.Code,
		&gate.Name,
		&gate.GateType,
		&gate.LocationDescription,
		&gate.Status,
		&gate.CreatedAt,
		&gate.UpdatedAt,
	)

	if err != nil {
		return Gate{}, fmt.Errorf("create gate: %w", err)
	}

	return gate, nil
}

func (r *Repository) GetGate(
	ctx context.Context,
	collegeID uuid.UUID,
	gateID uuid.UUID,
) (Gate, error) {
	var gate Gate

	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT
			id,
			college_id,
			hostel_id,
			code,
			name,
			gate_type,
			location_description,
			status,
			created_at,
			updated_at
		FROM app.gates
		WHERE college_id = $1
		  AND id = $2
	`,
		collegeID,
		gateID,
	).Scan(
		&gate.ID,
		&gate.CollegeID,
		&gate.HostelID,
		&gate.Code,
		&gate.Name,
		&gate.GateType,
		&gate.LocationDescription,
		&gate.Status,
		&gate.CreatedAt,
		&gate.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return Gate{}, ErrNotFound
	}

	if err != nil {
		return Gate{}, fmt.Errorf("get gate: %w", err)
	}

	return gate, nil
}

func (r *Repository) UpdateGate(
	ctx context.Context,
	collegeID uuid.UUID,
	gateID uuid.UUID,
	hostelID *uuid.UUID,
	code string,
	name string,
	gateType string,
	locationDescription *string,
	status string,
) (Gate, error) {
	var gate Gate

	err := r.Executor(ctx).QueryRow(ctx, `
		UPDATE app.gates
		SET
			hostel_id = $3,
			code = $4,
			name = $5,
			gate_type = $6,
			location_description = $7,
			status = $8,
			updated_at = CURRENT_TIMESTAMP
		WHERE college_id = $1
		  AND id = $2
		RETURNING
			id,
			college_id,
			hostel_id,
			code,
			name,
			gate_type,
			location_description,
			status,
			created_at,
			updated_at
	`,
		collegeID,
		gateID,
		hostelID,
		code,
		name,
		gateType,
		locationDescription,
		status,
	).Scan(
		&gate.ID,
		&gate.CollegeID,
		&gate.HostelID,
		&gate.Code,
		&gate.Name,
		&gate.GateType,
		&gate.LocationDescription,
		&gate.Status,
		&gate.CreatedAt,
		&gate.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return Gate{}, ErrNotFound
	}

	if err != nil {
		return Gate{}, fmt.Errorf("update gate: %w", err)
	}

	return gate, nil
}

func (r *Repository) UpdateGateStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	gateID uuid.UUID,
	status string,
) (Gate, error) {
	var gate Gate

	err := r.Executor(ctx).QueryRow(ctx, `
		UPDATE app.gates
		SET
			status = $3,
			updated_at = CURRENT_TIMESTAMP
		WHERE college_id = $1
		  AND id = $2
		RETURNING
			id,
			college_id,
			hostel_id,
			code,
			name,
			gate_type,
			location_description,
			status,
			created_at,
			updated_at
	`,
		collegeID,
		gateID,
		status,
	).Scan(
		&gate.ID,
		&gate.CollegeID,
		&gate.HostelID,
		&gate.Code,
		&gate.Name,
		&gate.GateType,
		&gate.LocationDescription,
		&gate.Status,
		&gate.CreatedAt,
		&gate.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return Gate{}, ErrNotFound
	}

	if err != nil {
		return Gate{}, fmt.Errorf("update gate status: %w", err)
	}

	return gate, nil
}
