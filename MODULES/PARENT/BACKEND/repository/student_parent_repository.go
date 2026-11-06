package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/models"
)

type ListStudentParentsParams struct {
	CollegeID uuid.UUID
	StudentID uuid.UUID
	Limit     int
	Offset    int
}

type CreateStudentParentParams struct {
	CollegeID               uuid.UUID
	StudentID               uuid.UUID
	ParentID                uuid.UUID
	Relationship            string
	IsPrimary               bool
	CanReceiveNotifications bool
	CanPickupStudent        bool
}

type UpdateStudentParentParams struct {
	ID                      uuid.UUID
	CollegeID               uuid.UUID
	StudentID               uuid.UUID
	Relationship            string
	IsPrimary               bool
	CanReceiveNotifications bool
	CanPickupStudent        bool
}

func (r *Repository) ListStudentParents(
	ctx context.Context,
	params ListStudentParentsParams,
) ([]models.StudentParent, error) {
	query := `
		SELECT
			id,
			college_id,
			student_id,
			parent_id,
			relationship,
			is_primary,
			can_receive_notifications,
			can_pickup_student,
			created_at,
			updated_at
		FROM app.student_parents
		WHERE college_id = $1 AND student_id = $2
		ORDER BY is_primary DESC, created_at ASC
		LIMIT $3 OFFSET $4
	`

	rows, err := r.Executor(ctx).Query(
		ctx,
		query,
		params.CollegeID,
		params.StudentID,
		params.Limit,
		params.Offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.StudentParent

	for rows.Next() {
		var sp models.StudentParent
		if err := rows.Scan(
			&sp.ID,
			&sp.CollegeID,
			&sp.StudentID,
			&sp.ParentID,
			&sp.Relationship,
			&sp.IsPrimary,
			&sp.CanReceiveNotifications,
			&sp.CanPickupStudent,
			&sp.CreatedAt,
			&sp.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, sp)
	}

	return items, rows.Err()
}

func (r *Repository) GetStudentParent(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
	relationshipID uuid.UUID,
) (models.StudentParent, error) {
	query := `
		SELECT
			id,
			college_id,
			student_id,
			parent_id,
			relationship,
			is_primary,
			can_receive_notifications,
			can_pickup_student,
			created_at,
			updated_at
		FROM app.student_parents
		WHERE college_id = $1 AND student_id = $2 AND id = $3
	`

	var sp models.StudentParent
	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		collegeID,
		studentID,
		relationshipID,
	).Scan(
		&sp.ID,
		&sp.CollegeID,
		&sp.StudentID,
		&sp.ParentID,
		&sp.Relationship,
		&sp.IsPrimary,
		&sp.CanReceiveNotifications,
		&sp.CanPickupStudent,
		&sp.CreatedAt,
		&sp.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.StudentParent{}, ErrNotFound
		}
		return models.StudentParent{}, err
	}

	return sp, nil
}

func (r *Repository) CreateStudentParent(
	ctx context.Context,
	params CreateStudentParentParams,
) (models.StudentParent, error) {
	query := `
		INSERT INTO app.student_parents (
			college_id,
			student_id,
			parent_id,
			relationship,
			is_primary,
			can_receive_notifications,
			can_pickup_student
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING
			id,
			college_id,
			student_id,
			parent_id,
			relationship,
			is_primary,
			can_receive_notifications,
			can_pickup_student,
			created_at,
			updated_at
	`

	var sp models.StudentParent
	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		params.CollegeID,
		params.StudentID,
		params.ParentID,
		params.Relationship,
		params.IsPrimary,
		params.CanReceiveNotifications,
		params.CanPickupStudent,
	).Scan(
		&sp.ID,
		&sp.CollegeID,
		&sp.StudentID,
		&sp.ParentID,
		&sp.Relationship,
		&sp.IsPrimary,
		&sp.CanReceiveNotifications,
		&sp.CanPickupStudent,
		&sp.CreatedAt,
		&sp.UpdatedAt,
	)

	if err != nil {
		if isConflictError(err) {
			return models.StudentParent{}, ErrConflict
		}
		return models.StudentParent{}, err
	}

	return sp, nil
}

func (r *Repository) UpdateStudentParent(
	ctx context.Context,
	params UpdateStudentParentParams,
) (models.StudentParent, error) {
	query := `
		UPDATE app.student_parents
		SET
			relationship = $4,
			is_primary = $5,
			can_receive_notifications = $6,
			can_pickup_student = $7,
			updated_at = NOW()
		WHERE college_id = $1 AND student_id = $2 AND id = $3
		RETURNING
			id,
			college_id,
			student_id,
			parent_id,
			relationship,
			is_primary,
			can_receive_notifications,
			can_pickup_student,
			created_at,
			updated_at
	`

	var sp models.StudentParent
	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		params.CollegeID,
		params.StudentID,
		params.ID,
		params.Relationship,
		params.IsPrimary,
		params.CanReceiveNotifications,
		params.CanPickupStudent,
	).Scan(
		&sp.ID,
		&sp.CollegeID,
		&sp.StudentID,
		&sp.ParentID,
		&sp.Relationship,
		&sp.IsPrimary,
		&sp.CanReceiveNotifications,
		&sp.CanPickupStudent,
		&sp.CreatedAt,
		&sp.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.StudentParent{}, ErrNotFound
		}
		if isConflictError(err) {
			return models.StudentParent{}, ErrConflict
		}
		return models.StudentParent{}, err
	}

	return sp, nil
}

func (r *Repository) DeleteStudentParent(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
	relationshipID uuid.UUID,
) error {
	query := `
		DELETE FROM app.student_parents
		WHERE college_id = $1 AND student_id = $2 AND id = $3
	`

	res, err := r.Executor(ctx).Exec(ctx, query, collegeID, studentID, relationshipID)
	if err != nil {
		return err
	}

	if res.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

