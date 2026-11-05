package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/MODULES/HOSTEL-INCHARGE/BACKEND/models"
)

// ListInchargeHostels retrieves all incharge assignments for a given hostel.
func (r *Repository) ListInchargeHostels(
	ctx context.Context,
	collegeID,
	hostelID uuid.UUID,
) ([]models.InchargeHostel, error) {
	rows, err := r.Executor(ctx).Query(ctx, `
		SELECT
			id,
			college_id,
			staff_id,
			hostel_id,
			assigned_from,
			assigned_until,
			is_primary,
			created_at,
			updated_at
		FROM app.incharge_hostels
		WHERE college_id = $1
		  AND hostel_id = $2
		ORDER BY is_primary DESC, assigned_from DESC
	`, collegeID, hostelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []models.InchargeHostel

	for rows.Next() {
		var item models.InchargeHostel

		if err := rows.Scan(
			&item.ID,
			&item.CollegeID,
			&item.StaffID,
			&item.HostelID,
			&item.AssignedFrom,
			&item.AssignedUntil,
			&item.IsPrimary,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}

		result = append(result, item)
	}

	return result, rows.Err()
}

// GetInchargeHostel retrieves a single incharge assignment by ID.
func (r *Repository) GetInchargeHostel(
	ctx context.Context,
	collegeID,
	hostelID,
	assignmentID uuid.UUID,
) (models.InchargeHostel, error) {
	var item models.InchargeHostel

	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT
			id,
			college_id,
			staff_id,
			hostel_id,
			assigned_from,
			assigned_until,
			is_primary,
			created_at,
			updated_at
		FROM app.incharge_hostels
		WHERE college_id = $1
		  AND hostel_id = $2
		  AND id = $3
	`, collegeID, hostelID, assignmentID).Scan(
		&item.ID,
		&item.CollegeID,
		&item.StaffID,
		&item.HostelID,
		&item.AssignedFrom,
		&item.AssignedUntil,
		&item.IsPrimary,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.InchargeHostel{}, ErrNotFound
		}
		return models.InchargeHostel{}, err
	}

	return item, nil
}

// ClearPrimaryIncharge marks existing primary assignments as non-primary.
func (r *Repository) ClearPrimaryIncharge(
	ctx context.Context,
	collegeID,
	hostelID uuid.UUID,
) error {
	_, err := r.Executor(ctx).Exec(ctx, `
		UPDATE app.incharge_hostels
		SET
			is_primary = false,
			updated_at = CURRENT_TIMESTAMP
		WHERE college_id = $1
		  AND hostel_id = $2
		  AND is_primary = true
		  AND assigned_until IS NULL
	`, collegeID, hostelID)

	return err
}

// CreateInchargeHostel inserts a new incharge assignment.
func (r *Repository) CreateInchargeHostel(
	ctx context.Context,
	collegeID,
	staffID,
	hostelID uuid.UUID,
	assignedFrom time.Time,
	assignedUntil *time.Time,
	isPrimary bool,
) (models.InchargeHostel, error) {
	var item models.InchargeHostel

	err := r.Executor(ctx).QueryRow(ctx, `
		INSERT INTO app.incharge_hostels (
			college_id,
			staff_id,
			hostel_id,
			assigned_from,
			assigned_until,
			is_primary
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING
			id,
			college_id,
			staff_id,
			hostel_id,
			assigned_from,
			assigned_until,
			is_primary,
			created_at,
			updated_at
	`,
		collegeID,
		staffID,
		hostelID,
		assignedFrom,
		assignedUntil,
		isPrimary,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.StaffID,
		&item.HostelID,
		&item.AssignedFrom,
		&item.AssignedUntil,
		&item.IsPrimary,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	return item, err
}

// UpdateInchargeHostel modifies an existing incharge assignment.
func (r *Repository) UpdateInchargeHostel(
	ctx context.Context,
	collegeID,
	hostelID,
	assignmentID uuid.UUID,
	assignedFrom time.Time,
	assignedUntil *time.Time,
	isPrimary bool,
) (models.InchargeHostel, error) {
	var item models.InchargeHostel

	err := r.Executor(ctx).QueryRow(ctx, `
		UPDATE app.incharge_hostels
		SET
			assigned_from = $4,
			assigned_until = $5,
			is_primary = $6,
			updated_at = CURRENT_TIMESTAMP
		WHERE college_id = $1
		  AND hostel_id = $2
		  AND id = $3
		RETURNING
			id,
			college_id,
			staff_id,
			hostel_id,
			assigned_from,
			assigned_until,
			is_primary,
			created_at,
			updated_at
	`,
		collegeID,
		hostelID,
		assignmentID,
		assignedFrom,
		assignedUntil,
		isPrimary,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.StaffID,
		&item.HostelID,
		&item.AssignedFrom,
		&item.AssignedUntil,
		&item.IsPrimary,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.InchargeHostel{}, ErrNotFound
		}
		return models.InchargeHostel{}, err
	}

	return item, nil
}

// DeleteInchargeHostel deletes an assignment.
func (r *Repository) DeleteInchargeHostel(
	ctx context.Context,
	collegeID,
	hostelID,
	assignmentID uuid.UUID,
) error {
	tag, err := r.Executor(ctx).Exec(ctx, `
		DELETE FROM app.incharge_hostels
		WHERE college_id = $1
		  AND hostel_id = $2
		  AND id = $3
	`, collegeID, hostelID, assignmentID)

	if err != nil {
		return err
	}

	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}
