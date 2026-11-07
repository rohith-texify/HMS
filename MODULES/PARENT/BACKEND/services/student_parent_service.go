package services

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/validators"
)

var (
	ErrInvalidStudentParentID         = validators.ErrInvalidStudentParentID
	ErrInvalidStudentParentCollegeID  = validators.ErrInvalidParentCollegeID
	ErrInvalidStudentParentStudentID  = validators.ErrInvalidStudentParentStudentID
	ErrInvalidStudentParentParentID   = validators.ErrInvalidStudentParentParentID
	ErrInvalidStudentParentRelation   = validators.ErrInvalidStudentParentRelation
	ErrInvalidStudentParentPagination = validators.ErrInvalidParentPagination
	ErrStudentParentNotFound          = errors.New("student-parent relationship not found")
	ErrStudentParentConflict          = errors.New("student-parent relationship conflict")
)

// StudentParentService manages relationships linking students to their designated parents or guardians.
type StudentParentService struct {
	repository *repository.Repository
}

// NewStudentParentService initializes a StudentParentService instance.
func NewStudentParentService(
	repo *repository.Repository,
) *StudentParentService {
	return &StudentParentService{
		repository: repo,
	}
}

// ListStudentParents retrieves parents linked to a student under the given college.
func (s *StudentParentService) ListStudentParents(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
	limit int,
	offset int,
) ([]models.StudentParent, error) {
	if err := validators.ValidateListStudentParents(collegeID, studentID, limit, offset); err != nil {
		return nil, err
	}

	return s.repository.ListStudentParents(
		ctx,
		models.ListStudentParentsParams{
			CollegeID: collegeID,
			StudentID: studentID,
			Limit:     limit,
			Offset:    offset,
		},
	)
}

// GetStudentParent retrieves a specific student-parent relationship.
func (s *StudentParentService) GetStudentParent(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
	relationshipID uuid.UUID,
) (models.StudentParent, error) {
	if collegeID == uuid.Nil {
		return models.StudentParent{}, ErrInvalidStudentParentCollegeID
	}
	if studentID == uuid.Nil {
		return models.StudentParent{}, ErrInvalidStudentParentStudentID
	}
	if relationshipID == uuid.Nil {
		return models.StudentParent{}, ErrInvalidStudentParentID
	}

	item, err := s.repository.GetStudentParent(
		ctx,
		collegeID,
		studentID,
		relationshipID,
	)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return models.StudentParent{}, ErrStudentParentNotFound
		}
		return models.StudentParent{}, err
	}

	return item, nil
}

// CreateStudentParent links a parent to a student, enforcing primary rules.
func (s *StudentParentService) CreateStudentParent(
	ctx context.Context,
	params models.CreateStudentParentParams,
) (models.StudentParent, error) {
	if err := validators.ValidateCreateStudentParent(&params); err != nil {
		return models.StudentParent{}, err
	}

	item, err := s.repository.CreateStudentParent(ctx, params)
	if err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return models.StudentParent{}, ErrStudentParentConflict
		}
		return models.StudentParent{}, err
	}

	return item, nil
}

// UpdateStudentParent updates an existing student-parent association.
func (s *StudentParentService) UpdateStudentParent(
	ctx context.Context,
	params models.UpdateStudentParentParams,
) (models.StudentParent, error) {
	if err := validators.ValidateUpdateStudentParent(&params); err != nil {
		return models.StudentParent{}, err
	}

	item, err := s.repository.UpdateStudentParent(ctx, params)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return models.StudentParent{}, ErrStudentParentNotFound
		}
		if errors.Is(err, repository.ErrConflict) {
			return models.StudentParent{}, ErrStudentParentConflict
		}
		return models.StudentParent{}, err
	}

	return item, nil
}

// DeleteStudentParent removes a student-parent association.
func (s *StudentParentService) DeleteStudentParent(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
	relationshipID uuid.UUID,
) error {
	if collegeID == uuid.Nil {
		return ErrInvalidStudentParentCollegeID
	}
	if studentID == uuid.Nil {
		return ErrInvalidStudentParentStudentID
	}
	if relationshipID == uuid.Nil {
		return ErrInvalidStudentParentID
	}

	err := s.repository.DeleteStudentParent(
		ctx,
		collegeID,
		studentID,
		relationshipID,
	)
	if errors.Is(err, repository.ErrNotFound) {
		return ErrStudentParentNotFound
	}

	return err
}

// IsStudentParentNotFound reports whether the error represents a not-found condition.
func (s *StudentParentService) IsStudentParentNotFound(err error) bool {
	return errors.Is(err, ErrStudentParentNotFound)
}

// IsStudentParentConflict reports whether the error represents an association conflict.
func (s *StudentParentService) IsStudentParentConflict(err error) bool {
	return errors.Is(err, ErrStudentParentConflict)
}

