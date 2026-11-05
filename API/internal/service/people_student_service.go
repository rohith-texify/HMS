package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/yourusername/hostel-management-system/API/internal/database"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

var (
	ErrInvalidStudentID       = errors.New("invalid student id")
	ErrInvalidCollegeID       = errors.New("invalid college id")
	ErrInvalidAdmissionNumber = errors.New("invalid admission number")
	ErrInvalidFirstName       = errors.New("invalid first name")
	ErrInvalidStudentStatus   = errors.New("invalid student status")
	ErrInvalidHostelStatus    = errors.New("invalid hostel status")
	ErrStudentNotFound        = errors.New("student not found")
	ErrStudentConflict        = errors.New("student already exists")
	ErrInvalidPagination      = errors.New("invalid pagination")
	ErrInvalidStudentMetadata = errors.New("invalid student metadata")
)

// Student status values defined by app.students.chk_students_status.
const (
	StudentStatusActive      = "ACTIVE"
	StudentStatusInactive    = "INACTIVE"
	StudentStatusSuspended   = "SUSPENDED"
	StudentStatusGraduated   = "GRADUATED"
	StudentStatusTransferred = "TRANSFERRED"
	StudentStatusDropped     = "DROPPED"
)

// Hostel status values defined by app.students.chk_students_hostel_status.
const (
	HostelStatusNotAllocated = "NOT_ALLOCATED"
	HostelStatusAllocated    = "ALLOCATED"
	HostelStatusVacated      = "VACATED"
	HostelStatusBlocked      = "BLOCKED"
)

// StudentService provides business operations for app.students.
type StudentService struct {
	db         *database.Database
	repository *repository.Repository
}

// NewStudentService creates a new StudentService.
func NewStudentService(db *database.Database, repo *repository.Repository) *StudentService {
	return &StudentService{
		db:         db,
		repository: repo,
	}
}

// ListStudents retrieves students belonging to the authenticated college.
func (s *StudentService) ListStudents(
	ctx context.Context,
	params repository.ListStudentsParams,
) ([]repository.Student, error) {
	if s.repository == nil {
		return nil, errors.New("student repository is unavailable")
	}

	if params.CollegeID == uuid.Nil {
		return nil, ErrInvalidCollegeID
	}

	if params.Limit < 0 || params.Offset < 0 {
		return nil, ErrInvalidPagination
	}

	if params.StudentStatus != nil {
		status := normalizeStudentStatus(*params.StudentStatus)

		if !isValidStudentStatus(status) {
			return nil, ErrInvalidStudentStatus
		}

		params.StudentStatus = &status
	}

	if params.HostelStatus != nil {
		status := normalizeHostelStatus(*params.HostelStatus)

		if !isValidHostelStatus(status) {
			return nil, ErrInvalidHostelStatus
		}

		params.HostelStatus = &status
	}

	return s.repository.ListStudents(ctx, params)
}

// GetStudentByID retrieves one student from the authenticated college.
func (s *StudentService) GetStudentByID(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
) (repository.Student, error) {
	if s.repository == nil {
		return repository.Student{}, errors.New("student repository is unavailable")
	}

	if collegeID == uuid.Nil {
		return repository.Student{}, ErrInvalidCollegeID
	}

	if studentID == uuid.Nil {
		return repository.Student{}, ErrInvalidStudentID
	}

	student, err := s.repository.GetStudentByID(
		ctx,
		collegeID,
		studentID,
	)
	if err != nil {
		if repository.IsStudentNotFound(err) {
			return repository.Student{}, ErrStudentNotFound
		}

		return repository.Student{}, err
	}

	return student, nil
}

