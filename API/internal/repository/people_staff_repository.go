package repository

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
)

type StaffProfile struct {
	ID               uuid.UUID              `json:"id"`
	CollegeID        uuid.UUID              `json:"college_id"`
	UserID           uuid.UUID              `json:"user_id"`
	EmployeeNumber   *string                `json:"employee_number,omitempty"`
	FirstName        string                 `json:"first_name"`
	MiddleName       *string                `json:"middle_name,omitempty"`
	LastName         *string                `json:"last_name,omitempty"`
	Designation      *string                `json:"designation,omitempty"`
	DepartmentID     *uuid.UUID             `json:"department_id,omitempty"`
	Phone            *string                `json:"phone,omitempty"`
	AlternatePhone   *string                `json:"alternate_phone,omitempty"`
	Email            *string                `json:"email,omitempty"`
	JoiningDate      *time.Time             `json:"joining_date,omitempty"`
	EmploymentStatus string                 `json:"employment_status"`
	Metadata         map[string]interface{} `json:"metadata"`
	CreatedAt        time.Time              `json:"created_at"`
	UpdatedAt        time.Time              `json:"updated_at"`
}

func (r *Repository) ListStaffProfiles(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]StaffProfile, error) {
	rows, err := r.Executor(ctx).Query(ctx, `
		SELECT
			id,
			college_id,
			user_id,
			employee_number,
			first_name,
			middle_name,
			last_name,
			designation,
			department_id,
			phone,
			alternate_phone,
			email,
			joining_date,
			employment_status,
			metadata,
			created_at,
			updated_at
		FROM app.staff_profiles
		WHERE college_id = $1
		ORDER BY first_name, last_name, created_at
	`, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []StaffProfile

	for rows.Next() {
		var s StaffProfile

		if err := rows.Scan(
			&s.ID,
			&s.CollegeID,
			&s.UserID,
			&s.EmployeeNumber,
			&s.FirstName,
			&s.MiddleName,
			&s.LastName,
			&s.Designation,
			&s.DepartmentID,
			&s.Phone,
			&s.AlternatePhone,
			&s.Email,
			&s.JoiningDate,
			&s.EmploymentStatus,
			&s.Metadata,
			&s.CreatedAt,
			&s.UpdatedAt,
		); err != nil {
			return nil, err
		}

		result = append(result, s)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}

func (r *Repository) GetStaffProfile(
	ctx context.Context,
	collegeID,
	staffID uuid.UUID,
) (StaffProfile, error) {
	var s StaffProfile

	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT
			id,
			college_id,
			user_id,
			employee_number,
			first_name,
			middle_name,
			last_name,
			designation,
			department_id,
			phone,
			alternate_phone,
			email,
			joining_date,
			employment_status,
			metadata,
			created_at,
			updated_at
		FROM app.staff_profiles
		WHERE college_id = $1
		  AND id = $2
	`, collegeID, staffID).Scan(
		&s.ID,
		&s.CollegeID,
		&s.UserID,
		&s.EmployeeNumber,
		&s.FirstName,
		&s.MiddleName,
		&s.LastName,
		&s.Designation,
		&s.DepartmentID,
		&s.Phone,
		&s.AlternatePhone,
		&s.Email,
		&s.JoiningDate,
		&s.EmploymentStatus,
		&s.Metadata,
		&s.CreatedAt,
		&s.UpdatedAt,
	)

	if err != nil {
		return StaffProfile{}, ErrNotFound
	}

	return s, nil
}

func (r *Repository) CreateStaffProfile(
	ctx context.Context,
	collegeID,
	userID uuid.UUID,
	employeeNumber,
	firstName,
	middleName,
	lastName,
	designation string,
	departmentID *uuid.UUID,
	phone,
	alternatePhone,
	email string,
	joiningDate *time.Time,
	employmentStatus string,
	metadata map[string]interface{},
) (StaffProfile, error) {
	var s StaffProfile

	err := r.Executor(ctx).QueryRow(ctx, `
		INSERT INTO app.staff_profiles (
			college_id,
			user_id,
			employee_number,
			first_name,
			middle_name,
			last_name,
			designation,
			department_id,
			phone,
			alternate_phone,
			email,
			joining_date,
			employment_status,
			metadata
		)
		VALUES (
			$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
		)
		RETURNING
			id,
			college_id,
			user_id,
			employee_number,
			first_name,
			middle_name,
			last_name,
			designation,
			department_id,
			phone,
			alternate_phone,
			email,
			joining_date,
			employment_status,
			metadata,
			created_at,
			updated_at
	`,
		collegeID,
		userID,
		nullString(employeeNumber),
		firstName,
		nullString(middleName),
		nullString(lastName),
		nullString(designation),
		departmentID,
		nullString(phone),
		nullString(alternatePhone),
		nullString(email),
		joiningDate,
		employmentStatus,
		metadata,
	).Scan(
		&s.ID,
		&s.CollegeID,
		&s.UserID,
		&s.EmployeeNumber,
		&s.FirstName,
		&s.MiddleName,
		&s.LastName,
		&s.Designation,
		&s.DepartmentID,
		&s.Phone,
		&s.AlternatePhone,
		&s.Email,
		&s.JoiningDate,
		&s.EmploymentStatus,
		&s.Metadata,
		&s.CreatedAt,
		&s.UpdatedAt,
	)

	return s, err
}

func (r *Repository) UpdateStaffProfile(
	ctx context.Context,
	collegeID,
	staffID uuid.UUID,
	firstName,
	middleName,
	lastName,
	designation,
	phone,
	alternatePhone,
	email string,
) (StaffProfile, error) {
	var s StaffProfile

	err := r.Executor(ctx).QueryRow(ctx, `
		UPDATE app.staff_profiles
		SET
			first_name = $3,
			middle_name = $4,
			last_name = $5,
			designation = $6,
			phone = $7,
			alternate_phone = $8,
			email = $9,
			updated_at = CURRENT_TIMESTAMP
		WHERE college_id = $1
		  AND id = $2
		RETURNING
			id,
			college_id,
			user_id,
			employee_number,
			first_name,
			middle_name,
			last_name,
			designation,
			department_id,
			phone,
			alternate_phone,
			email,
			joining_date,
			employment_status,
			metadata,
			created_at,
			updated_at
	`,
		collegeID,
		staffID,
		firstName,
		nullString(middleName),
		nullString(lastName),
		nullString(designation),
		nullString(phone),
		nullString(alternatePhone),
		nullString(email),
	).Scan(
		&s.ID,
		&s.CollegeID,
		&s.UserID,
		&s.EmployeeNumber,
		&s.FirstName,
		&s.MiddleName,
		&s.LastName,
		&s.Designation,
		&s.DepartmentID,
		&s.Phone,
		&s.AlternatePhone,
		&s.Email,
		&s.JoiningDate,
		&s.EmploymentStatus,
		&s.Metadata,
		&s.CreatedAt,
		&s.UpdatedAt,
	)

	if err != nil {
		return StaffProfile{}, ErrNotFound
	}

	return s, nil
}

func (r *Repository) UpdateStaffStatus(
	ctx context.Context,
	collegeID,
	staffID uuid.UUID,
	status string,
) (StaffProfile, error) {
	var s StaffProfile

	err := r.Executor(ctx).QueryRow(ctx, `
		UPDATE app.staff_profiles
		SET
			employment_status = $3,
			updated_at = CURRENT_TIMESTAMP
		WHERE college_id = $1
		  AND id = $2
		RETURNING
			id,
			college_id,
			user_id,
			employee_number,
			first_name,
			middle_name,
			last_name,
			designation,
			department_id,
			phone,
			alternate_phone,
			email,
			joining_date,
			employment_status,
			metadata,
			created_at,
			updated_at
	`,
		collegeID,
		staffID,
		status,
	).Scan(
		&s.ID,
		&s.CollegeID,
		&s.UserID,
		&s.EmployeeNumber,
		&s.FirstName,
		&s.MiddleName,
		&s.LastName,
		&s.Designation,
		&s.DepartmentID,
		&s.Phone,
		&s.AlternatePhone,
		&s.Email,
		&s.JoiningDate,
		&s.EmploymentStatus,
		&s.Metadata,
		&s.CreatedAt,
		&s.UpdatedAt,
	)

	if err != nil {
		return StaffProfile{}, ErrNotFound
	}

	return s, nil
}

func nullString(value string) interface{} {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}
