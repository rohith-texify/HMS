package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type Parent struct {
	ID             uuid.UUID  `json:"id"`
	CollegeID      uuid.UUID  `json:"college_id"`
	UserID         *uuid.UUID `json:"user_id,omitempty"`
	FirstName      string     `json:"first_name"`
	MiddleName     *string    `json:"middle_name,omitempty"`
	LastName       *string    `json:"last_name,omitempty"`
	Relationship   *string    `json:"relationship,omitempty"`
	Phone          *string    `json:"phone,omitempty"`
	AlternatePhone *string    `json:"alternate_phone,omitempty"`
	Email          *string    `json:"email,omitempty"`
	Occupation     *string    `json:"occupation,omitempty"`
	AddressLine1   *string    `json:"address_line1,omitempty"`
	AddressLine2   *string    `json:"address_line2,omitempty"`
	City           *string    `json:"city,omitempty"`
	State          *string    `json:"state,omitempty"`
	PostalCode     *string    `json:"postal_code,omitempty"`
	Country        *string    `json:"country,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type ListParentsParams struct {
	CollegeID uuid.UUID
	Limit     int
	Offset    int
}

type CreateParentParams struct {
	CollegeID      uuid.UUID
	UserID         *uuid.UUID
	FirstName      string
	MiddleName     *string
	LastName       *string
	Relationship   *string
	Phone          *string
	AlternatePhone *string
	Email          *string
	Occupation     *string
	AddressLine1   *string
	AddressLine2   *string
	City           *string
	State          *string
	PostalCode     *string
	Country        *string
}

type UpdateParentParams struct {
	ID             uuid.UUID
	CollegeID      uuid.UUID
	FirstName      string
	MiddleName     *string
	LastName       *string
	Relationship   *string
	Phone          *string
	AlternatePhone *string
	Email          *string
	Occupation     *string
	AddressLine1   *string
	AddressLine2   *string
	City           *string
	State          *string
	PostalCode     *string
	Country        *string
}

func (r *Repository) ListParents(
	ctx context.Context,
	params ListParentsParams,
) ([]Parent, error) {
	query := `
		SELECT
			id,
			college_id,
			user_id,
			first_name,
			middle_name,
			last_name,
			relationship,
			phone,
			alternate_phone,
			email,
			occupation,
			address_line1,
			address_line2,
			city,
			state,
			postal_code,
			country,
			created_at,
			updated_at
		FROM app.parents
		WHERE college_id = $1
		ORDER BY created_at DESC, id DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.Executor(ctx).Query(
		ctx,
		query,
		params.CollegeID,
		params.Limit,
		params.Offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var parents []Parent

	for rows.Next() {
		var parent Parent

		if err := rows.Scan(
			&parent.ID,
			&parent.CollegeID,
			&parent.UserID,
			&parent.FirstName,
			&parent.MiddleName,
			&parent.LastName,
			&parent.Relationship,
			&parent.Phone,
			&parent.AlternatePhone,
			&parent.Email,
			&parent.Occupation,
			&parent.AddressLine1,
			&parent.AddressLine2,
			&parent.City,
			&parent.State,
			&parent.PostalCode,
			&parent.Country,
			&parent.CreatedAt,
			&parent.UpdatedAt,
		); err != nil {
			return nil, err
		}

		parents = append(parents, parent)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return parents, nil
}

func (r *Repository) GetParentByID(
	ctx context.Context,
	collegeID uuid.UUID,
	parentID uuid.UUID,
) (Parent, error) {
	query := `
		SELECT
			id,
			college_id,
			user_id,
			first_name,
			middle_name,
			last_name,
			relationship,
			phone,
			alternate_phone,
			email,
			occupation,
			address_line1,
			address_line2,
			city,
			state,
			postal_code,
			country,
			created_at,
			updated_at
		FROM app.parents
		WHERE college_id = $1
		  AND id = $2
	`

	var parent Parent

	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		collegeID,
		parentID,
	).Scan(
		&parent.ID,
		&parent.CollegeID,
		&parent.UserID,
		&parent.FirstName,
		&parent.MiddleName,
		&parent.LastName,
		&parent.Relationship,
		&parent.Phone,
		&parent.AlternatePhone,
		&parent.Email,
		&parent.Occupation,
		&parent.AddressLine1,
		&parent.AddressLine2,
		&parent.City,
		&parent.State,
		&parent.PostalCode,
		&parent.Country,
		&parent.CreatedAt,
		&parent.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Parent{}, ErrNotFound
		}
		return Parent{}, err
	}

	return parent, nil
}