// CreateStudent creates a new student within the authenticated college.
func (s *StudentService) CreateStudent(
	ctx context.Context,
	params repository.CreateStudentParams,
) (repository.Student, error) {
	if s.repository == nil {
		return repository.Student{}, errors.New("student repository is unavailable")
	}

	if err := validateCreateStudentParams(&params); err != nil {
		return repository.Student{}, err
	}

	// If password is provided, provision user credentials and role for student portal login access
	if params.Password != nil && strings.TrimSpace(*params.Password) != "" {
		pwd := strings.TrimSpace(*params.Password)
		if len(pwd) < 8 {
			return repository.Student{}, errors.New("password must be at least 8 characters long")
		}

		if params.ConfirmPassword != nil && strings.TrimSpace(*params.ConfirmPassword) != "" {
			if pwd != strings.TrimSpace(*params.ConfirmPassword) {
				return repository.Student{}, errors.New("password and confirm password do not match")
			}
		}

		if params.Email == nil || strings.TrimSpace(*params.Email) == "" {
			return repository.Student{}, errors.New("institutional email is required to create a student portal account")
		}

		email := strings.ToLower(strings.TrimSpace(*params.Email))

		hash, err := bcrypt.GenerateFromPassword([]byte(pwd), bcrypt.DefaultCost)
		if err != nil {
			return repository.Student{}, fmt.Errorf("failed to hash student password: %w", err)
		}

		var createdStudent repository.Student

		if s.db != nil {
			txErr := s.db.WithTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
				// 0. Concurrency-Safe Student Quota Enforcement
				var maxStudents int
				if qErr := tx.QueryRow(txCtx, `
					SELECT COALESCE(max_students, 500) FROM platform.colleges WHERE college_id = $1 FOR UPDATE
				`, params.CollegeID).Scan(&maxStudents); qErr == nil {
					var activeStudentsCount int
					_ = tx.QueryRow(txCtx, `
						SELECT COUNT(*) FROM app.students s
						JOIN app.users u ON s.user_id = u.user_id
						WHERE s.college_id = $1 AND s.student_status = 'ACTIVE' AND u.status = 'ACTIVE'
					`, params.CollegeID).Scan(&activeStudentsCount)
					if activeStudentsCount >= maxStudents {
						return fmt.Errorf("student account limit reached for this college (limit: %d, currently active: %d). Contact Super Admin to increase quota", maxStudents, activeStudentsCount)
					}
				}

				// 1. Check or insert into app.users
				var userID uuid.UUID
				err := tx.QueryRow(txCtx, `
					SELECT user_id FROM app.users WHERE LOWER(email) = LOWER($1)
				`, email).Scan(&userID)

				var phoneVal *string
				if params.Phone != nil && strings.TrimSpace(*params.Phone) != "" {
					p := strings.TrimSpace(*params.Phone)
					phoneVal = &p
				}

				if err != nil && errors.Is(err, pgx.ErrNoRows) {
					userID = uuid.New()
					_, err = tx.Exec(txCtx, `
						INSERT INTO app.users (user_id, email, phone, password_hash, status)
						VALUES ($1, $2, $3, $4, 'ACTIVE')
					`, userID, email, phoneVal, string(hash))
					if err != nil {
						return fmt.Errorf("failed to create student user account: %w", err)
					}
				} else if err != nil {
					return fmt.Errorf("failed to check existing user: %w", err)
				} else {
					_, err = tx.Exec(txCtx, `
						UPDATE app.users
						SET password_hash = $1, status = 'ACTIVE', phone = COALESCE(NULLIF($2, ''), phone), updated_at = NOW()
						WHERE user_id = $3
					`, string(hash), phoneVal, userID)
					if err != nil {
						return fmt.Errorf("failed to update student credentials: %w", err)
					}
				}

				// 2. Ensure STUDENT role exists and assign user_roles
				var roleID uuid.UUID
				err = tx.QueryRow(txCtx, `
					SELECT role_id FROM platform.roles WHERE role_code = 'STUDENT'
				`).Scan(&roleID)
				if err != nil {
					roleID = uuid.New()
					_, err = tx.Exec(txCtx, `
						INSERT INTO platform.roles (role_id, role_code, role_name, scope, is_system_role)
						VALUES ($1, 'STUDENT', 'Student', 'COLLEGE', true)
						ON CONFLICT (role_code) DO NOTHING
					`, roleID)
					if err != nil {
						return fmt.Errorf("failed to ensure student role: %w", err)
					}
					_ = tx.QueryRow(txCtx, `SELECT role_id FROM platform.roles WHERE role_code = 'STUDENT'`).Scan(&roleID)
				}

				var userRoleID uuid.UUID
				err = tx.QueryRow(txCtx, `
					SELECT user_role_id FROM platform.user_roles
					WHERE user_id = $1 AND role_id = $2 AND college_id = $3
				`, userID, roleID, params.CollegeID).Scan(&userRoleID)
				if err != nil && errors.Is(err, pgx.ErrNoRows) {
					_, err = tx.Exec(txCtx, `
						INSERT INTO platform.user_roles (user_role_id, user_id, role_id, college_id, status)
						VALUES (gen_random_uuid(), $1, $2, $3, 'ACTIVE')
					`, userID, roleID, params.CollegeID)
					if err != nil {
						return fmt.Errorf("failed to grant student role: %w", err)
					}
				}

				// 3. Bind UserID and insert student
				params.UserID = &userID
				created, err := s.repository.CreateStudent(txCtx, params)
				if err != nil {
					return err
				}
				createdStudent = created
				return nil
			})

			if txErr != nil {
				if repository.IsStudentConflict(txErr) {
					return repository.Student{}, ErrStudentConflict
				}
				return repository.Student{}, txErr
			}

			return createdStudent, nil
		}
	}

	if s.db != nil {
		var createdStudent repository.Student
		txErr := s.db.WithTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
			// Concurrency-Safe Student Quota Enforcement
			var maxStudents int
			if qErr := tx.QueryRow(txCtx, `
				SELECT COALESCE(max_students, 500) FROM platform.colleges WHERE college_id = $1 FOR UPDATE
			`, params.CollegeID).Scan(&maxStudents); qErr == nil {
				var activeStudentsCount int
				_ = tx.QueryRow(txCtx, `
					SELECT COUNT(*) FROM app.students s
					JOIN app.users u ON s.user_id = u.user_id
					WHERE s.college_id = $1 AND s.student_status = 'ACTIVE' AND u.status = 'ACTIVE'
				`, params.CollegeID).Scan(&activeStudentsCount)
				if activeStudentsCount >= maxStudents {
					return fmt.Errorf("student account limit reached for this college (limit: %d, currently active: %d). Contact Super Admin to increase quota", maxStudents, activeStudentsCount)
				}
			}

			st, err := s.repository.CreateStudent(txCtx, params)
			if err != nil {
				return err
			}
			createdStudent = st
			return nil
		})
		if txErr != nil {
			if repository.IsStudentConflict(txErr) {
				return repository.Student{}, ErrStudentConflict
			}
			return repository.Student{}, txErr
		}
		return createdStudent, nil
	}

	student, err := s.repository.CreateStudent(ctx, params)
	if err != nil {
		if repository.IsStudentConflict(err) {
			return repository.Student{}, ErrStudentConflict
		}

		return repository.Student{}, err
	}

	return student, nil
}

