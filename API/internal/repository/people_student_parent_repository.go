package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type StudentParent struct {
	ID                      uuid.UUID `json:"id"`
	CollegeID               uuid.UUID `json:"college_id"`
	StudentID               uuid.UUID `json:"student_id"`
	ParentID                uuid.UUID `json:"parent_id"`
	Relationship            string    `json:"relationship"`
	IsPrimary               bool      `json:"is_primary"`
	CanReceiveNotifications bool      `json:"can_receive_notifications"`
	CanPickupStudent        bool      `json:"can_pickup_student"`
	CreatedAt               time.Time `json:"created_at"`
	UpdatedAt               time.Time `json:"updated_at"`
}

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
	CollegeID               uuid.UUID
	StudentID               uuid.UUID
	ID                      uuid.UUID
	Relationship            string
	IsPrimary               bool
	CanReceiveNotifications bool
	CanPickupStudent        bool
}

func (r *Repository) ListStudentParents(
	ctx context.Context,
	params ListStudentParentsParams,
) ([]StudentParent, error) {
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
		WHERE college_id = $1
		  AND student_id = $2
		ORDER BY is_primary DESC, created_at ASC, id ASC
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

	var result []StudentParent

	for rows.Next() {
		var item StudentParent

		if err := rows.Scan(
			&item.ID,
			&item.CollegeID,
			&item.StudentID,
			&item.ParentID,
			&item.Relationship,
			&item.IsPrimary,
			&item.CanReceiveNotifications,
			&item.CanPickupStudent,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}

		result = append(result, item)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}

func (r *Repository) GetStudentParent(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
	relationshipID uuid.UUID,
) (StudentParent, error) {
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
		WHERE college_id = $1
		  AND student_id = $2
		  AND id = $3
	`

	var item StudentParent

	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		collegeID,
		studentID,
		relationshipID,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.StudentID,
		&item.ParentID,
		&item.Relationship,
		&item.IsPrimary,
		&item.CanReceiveNotifications,
		&item.CanPickupStudent,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return StudentParent{}, ErrNotFound
		}

		return StudentParent{}, err
	}

	return item, nil
}

func (r *Repository) CreateStudentParent(
	ctx context.Context,
	params CreateStudentParentParams,
) (StudentParent, error) {
	/*
		If this relationship is primary, clear the existing primary
		relationship for this student first.

		This is deliberately done inside one SQL statement so the
		database remains responsible for the one-primary-parent rule.
	*/

	query := `
		WITH cleared AS (
			UPDATE app.student_parents
			SET
				is_primary = FALSE,
				updated_at = NOW()
			WHERE college_id = $1
			  AND student_id = $2
			  AND $6 = TRUE
			  AND is_primary = TRUE
		)
		INSERT INTO app.student_parents (
			college_id,
			student_id,
			parent_id,
			relationship,
			is_primary,
			can_receive_notifications,
			can_pickup_student
		)
		VALUES (
			$1,
			$2,
			$3,
			$4,
			$5,
			$6,
			$7
		)
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

	var item StudentParent

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
		&item.ID,
		&item.CollegeID,
		&item.StudentID,
		&item.ParentID,
		&item.Relationship,
		&item.IsPrimary,
		&item.CanReceiveNotifications,
		&item.CanPickupStudent,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if isStudentParentConflictError(err) {
			return StudentParent{}, ErrConflict
		}

		return StudentParent{}, err
	}

	return item, nil
}

func (r *Repository) UpdateStudentParent(
	ctx context.Context,
	params UpdateStudentParentParams,
) (StudentParent, error) {
	query := `
		WITH cleared AS (
			UPDATE app.student_parents
			SET
				is_primary = FALSE,
				updated_at = NOW()
			WHERE college_id = $1
			  AND student_id = $2
			  AND id <> $3
			  AND $4 = TRUE
			  AND is_primary = TRUE
		)
		UPDATE app.student_parents
		SET
			relationship = $5,
			is_primary = $4,
			can_receive_notifications = $6,
			can_pickup_student = $7,
			updated_at = NOW()
		WHERE college_id = $1
		  AND student_id = $2
		  AND id = $3
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

	var item StudentParent

	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		params.CollegeID,
		params.StudentID,
		params.ID,
		params.IsPrimary,
		params.Relationship,
		params.CanReceiveNotifications,
		params.CanPickupStudent,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.StudentID,
		&item.ParentID,
		&item.Relationship,
		&item.IsPrimary,
		&item.CanReceiveNotifications,
		&item.CanPickupStudent,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return StudentParent{}, ErrNotFound
		}

		if isStudentParentConflictError(err) {
			return StudentParent{}, ErrConflict
		}

		return StudentParent{}, err
	}

	return item, nil
}

func (r *Repository) DeleteStudentParent(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
	relationshipID uuid.UUID,
) error {
	commandTag, err := r.Executor(ctx).Exec(
		ctx,
		`
			DELETE FROM app.student_parents
			WHERE college_id = $1
			  AND student_id = $2
			  AND id = $3
		`,
		collegeID,
		studentID,
		relationshipID,
	)

	if err != nil {
		return err
	}

	if commandTag.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

func isStudentParentConflictError(err error) bool {
	message := strings.ToLower(err.Error())

	return strings.Contains(message, "duplicate key") ||
		strings.Contains(message, "unique constraint")
}
