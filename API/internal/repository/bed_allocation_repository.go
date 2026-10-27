package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type BedAllocation struct {
	ID             uuid.UUID  `json:"id"`
	CollegeID      uuid.UUID  `json:"college_id"`
	BedID          uuid.UUID  `json:"bed_id"`
	StudentID      *uuid.UUID `json:"student_id,omitempty"`
	AllocationType string     `json:"allocation_type"`
	AllocatedAt    time.Time  `json:"allocated_at"`
	ReleasedAt     *time.Time `json:"released_at,omitempty"`
	Status         string     `json:"status"`
	Remarks        *string    `json:"remarks,omitempty"`
	CreatedBy      *uuid.UUID `json:"created_by,omitempty"`
	ReleasedBy     *uuid.UUID `json:"released_by,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

func (r *Repository) CreateBedAllocation(
	ctx context.Context,
	collegeID uuid.UUID,
	bedID uuid.UUID,
	studentID *uuid.UUID,
	allocationType string,
	allocatedAt time.Time,
	remarks *string,
	createdBy *uuid.UUID,
) (BedAllocation, error) {
	var item BedAllocation

	err := r.Executor(ctx).QueryRow(ctx, `
		INSERT INTO app.bed_allocations (
			college_id,
			bed_id,
			student_id,
			allocation_type,
			allocated_at,
			remarks,
			created_by
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING
			id,
			college_id,
			bed_id,
			student_id,
			allocation_type,
			allocated_at,
			released_at,
			status,
			remarks,
			created_by,
			released_by,
			created_at,
			updated_at
	`,
		collegeID,
		bedID,
		studentID,
		allocationType,
		allocatedAt,
		remarks,
		createdBy,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.BedID,
		&item.StudentID,
		&item.AllocationType,
		&item.AllocatedAt,
		&item.ReleasedAt,
		&item.Status,
		&item.Remarks,
		&item.CreatedBy,
		&item.ReleasedBy,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		return BedAllocation{}, err
	}

	return item, nil
}

func (r *Repository) GetBedAllocation(
	ctx context.Context,
	collegeID uuid.UUID,
	allocationID uuid.UUID,
) (BedAllocation, error) {
	var item BedAllocation

	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT
			id,
			college_id,
			bed_id,
			student_id,
			allocation_type,
			allocated_at,
			released_at,
			status,
			remarks,
			created_by,
			released_by,
			created_at,
			updated_at
		FROM app.bed_allocations
		WHERE college_id = $1 AND id = $2
	`,
		collegeID,
		allocationID,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.BedID,
		&item.StudentID,
		&item.AllocationType,
		&item.AllocatedAt,
		&item.ReleasedAt,
		&item.Status,
		&item.Remarks,
		&item.CreatedBy,
		&item.ReleasedBy,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return BedAllocation{}, ErrNotFound
		}
		return BedAllocation{}, err
	}

	return item, nil
}