// UpdateStudent updates an existing student's profile and academic data.
func (s *StudentService) UpdateStudent(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
	params repository.UpdateStudentParams,
) (repository.Student, error) {
	if s.repository == nil {
		return repository.Student{}, errors.New("student repository is unavailable")
	}

	if collegeID == uuid.Nil {
		return repository.Student{}, ErrInvalidCollegeID
	}

	if studentID == uuid.Nil {
		return repository.Student{}, ErrInvalidStudentID
	}

	if err := validateUpdateStudentParams(&params); err != nil {
		return repository.Student{}, err
	}

	student, err := s.repository.UpdateStudent(
		ctx,
		collegeID,
		studentID,
		params,
	)
	if err != nil {
		if repository.IsStudentNotFound(err) {
			return repository.Student{}, ErrStudentNotFound
		}

		if repository.IsStudentConflict(err) {
			return repository.Student{}, ErrStudentConflict
		}

		return repository.Student{}, err
	}

	return student, nil
}

// UpdateStudentStatus changes the lifecycle status of a student.
func (s *StudentService) UpdateStudentStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
	status string,
) (repository.Student, error) {
	if s.repository == nil {
		return repository.Student{}, errors.New("student repository is unavailable")
	}

	if collegeID == uuid.Nil {
		return repository.Student{}, ErrInvalidCollegeID
	}

	if studentID == uuid.Nil {
		return repository.Student{}, ErrInvalidStudentID
	}

	status = normalizeStudentStatus(status)

	if !isValidStudentStatus(status) {
		return repository.Student{}, ErrInvalidStudentStatus
	}

	// Concurrency-Safe Student Reactivation Quota Enforcement
	if status == "ACTIVE" && s.db != nil {
		existing, getErr := s.repository.GetStudentByID(ctx, collegeID, studentID)
		if getErr == nil && existing.StudentStatus != "ACTIVE" {
			var quotaErr error
			txErr := s.db.WithTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
				var maxStudents int
				if qErr := tx.QueryRow(txCtx, `
					SELECT COALESCE(max_students, 500) FROM platform.colleges WHERE college_id = $1 FOR UPDATE
				`, collegeID).Scan(&maxStudents); qErr == nil {
					var activeStudentsCount int
					_ = tx.QueryRow(txCtx, `
						SELECT COUNT(*) FROM app.students s
						JOIN app.users u ON s.user_id = u.user_id
						WHERE s.college_id = $1 AND s.student_status = 'ACTIVE' AND u.status = 'ACTIVE'
					`, collegeID).Scan(&activeStudentsCount)
					if activeStudentsCount >= maxStudents {
						return fmt.Errorf("cannot reactivate student: college student account limit reached (%d/%d). Increase quota in Super Admin", activeStudentsCount, maxStudents)
					}
				}
				return nil
			})
			if txErr != nil {
				return repository.Student{}, txErr
			}
			if quotaErr != nil {
				return repository.Student{}, quotaErr
			}
		}
	}

	student, err := s.repository.UpdateStudentStatus(
		ctx,
		collegeID,
		studentID,
		status,
	)
	if err != nil {
		if repository.IsStudentNotFound(err) {
			return repository.Student{}, ErrStudentNotFound
		}

		return repository.Student{}, err
	}

	return student, nil
}

