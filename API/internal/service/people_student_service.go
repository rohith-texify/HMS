package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/google/uuid"
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
	repository *repository.Repository
}

// NewStudentService creates a new StudentService.
func NewStudentService(repo *repository.Repository) *StudentService {
	return &StudentService{
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
	return strings.ToUpper(strings.TrimSpace(status))
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