func (r *Repository) ListBedAllocations(
	ctx context.Context,
	collegeID uuid.UUID,
	bedID *uuid.UUID,
	studentID *uuid.UUID,
	status *string,
) ([]BedAllocation, error) {
	query := `
		SELECT
			id,
			college_id,
			bed_id,
			student_id,
			allocation_type,
			allocated_at,
			released_at,
			status,
			remarks,
			created_by,
			released_by,
			created_at,
			updated_at
		FROM app.bed_allocations
		WHERE college_id = $1
	`
	args := []interface{}{collegeID}
	argIdx := 2

	if bedID != nil {
		query += ` AND bed_id = $` + string(rune(argIdx+'0'))
		args = append(args, *bedID)
		argIdx++
	}
	if studentID != nil {
		query += ` AND student_id = $` + string(rune(argIdx+'0'))
		args = append(args, *studentID)
		argIdx++
	}
	if status != nil {
		query += ` AND status = $` + string(rune(argIdx+'0'))
		args = append(args, *status)
		argIdx++
	}

	query += ` ORDER BY created_at DESC`

	rows, err := r.Executor(ctx).Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []BedAllocation
	for rows.Next() {
		var item BedAllocation
		if err := rows.Scan(
			&item.ID,
			&item.CollegeID,
			&item.BedID,
			&item.StudentID,
			&item.AllocationType,
			&item.AllocatedAt,
			&item.ReleasedAt,
			&item.Status,
			&item.Remarks,
			&item.CreatedBy,
			&item.ReleasedBy,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	if items == nil {
		items = []BedAllocation{}
	}

	return items, nil
}

func (r *Repository) UpdateBedAllocation(
	ctx context.Context,
	collegeID uuid.UUID,
	allocationID uuid.UUID,
	allocationType string,
	remarks *string,
) (BedAllocation, error) {
	var item BedAllocation

	err := r.Executor(ctx).QueryRow(ctx, `
		UPDATE app.bed_allocations
		SET
			allocation_type = $3,
			remarks = $4,
			updated_at = now()
		WHERE college_id = $1 AND id = $2
		RETURNING
			id,
			college_id,
			bed_id,
			student_id,
			allocation_type,
			allocated_at,
			released_at,
			status,
			remarks,
			created_by,
			released_by,
			created_at,
			updated_at
	`,
		collegeID,
		allocationID,
		allocationType,
		remarks,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.BedID,
		&item.StudentID,
		&item.AllocationType,
		&item.AllocatedAt,
		&item.ReleasedAt,
		&item.Status,
		&item.Remarks,
		&item.CreatedBy,
		&item.ReleasedBy,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return BedAllocation{}, ErrNotFound
		}
		return BedAllocation{}, err
	}

	return item, nil
}

func (r *Repository) ReleaseBedAllocation(
	ctx context.Context,
	collegeID uuid.UUID,
	allocationID uuid.UUID,
	releasedAt time.Time,
	releasedBy *uuid.UUID,
	status string,
) (BedAllocation, error) {
	var item BedAllocation

	err := r.Executor(ctx).QueryRow(ctx, `
		UPDATE app.bed_allocations
		SET
			released_at = $3,
			released_by = $4,
			status = $5,
			updated_at = now()
		WHERE college_id = $1 AND id = $2
		RETURNING
			id,
			college_id,
			bed_id,
			student_id,
			allocation_type,
			allocated_at,
			released_at,
			status,
			remarks,
			created_by,
			released_by,
			created_at,
			updated_at
	`,
		collegeID,
		allocationID,
		releasedAt,
		releasedBy,
		status,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.BedID,
		&item.StudentID,
		&item.AllocationType,
		&item.AllocatedAt,
		&item.ReleasedAt,
		&item.Status,
		&item.Remarks,
		&item.CreatedBy,
		&item.ReleasedBy,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return BedAllocation{}, ErrNotFound
		}
		return BedAllocation{}, err
	}

	return item, nil
}

func (r *Repository) GetActiveAllocationByStudent(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
) (BedAllocation, error) {
	var item BedAllocation

	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT
			id,
			college_id,
			bed_id,
			student_id,
			allocation_type,
			allocated_at,
			released_at,
			status,
			remarks,
			created_by,
			released_by,
			created_at,
			updated_at
		FROM app.bed_allocations
		WHERE college_id = $1 AND student_id = $2 AND status = 'ACTIVE'
	`,
		collegeID,
		studentID,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.BedID,
		&item.StudentID,
		&item.AllocationType,
		&item.AllocatedAt,
		&item.ReleasedAt,
		&item.Status,
		&item.Remarks,
		&item.CreatedBy,
		&item.ReleasedBy,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return BedAllocation{}, ErrNotFound
		}
		return BedAllocation{}, err
	}

	return item, nil
}

func (r *Repository) GetActiveAllocationByBed(
	ctx context.Context,
	collegeID uuid.UUID,
	bedID uuid.UUID,
) (BedAllocation, error) {
	var item BedAllocation

	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT
			id,
			college_id,
			bed_id,
			student_id,
			allocation_type,
			allocated_at,
			released_at,
			status,
			remarks,
			created_by,
			released_by,
			created_at,
			updated_at
		FROM app.bed_allocations
		WHERE college_id = $1 AND bed_id = $2 AND status = 'ACTIVE'
	`,
		collegeID,
		bedID,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.BedID,
		&item.StudentID,
		&item.AllocationType,
		&item.AllocatedAt,
		&item.ReleasedAt,
		&item.Status,
		&item.Remarks,
		&item.CreatedBy,
		&item.ReleasedBy,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return BedAllocation{}, ErrNotFound
		}
		return BedAllocation{}, err
	}

	return item, nil
}
