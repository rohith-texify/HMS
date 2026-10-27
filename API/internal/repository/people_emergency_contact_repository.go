package repository

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
)

type EmergencyContact struct {
	ID             uuid.UUID `json:"id"`
	CollegeID      uuid.UUID `json:"college_id"`
	StudentID      uuid.UUID `json:"student_id"`
	ContactName    string    `json:"contact_name"`
	Relationship   string    `json:"relationship,omitempty"`
	Phone          string    `json:"phone"`
	AlternatePhone string    `json:"alternate_phone,omitempty"`
	Email          string    `json:"email,omitempty"`
	AddressLine1   string    `json:"address_line1,omitempty"`
	AddressLine2   string    `json:"address_line2,omitempty"`
	City           string    `json:"city,omitempty"`
	State          string    `json:"state,omitempty"`
	PostalCode     string    `json:"postal_code,omitempty"`
	Country        string    `json:"country,omitempty"`
	IsPrimary      bool      `json:"is_primary"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type CreateEmergencyContactParams struct {
	CollegeID      uuid.UUID
	StudentID      uuid.UUID
	ContactName    string
	Relationship   string
	Phone          string
	AlternatePhone string
	Email          string
	AddressLine1   string
	AddressLine2   string
	City           string
	State          string
	PostalCode     string
	Country        string
	IsPrimary      bool
}

type UpdateEmergencyContactParams struct {
	CollegeID      uuid.UUID
	StudentID      uuid.UUID
	ContactID      uuid.UUID
	ContactName    string
	Relationship   string
	Phone          string
	AlternatePhone string
	Email          string
	AddressLine1   string
	AddressLine2   string
	City           string
	State          string
	PostalCode     string
	Country        string
	IsPrimary      bool
}

func nullableString(value sql.NullString) string {
	if !value.Valid {
		return ""
	}

	return value.String
}

func scanEmergencyContact(row interface {
	Scan(dest ...interface{}) error
}) (EmergencyContact, error) {
	var contact EmergencyContact

	var (
		relationship   sql.NullString
		alternatePhone sql.NullString
		email          sql.NullString
		addressLine1   sql.NullString
		addressLine2   sql.NullString
		city           sql.NullString
		state          sql.NullString
		postalCode     sql.NullString
		country        sql.NullString
	)

	err := row.Scan(
		&contact.ID,
		&contact.CollegeID,
		&contact.StudentID,
		&contact.ContactName,
		&relationship,
		&contact.Phone,
		&alternatePhone,
		&email,
		&addressLine1,
		&addressLine2,
		&city,
		&state,
		&postalCode,
		&country,
		&contact.IsPrimary,
		&contact.CreatedAt,
		&contact.UpdatedAt,
	)
	if err != nil {
		return EmergencyContact{}, err
	}

	contact.Relationship = nullableString(relationship)
	contact.AlternatePhone = nullableString(alternatePhone)
	contact.Email = nullableString(email)
	contact.AddressLine1 = nullableString(addressLine1)
	contact.AddressLine2 = nullableString(addressLine2)
	contact.City = nullableString(city)
	contact.State = nullableString(state)
	contact.PostalCode = nullableString(postalCode)
	contact.Country = nullableString(country)

	return contact, nil
}

func (r *Repository) ListEmergencyContacts(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
) ([]EmergencyContact, error) {
	rows, err := r.Executor(ctx).Query(
		ctx,
		`
		SELECT
			id,
			college_id,
			student_id,
			contact_name,
			relationship,
			phone,
			alternate_phone,
			email,
			address_line1,
			address_line2,
			city,
			state,
			postal_code,
			country,
			is_primary,
			created_at,
			updated_at
		FROM app.emergency_contacts
		WHERE college_id = $1
		  AND student_id = $2
		ORDER BY is_primary DESC, contact_name ASC, created_at ASC
		`,
		collegeID,
		studentID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	contacts := make([]EmergencyContact, 0)

	for rows.Next() {
		contact, err := scanEmergencyContact(rows)
		if err != nil {
			return nil, err
		}

		contacts = append(contacts, contact)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return contacts, nil
}

func (r *Repository) GetEmergencyContact(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
	contactID uuid.UUID,
) (EmergencyContact, error) {
	row := r.Executor(ctx).QueryRow(
		ctx,
		`
		SELECT
			id,
			college_id,
			student_id,
			contact_name,
			relationship,
			phone,
			alternate_phone,
			email,
			address_line1,
			address_line2,
			city,
			state,
			postal_code,
			country,
			is_primary,
			created_at,
			updated_at
		FROM app.emergency_contacts
		WHERE college_id = $1
		  AND student_id = $2
		  AND id = $3
		`,
		collegeID,
		studentID,
		contactID,
	)

	contact, err := scanEmergencyContact(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return EmergencyContact{}, ErrNotFound
		}

		return EmergencyContact{}, err
	}

	return contact, nil
}

func (r *Repository) CreateEmergencyContact(
	ctx context.Context,
	params CreateEmergencyContactParams,
) (EmergencyContact, error) {
	// When creating a primary contact, clear the current primary
	// inside the same transaction before inserting the new one.
	if params.IsPrimary {
		_, err := r.Executor(ctx).Exec(
			ctx,
			`
			UPDATE app.emergency_contacts
			SET
				is_primary = FALSE,
				updated_at = NOW()
			WHERE college_id = $1
			  AND student_id = $2
			  AND is_primary = TRUE
			`,
			params.CollegeID,
			params.StudentID,
		)
		if err != nil {
			return EmergencyContact{}, err
		}
	}

	row := r.Executor(ctx).QueryRow(
		ctx,
		`
		INSERT INTO app.emergency_contacts (
			college_id,
			student_id,
			contact_name,
			relationship,
			phone,
			alternate_phone,
			email,
			address_line1,
			address_line2,
			city,
			state,
			postal_code,
			country,
			is_primary
		)
		VALUES (
			$1, $2, $3, NULLIF($4, ''),
			$5, NULLIF($6, ''), NULLIF($7, ''),
			NULLIF($8, ''), NULLIF($9, ''),
			NULLIF($10, ''), NULLIF($11, ''),
			NULLIF($12, ''), NULLIF($13, ''),
			$14
		)
		RETURNING
			id,
			college_id,
			student_id,
			contact_name,
			relationship,
			phone,
			alternate_phone,
			email,
			address_line1,
			address_line2,
			city,
			state,
			postal_code,
			country,
			is_primary,
			created_at,
			updated_at
		`,
		params.CollegeID,
		params.StudentID,
		params.ContactName,
		params.Relationship,
		params.Phone,
		params.AlternatePhone,
		params.Email,
		params.AddressLine1,
		params.AddressLine2,
		params.City,
		params.State,
		params.PostalCode,
		params.Country,
		params.IsPrimary,
	)

	contact, err := scanEmergencyContact(row)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			return EmergencyContact{}, ErrConflict
		}

		return EmergencyContact{}, err
	}

	return contact, nil
}

func (r *Repository) UpdateEmergencyContact(
	ctx context.Context,
	params UpdateEmergencyContactParams,
) (EmergencyContact, error) {
	if params.IsPrimary {
		_, err := r.Executor(ctx).Exec(
			ctx,
			`
			UPDATE app.emergency_contacts
			SET
				is_primary = FALSE,
				updated_at = NOW()
			WHERE college_id = $1
			  AND student_id = $2
			  AND id <> $3
			  AND is_primary = TRUE
			`,
			params.CollegeID,
			params.StudentID,
			params.ContactID,
		)
		if err != nil {
			return EmergencyContact{}, err
		}
	}

	row := r.Executor(ctx).QueryRow(
		ctx,
		`
		UPDATE app.emergency_contacts
		SET
			contact_name = $4,
			relationship = NULLIF($5, ''),
			phone = $6,
			alternate_phone = NULLIF($7, ''),
			email = NULLIF($8, ''),
			address_line1 = NULLIF($9, ''),
			address_line2 = NULLIF($10, ''),
			city = NULLIF($11, ''),
			state = NULLIF($12, ''),
			postal_code = NULLIF($13, ''),
			country = NULLIF($14, ''),
			is_primary = $15,
			updated_at = NOW()
		WHERE college_id = $1
		  AND student_id = $2
		  AND id = $3
		RETURNING
			id,
			college_id,
			student_id,
			contact_name,
			relationship,
			phone,
			alternate_phone,
			email,
			address_line1,
			address_line2,
			city,
			state,
			postal_code,
			country,
			is_primary,
			created_at,
			updated_at
		`,
		params.CollegeID,
		params.StudentID,
		params.ContactID,
		params.ContactName,
		params.Relationship,
		params.Phone,
		params.AlternatePhone,
		params.Email,
		params.AddressLine1,
		params.AddressLine2,
		params.City,
		params.State,
		params.PostalCode,
		params.Country,
		params.IsPrimary,
	)

	contact, err := scanEmergencyContact(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return EmergencyContact{}, ErrNotFound
		}

		if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			return EmergencyContact{}, ErrConflict
		}

		return EmergencyContact{}, err
	}

	return contact, nil
}

func (r *Repository) DeleteEmergencyContact(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
	contactID uuid.UUID,
) error {
	result, err := r.Executor(ctx).Exec(
		ctx,
		`
		DELETE FROM app.emergency_contacts
		WHERE college_id = $1
		  AND student_id = $2
		  AND id = $3
		`,
		collegeID,
		studentID,
		contactID,
	)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}
