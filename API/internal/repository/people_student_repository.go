package repository

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Student represents a row from app.students.
//
// Tenant isolation is enforced by PostgreSQL RLS.
// college_id is therefore always carried through repository operations.
type Student struct {
	ID                 uuid.UUID       `json:"id"`
	CollegeID          uuid.UUID       `json:"college_id"`
	UserID             *uuid.UUID      `json:"user_id,omitempty"`
	AdmissionNumber    string          `json:"admission_number"`
	RegistrationNumber *string         `json:"registration_number,omitempty"`
	RollNumber         *string         `json:"roll_number,omitempty"`
	FirstName          string          `json:"first_name"`
	MiddleName         *string         `json:"middle_name,omitempty"`
	LastName           *string         `json:"last_name,omitempty"`
	DateOfBirth        *time.Time      `json:"date_of_birth,omitempty"`
	Gender             *string         `json:"gender,omitempty"`
	BloodGroup         *string         `json:"blood_group,omitempty"`
	Phone              *string         `json:"phone,omitempty"`
	Email              *string         `json:"email,omitempty"`
	AddressLine1       *string         `json:"address_line1,omitempty"`
	AddressLine2       *string         `json:"address_line2,omitempty"`
	City               *string         `json:"city,omitempty"`
	State              *string         `json:"state,omitempty"`
	PostalCode         *string         `json:"postal_code,omitempty"`
	Country            *string         `json:"country,omitempty"`
	DepartmentID       *uuid.UUID      `json:"department_id,omitempty"`
	ProgramID          *uuid.UUID      `json:"program_id,omitempty"`
	CourseID           *uuid.UUID      `json:"course_id,omitempty"`
	BatchID            *uuid.UUID      `json:"batch_id,omitempty"`
	AcademicYearID     *uuid.UUID      `json:"academic_year_id,omitempty"`
	SemesterID         *uuid.UUID      `json:"semester_id,omitempty"`
	AdmissionDate      *time.Time      `json:"admission_date,omitempty"`
	StudentStatus      string          `json:"student_status"`
	HostelStatus       string          `json:"hostel_status"`
	Metadata           json.RawMessage `json:"metadata"`
	CreatedAt          time.Time       `json:"created_at"`
	UpdatedAt          time.Time       `json:"updated_at"`
}

// CreateStudentParams contains fields accepted when creating a student.
//
// ID, timestamps, student_status, hostel_status and metadata use
// database defaults when not explicitly supplied.
type CreateStudentParams struct {
	CollegeID          uuid.UUID
	UserID             *uuid.UUID
	AdmissionNumber    string
	RegistrationNumber *string
	RollNumber         *string
	FirstName          string
	MiddleName         *string
	LastName           *string
	DateOfBirth        *time.Time
	Gender             *string
	BloodGroup         *string
	Phone              *string
	Email              *string
	AddressLine1       *string
	AddressLine2       *string
	City               *string
	State              *string
	PostalCode         *string
	Country            *string
	DepartmentID       *uuid.UUID
	ProgramID          *uuid.UUID
	CourseID           *uuid.UUID
	BatchID            *uuid.UUID
	AcademicYearID     *uuid.UUID
	SemesterID         *uuid.UUID
	AdmissionDate      *time.Time
	StudentStatus      *string
	HostelStatus       *string
	Metadata           json.RawMessage
}

// UpdateStudentParams contains mutable student profile fields.
//
// Identity fields such as ID and CollegeID are intentionally excluded.
type UpdateStudentParams struct {
	UserID             *uuid.UUID
	AdmissionNumber    string
	RegistrationNumber *string
	RollNumber         *string
	FirstName          string
	MiddleName         *string
	LastName           *string
	DateOfBirth        *time.Time
	Gender             *string
	BloodGroup         *string
	Phone              *string
	Email              *string
	AddressLine1       *string
	AddressLine2       *string
	City               *string
	State              *string
	PostalCode         *string
	Country            *string
	DepartmentID       *uuid.UUID
	ProgramID          *uuid.UUID
	CourseID           *uuid.UUID
	BatchID            *uuid.UUID
	AcademicYearID     *uuid.UUID
	SemesterID         *uuid.UUID
	AdmissionDate      *time.Time
}