// validateCreateStudentParams validates fields required for creating a student.
func validateCreateStudentParams(
	params *repository.CreateStudentParams,
) error {
	if params == nil {
		return errors.New("student parameters are required")
	}

	if params.CollegeID == uuid.Nil {
		return ErrInvalidCollegeID
	}

	params.AdmissionNumber = strings.TrimSpace(params.AdmissionNumber)

	if params.AdmissionNumber == "" {
		return ErrInvalidAdmissionNumber
	}

	params.FirstName = strings.TrimSpace(params.FirstName)

	if params.FirstName == "" {
		return ErrInvalidFirstName
	}

	if params.RegistrationNumber != nil {
		value := strings.TrimSpace(*params.RegistrationNumber)

		if value == "" {
			params.RegistrationNumber = nil
		} else {
			params.RegistrationNumber = &value
		}
	}

	if params.RollNumber != nil {
		value := strings.TrimSpace(*params.RollNumber)

		if value == "" {
			params.RollNumber = nil
		} else {
			params.RollNumber = &value
		}
	}

	normalizeOptionalString(&params.MiddleName)
	normalizeOptionalString(&params.LastName)
	normalizeOptionalString(&params.Gender)
	normalizeOptionalString(&params.BloodGroup)
	normalizeOptionalString(&params.Phone)
	normalizeOptionalString(&params.Email)
	normalizeOptionalString(&params.AddressLine1)
	normalizeOptionalString(&params.AddressLine2)
	normalizeOptionalString(&params.City)
	normalizeOptionalString(&params.State)
	normalizeOptionalString(&params.PostalCode)
	normalizeOptionalString(&params.Country)

	if params.StudentStatus != nil {
		status := normalizeStudentStatus(*params.StudentStatus)

		if !isValidStudentStatus(status) {
			return ErrInvalidStudentStatus
		}

		params.StudentStatus = &status
	}

	if params.HostelStatus != nil {
		status := normalizeHostelStatus(*params.HostelStatus)

		if !isValidHostelStatus(status) {
			return ErrInvalidHostelStatus
		}

		params.HostelStatus = &status
	}

	if len(params.Metadata) == 0 {
		params.Metadata = json.RawMessage(`{}`)
	}

	if !json.Valid(params.Metadata) {
		return ErrInvalidStudentMetadata
	}

	return nil
}

