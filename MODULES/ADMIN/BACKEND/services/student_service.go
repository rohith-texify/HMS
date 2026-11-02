package services

import (
	"context"

	"github.com/google/uuid"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/models"
)

// ListStudents returns a paginated list of residential students in the college.
func (s *StudentService) ListStudents(
	ctx context.Context,
	collegeID uuid.UUID,
	params models.PaginationParams,
) ([]models.Student, int, error) {
	if s == nil || s.repo == nil {
		return nil, 0, apierrors.New(apierrors.InternalError, "Student service is not initialized")
	}

	params.EnsureDefaults()
	return s.repo.ListStudents(ctx, collegeID, params)
}

// GetStudentByID retrieves a student record with validation.
func (s *StudentService) GetStudentByID(
	ctx context.Context,
	collegeID, studentID uuid.UUID,
) (*models.Student, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Student service is not initialized")
	}

	if studentID == uuid.Nil {
		return nil, apierrors.New(apierrors.InvalidInput, "Valid student ID is required")
	}

	return s.repo.GetStudentByID(ctx, collegeID, studentID)
}

// UpdateStudentStatus modifies enrollment status for a student.
func (s *StudentService) UpdateStudentStatus(
	ctx context.Context,
	collegeID, studentID uuid.UUID,
	status string,
) error {
	if s == nil || s.repo == nil {
		return apierrors.New(apierrors.InternalError, "Student service is not initialized")
	}

	if studentID == uuid.Nil {
		return apierrors.New(apierrors.InvalidInput, "Valid student ID is required")
	}

	if status == "" {
		return apierrors.New(apierrors.InvalidInput, "Status cannot be empty")
	}

	return s.repo.UpdateStudentStatus(ctx, collegeID, studentID, status)
}

// ListStudentParents returns all parent/guardian links for a student.
func (s *StudentService) ListStudentParents(
	ctx context.Context,
	collegeID, studentID uuid.UUID,
) ([]models.Parent, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Student service is not initialized")
	}

	if studentID == uuid.Nil {
		return nil, apierrors.New(apierrors.InvalidInput, "Valid student ID is required")
	}

	return s.repo.ListStudentParents(ctx, collegeID, studentID)
}