// ListStudentsParams controls tenant-scoped student listing.
type ListStudentsParams struct {
	CollegeID     uuid.UUID
	StudentStatus *string
	HostelStatus  *string
	Limit         int
	Offset        int
}

// GetStudentByID returns a single student belonging to the supplied college.
func (r *Repository) GetStudentByID(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
) (Student, error) {
	const query = `
		SELECT
			id,
			college_id,
			user_id,
			admission_number,
			registration_number,
			roll_number,
			first_name,
			middle_name,
			last_name,
			date_of_birth,
			gender,
			blood_group,
			phone,
			email,
			address_line1,
			address_line2,
			city,
			state,
			postal_code,
			country,
			department_id,
			program_id,
			course_id,
			batch_id,
			academic_year_id,
			semester_id,
			admission_date,
			student_status,
			hostel_status,
			metadata,
			created_at,
			updated_at
		FROM app.students
		WHERE college_id = $1
		  AND id = $2
	`

	return scanStudent(
		r.Executor(ctx).QueryRow(ctx, query, collegeID, studentID),
	)
}

// ListStudents returns students belonging to the supplied college.
//
// The query intentionally includes college_id so repository callers cannot
// accidentally perform a cross-tenant lookup.
func (r *Repository) ListStudents(
	ctx context.Context,
	params ListStudentsParams,
) ([]Student, error) {
	limit := params.Limit
	offset := params.Offset

	if limit <= 0 {
		limit = 50
	}

	if limit > 100 {
		limit = 100
	}

	if offset < 0 {
		offset = 0
	}

	const query = `
		SELECT
			id,
			college_id,
			user_id,
			admission_number,
			registration_number,
			roll_number,
			first_name,
			middle_name,
			last_name,
			date_of_birth,
			gender,
			blood_group,
			phone,
			email,
			address_line1,
			address_line2,
			city,
			state,
			postal_code,
			country,
			department_id,
			program_id,
			course_id,
			batch_id,
			academic_year_id,
			semester_id,
			admission_date,
			student_status,
			hostel_status,
			metadata,
			created_at,
			updated_at
		FROM app.students
		WHERE college_id = $1
		  AND ($2::text IS NULL OR student_status = $2)
		  AND ($3::text IS NULL OR hostel_status = $3)
		ORDER BY created_at DESC, id DESC
		LIMIT $4
		OFFSET $5
	`

	rows, err := r.Executor(ctx).Query(
		ctx,
		query,
		params.CollegeID,
		params.StudentStatus,
		params.HostelStatus,
		limit,
		offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	students := make([]Student, 0)

	for rows.Next() {
		student, err := scanStudentRow(rows)
		if err != nil {
			return nil, err
		}

		students = append(students, student)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return students, nil
}

// CreateStudent inserts a new student into app.students.
func (r *Repository) CreateStudent(
	ctx context.Context,
	params CreateStudentParams,
) (Student, error) {
	metadata := params.Metadata

	if len(metadata) == 0 {
		metadata = json.RawMessage(`{}`)
	}

	const query = `
		INSERT INTO app.students (
			college_id,
			user_id,
			admission_number,
			registration_number,
			roll_number,
			first_name,
			middle_name,
			last_name,
			date_of_birth,
			gender,
			blood_group,
			phone,
			email,
			address_line1,
			address_line2,
			city,
			state,
			postal_code,
			country,
			department_id,
			program_id,
			course_id,
			batch_id,
			academic_year_id,
			semester_id,
			admission_date,
			student_status,
			hostel_status,
			metadata
		)
		VALUES (
			$1,
			$2,
			$3,
			$4,
			$5,
			$6,
			$7,
			$8,
			$9,
			$10,
			$11,
			$12,
			$13,
			$14,
			$15,
			$16,
			$17,
			$18,
			$19,
			$20,
			$21,
			$22,
			$23,
			$24,
			$25,
			$26,
			COALESCE($27, 'ACTIVE'),
			COALESCE($28, 'NOT_ALLOCATED'),
			$29
		)
		RETURNING
			id,
			college_id,
			user_id,
			admission_number,
			registration_number,
			roll_number,
			first_name,
			middle_name,
			last_name,
			date_of_birth,
			gender,
			blood_group,
			phone,
			email,
			address_line1,
			address_line2,
			city,
			state,
			postal_code,
			country,
			department_id,
			program_id,
			course_id,
			batch_id,
			academic_year_id,
			semester_id,
			admission_date,
			student_status,
			hostel_status,
			metadata,
			created_at,
			updated_at
	`

	return scanStudent(
		r.Executor(ctx).QueryRow(
			ctx,
			query,
			params.CollegeID,
			params.UserID,
			params.AdmissionNumber,
			params.RegistrationNumber,
			params.RollNumber,
			params.FirstName,
			params.MiddleName,
			params.LastName,
			params.DateOfBirth,
			params.Gender,
			params.BloodGroup,
			params.Phone,
			params.Email,
			params.AddressLine1,
			params.AddressLine2,
			params.City,
			params.State,
			params.PostalCode,
			params.Country,
			params.DepartmentID,
			params.ProgramID,
			params.CourseID,
			params.BatchID,
			params.AcademicYearID,
			params.SemesterID,
			params.AdmissionDate,
			params.StudentStatus,
			params.HostelStatus,
			metadata,
		),
	)
}

// UpdateStudent updates the editable profile/academic fields of a student.
func (r *Repository) UpdateStudent(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
	params UpdateStudentParams,
) (Student, error) {
	const query = `
		UPDATE app.students
		SET
			user_id = $3,
			admission_number = $4,
			registration_number = $5,
			roll_number = $6,
			first_name = $7,
			middle_name = $8,
			last_name = $9,
			date_of_birth = $10,
			gender = $11,
			blood_group = $12,
			phone = $13,
			email = $14,
			address_line1 = $15,
			address_line2 = $16,
			city = $17,
			state = $18,
			postal_code = $19,
			country = $20,
			department_id = $21,
			program_id = $22,
			course_id = $23,
			batch_id = $24,
			academic_year_id = $25,
			semester_id = $26,
			admission_date = $27,
			updated_at = CURRENT_TIMESTAMP
		WHERE college_id = $1
		  AND id = $2
		RETURNING
			id,
			college_id,
			user_id,
			admission_number,
			registration_number,
			roll_number,
			first_name,
			middle_name,
			last_name,
			date_of_birth,
			gender,
			blood_group,
			phone,
			email,
			address_line1,
			address_line2,
			city,
			state,
			postal_code,
			country,
			department_id,
			program_id,
			course_id,
			batch_id,
			academic_year_id,
			semester_id,
			admission_date,
			student_status,
			hostel_status,
			metadata,
			created_at,
			updated_at
	`

	return scanStudent(
		r.Executor(ctx).QueryRow(
			ctx,
			query,
			collegeID,
			studentID,
			params.UserID,
			params.AdmissionNumber,
			params.RegistrationNumber,
			params.RollNumber,
			params.FirstName,
			params.MiddleName,
			params.LastName,
			params.DateOfBirth,
			params.Gender,
			params.BloodGroup,
			params.Phone,
			params.Email,
			params.AddressLine1,
			params.AddressLine2,
			params.City,
			params.State,
			params.PostalCode,
			params.Country,
			params.DepartmentID,
			params.ProgramID,
			params.CourseID,
			params.BatchID,
			params.AcademicYearID,
			params.SemesterID,
			params.AdmissionDate,
		),
	)
}

// UpdateStudentStatus changes only the student lifecycle status.
//
// Valid status values should be validated by the service layer because
// repository code should remain responsible for persistence rather than
// business-policy decisions.
func (r *Repository) UpdateStudentStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
	status string,
) (Student, error) {
	status = strings.TrimSpace(status)

	const query = `
		UPDATE app.students
		SET
			student_status = $3,
			updated_at = CURRENT_TIMESTAMP
		WHERE college_id = $1
		  AND id = $2
		RETURNING
			id,
			college_id,
			user_id,
			admission_number,
			registration_number,
			roll_number,
			first_name,
			middle_name,
			last_name,
			date_of_birth,
			gender,
			blood_group,
			phone,
			email,
			address_line1,
			address_line2,
			city,
			state,
			postal_code,
			country,
			department_id,
			program_id,
			course_id,
			batch_id,
			academic_year_id,
			semester_id,
			admission_date,
			student_status,
			hostel_status,
			metadata,
			created_at,
			updated_at
	`

	return scanStudent(
		r.Executor(ctx).QueryRow(
			ctx,
			query,
			collegeID,
			studentID,
			status,
		),
	)
}

// DeleteStudent is intentionally NOT provided.
//
// HMS follows a disable/status-based lifecycle instead of hard deletion.
// Student lifecycle changes should therefore go through UpdateStudentStatus.
func isStudentNotFound(err error) bool {
	return errors.Is(err, pgx.ErrNoRows)
}

// IsStudentNotFound exposes the repository's not-found classification
// without requiring callers to depend directly on pgx.
func IsStudentNotFound(err error) bool {
	return isStudentNotFound(err)
}

// IsStudentConflict identifies PostgreSQL uniqueness violations.
//
// The service layer can map this to a domain conflict error.
func IsStudentConflict(err error) bool {
	var pgErr *pgconn.PgError

	if !errors.As(err, &pgErr) {
		return false
	}

	return pgErr.Code == "23505"
}

// scanStudent scans one app.students row.
func scanStudent(row pgx.Row) (Student, error) {
	var student Student

	err := row.Scan(
		&student.ID,
		&student.CollegeID,
		&student.UserID,
		&student.AdmissionNumber,
		&student.RegistrationNumber,
		&student.RollNumber,
		&student.FirstName,
		&student.MiddleName,
		&student.LastName,
		&student.DateOfBirth,
		&student.Gender,
		&student.BloodGroup,
		&student.Phone,
		&student.Email,
		&student.AddressLine1,
		&student.AddressLine2,
		&student.City,
		&student.State,
		&student.PostalCode,
		&student.Country,
		&student.DepartmentID,
		&student.ProgramID,
		&student.CourseID,
		&student.BatchID,
		&student.AcademicYearID,
		&student.SemesterID,
		&student.AdmissionDate,
		&student.StudentStatus,
		&student.HostelStatus,
		&student.Metadata,
		&student.CreatedAt,
		&student.UpdatedAt,
	)

	if err != nil {
		return Student{}, err
	}

	return student, nil
}

// scanStudentRow scans one student row returned from pgx.Rows.
func scanStudentRow(row pgx.Rows) (Student, error) {
	var student Student

	err := row.Scan(
		&student.ID,
		&student.CollegeID,
		&student.UserID,
		&student.AdmissionNumber,
		&student.RegistrationNumber,
		&student.RollNumber,
		&student.FirstName,
		&student.MiddleName,
		&student.LastName,
		&student.DateOfBirth,
		&student.Gender,
		&student.BloodGroup,
		&student.Phone,
		&student.Email,
		&student.AddressLine1,
		&student.AddressLine2,
		&student.City,
		&student.State,
		&student.PostalCode,
		&student.Country,
		&student.DepartmentID,
		&student.ProgramID,
		&student.CourseID,
		&student.BatchID,
		&student.AcademicYearID,
		&student.SemesterID,
		&student.AdmissionDate,
		&student.StudentStatus,
		&student.HostelStatus,
		&student.Metadata,
		&student.CreatedAt,
		&student.UpdatedAt,
	)

	if err != nil {
		return Student{}, err
	}

	return student, nil
}