// validateUpdateStudentParams validates fields accepted during student updates.
func validateUpdateStudentParams(
	params *repository.UpdateStudentParams,
) error {
	if params == nil {
		return errors.New("student parameters are required")
	}

	params.AdmissionNumber = strings.TrimSpace(params.AdmissionNumber)

	if params.AdmissionNumber == "" {
		return ErrInvalidAdmissionNumber
	}

	params.FirstName = strings.TrimSpace(params.FirstName)

	if params.FirstName == "" {
		return ErrInvalidFirstName
	}

	if params.RegistrationNumber != nil {
		value := strings.TrimSpace(*params.RegistrationNumber)

		if value == "" {
			params.RegistrationNumber = nil
		} else {
			params.RegistrationNumber = &value
		}
	}

	if params.RollNumber != nil {
		value := strings.TrimSpace(*params.RollNumber)

		if value == "" {
			params.RollNumber = nil
		} else {
			params.RollNumber = &value
		}
	}

	normalizeOptionalString(&params.MiddleName)
	normalizeOptionalString(&params.LastName)
	normalizeOptionalString(&params.Gender)
	normalizeOptionalString(&params.BloodGroup)
	normalizeOptionalString(&params.Phone)
	normalizeOptionalString(&params.Email)
	normalizeOptionalString(&params.AddressLine1)
	normalizeOptionalString(&params.AddressLine2)
	normalizeOptionalString(&params.City)
	normalizeOptionalString(&params.State)
	normalizeOptionalString(&params.PostalCode)
	normalizeOptionalString(&params.Country)

	return nil
}

// normalizeOptionalString trims optional string fields and converts blank
// values into nil.
func normalizeOptionalString(value **string) {
	if value == nil || *value == nil {
		return
	}

	trimmed := strings.TrimSpace(**value)

	if trimmed == "" {
		*value = nil
		return
	}

	*value = &trimmed
}

func normalizeStudentStatus(status string) string {
	return strings.ToUpper(strings.TrimSpace(status))
}

func normalizeHostelStatus(status string) string {
	s := strings.ToUpper(strings.TrimSpace(status))
	if s == "UNALLOCATED" {
		return HostelStatusNotAllocated
	}
	return s
}

func isValidStudentStatus(status string) bool {
	switch status {
	case StudentStatusActive,
		StudentStatusInactive,
		StudentStatusSuspended,
		StudentStatusGraduated,
		StudentStatusTransferred,
		StudentStatusDropped:
		return true
	default:
		return false
	}
}

func isValidHostelStatus(status string) bool {
	switch status {
	case HostelStatusNotAllocated,
		HostelStatusAllocated,
		HostelStatusVacated,
		HostelStatusBlocked:
		return true
	default:
		return false
	}
}

// IsStudentNotFound exposes service-level not-found classification.
func IsStudentNotFound(err error) bool {
	return errors.Is(err, ErrStudentNotFound)
}

// IsStudentConflict exposes service-level conflict classification.
func IsStudentConflict(err error) bool {
	return errors.Is(err, ErrStudentConflict)
}

// IsValidStudentStatus exposes student-status validation to handlers/tests.
func IsValidStudentStatus(status string) bool {
	return isValidStudentStatus(normalizeStudentStatus(status))
}

// IsValidHostelStatus exposes hostel-status validation to handlers/tests.
func IsValidHostelStatus(status string) bool {
	return isValidHostelStatus(normalizeHostelStatus(status))
}