func (r *Repository) CreateParent(
	ctx context.Context,
	params CreateParentParams,
) (Parent, error) {
	query := `
		INSERT INTO app.parents (
			college_id,
			user_id,
			first_name,
			middle_name,
			last_name,
			relationship,
			phone,
			alternate_phone,
			email,
			occupation,
			address_line1,
			address_line2,
			city,
			state,
			postal_code,
			country
		)
		VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
		)
		RETURNING
			id,
			college_id,
			user_id,
			first_name,
			middle_name,
			last_name,
			relationship,
			phone,
			alternate_phone,
			email,
			occupation,
			address_line1,
			address_line2,
			city,
			state,
			postal_code,
			country,
			created_at,
			updated_at
	`

	var parent Parent

	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		params.CollegeID,
		params.UserID,
		params.FirstName,
		params.MiddleName,
		params.LastName,
		params.Relationship,
		params.Phone,
		params.AlternatePhone,
		params.Email,
		params.Occupation,
		params.AddressLine1,
		params.AddressLine2,
		params.City,
		params.State,
		params.PostalCode,
		params.Country,
	).Scan(
		&parent.ID,
		&parent.CollegeID,
		&parent.UserID,
		&parent.FirstName,
		&parent.MiddleName,
		&parent.LastName,
		&parent.Relationship,
		&parent.Phone,
		&parent.AlternatePhone,
		&parent.Email,
		&parent.Occupation,
		&parent.AddressLine1,
		&parent.AddressLine2,
		&parent.City,
		&parent.State,
		&parent.PostalCode,
		&parent.Country,
		&parent.CreatedAt,
		&parent.UpdatedAt,
	)

	if err != nil {
		if isParentConflictError(err) {
			return Parent{}, ErrConflict
		}
		return Parent{}, err
	}

	return parent, nil
}

func (r *Repository) UpdateParent(
	ctx context.Context,
	params UpdateParentParams,
) (Parent, error) {
	query := `
		UPDATE app.parents
		SET
			first_name = $3,
			middle_name = $4,
			last_name = $5,
			relationship = $6,
			phone = $7,
			alternate_phone = $8,
			email = $9,
			occupation = $10,
			address_line1 = $11,
			address_line2 = $12,
			city = $13,
			state = $14,
			postal_code = $15,
			country = $16,
			updated_at = NOW()
		WHERE college_id = $1
		  AND id = $2
		RETURNING
			id,
			college_id,
			user_id,
			first_name,
			middle_name,
			last_name,
			relationship,
			phone,
			alternate_phone,
			email,
			occupation,
			address_line1,
			address_line2,
			city,
			state,
			postal_code,
			country,
			created_at,
			updated_at
	`

	var parent Parent

	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		params.CollegeID,
		params.ID,
		params.FirstName,
		params.MiddleName,
		params.LastName,
		params.Relationship,
		params.Phone,
		params.AlternatePhone,
		params.Email,
		params.Occupation,
		params.AddressLine1,
		params.AddressLine2,
		params.City,
		params.State,
		params.PostalCode,
		params.Country,
	).Scan(
		&parent.ID,
		&parent.CollegeID,
		&parent.UserID,
		&parent.FirstName,
		&parent.MiddleName,
		&parent.LastName,
		&parent.Relationship,
		&parent.Phone,
		&parent.AlternatePhone,
		&parent.Email,
		&parent.Occupation,
		&parent.AddressLine1,
		&parent.AddressLine2,
		&parent.City,
		&parent.State,
		&parent.PostalCode,
		&parent.Country,
		&parent.CreatedAt,
		&parent.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Parent{}, ErrNotFound
		}
		if isParentConflictError(err) {
			return Parent{}, ErrConflict
		}
		return Parent{}, err
	}

	return parent, nil
}

func isParentConflictError(err error) bool {
	message := strings.ToLower(err.Error())

	return strings.Contains(message, "duplicate key") ||
		strings.Contains(message, "unique constraint")
}
