package service

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

var (
	ErrInvalidStudentParentID         = errors.New("invalid student-parent relationship id")
	ErrInvalidStudentParentCollegeID  = errors.New("invalid college id")
	ErrInvalidStudentParentStudentID  = errors.New("invalid student id")
	ErrInvalidStudentParentParentID   = errors.New("invalid parent id")
	ErrInvalidStudentParentRelation   = errors.New("relationship is required")
	ErrInvalidStudentParentPagination = errors.New("invalid pagination")
	ErrStudentParentNotFound          = errors.New("student-parent relationship not found")
	ErrStudentParentConflict          = errors.New("student-parent relationship conflict")
)

type StudentParentService struct {
	repository *repository.Repository
}

func NewStudentParentService(
	repository *repository.Repository,
) *StudentParentService {
	return &StudentParentService{
		repository: repository,
	}
}

func (s *StudentParentService) ListStudentParents(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
	limit int,
	offset int,
) ([]repository.StudentParent, error) {
	if collegeID == uuid.Nil {
		return nil, ErrInvalidStudentParentCollegeID
	}

	if studentID == uuid.Nil {
		return nil, ErrInvalidStudentParentStudentID
	}

	if limit <= 0 || limit > 100 {
		return nil, ErrInvalidStudentParentPagination
	}

	if offset < 0 {
		return nil, ErrInvalidStudentParentPagination
	}

	return s.repository.ListStudentParents(
		ctx,
		repository.ListStudentParentsParams{
			CollegeID: collegeID,
			StudentID: studentID,
			Limit:     limit,
			Offset:    offset,
		},
	)
}

func (s *StudentParentService) GetStudentParent(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
	relationshipID uuid.UUID,
) (repository.StudentParent, error) {
	if collegeID == uuid.Nil {
		return repository.StudentParent{}, ErrInvalidStudentParentCollegeID
	}

	if studentID == uuid.Nil {
		return repository.StudentParent{}, ErrInvalidStudentParentStudentID
	}

	if relationshipID == uuid.Nil {
		return repository.StudentParent{}, ErrInvalidStudentParentID
	}

	item, err := s.repository.GetStudentParent(
		ctx,
		collegeID,
		studentID,
		relationshipID,
	)

	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return repository.StudentParent{}, ErrStudentParentNotFound
		}

		return repository.StudentParent{}, err
	}

	return item, nil
}

func (s *StudentParentService) CreateStudentParent(
	ctx context.Context,
	params repository.CreateStudentParentParams,
) (repository.StudentParent, error) {
	if params.CollegeID == uuid.Nil {
		return repository.StudentParent{}, ErrInvalidStudentParentCollegeID
	}

	if params.StudentID == uuid.Nil {
		return repository.StudentParent{}, ErrInvalidStudentParentStudentID
	}

	if params.ParentID == uuid.Nil {
		return repository.StudentParent{}, ErrInvalidStudentParentParentID
	}

	params.Relationship = strings.TrimSpace(params.Relationship)

	if params.Relationship == "" {
		return repository.StudentParent{}, ErrInvalidStudentParentRelation
	}

	item, err := s.repository.CreateStudentParent(
		ctx,
		params,
	)

	if err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return repository.StudentParent{}, ErrStudentParentConflict
		}

		return repository.StudentParent{}, err
	}

	return item, nil
}

func (s *StudentParentService) UpdateStudentParent(
	ctx context.Context,
	params repository.UpdateStudentParentParams,
) (repository.StudentParent, error) {
	if params.CollegeID == uuid.Nil {
		return repository.StudentParent{}, ErrInvalidStudentParentCollegeID
	}

	if params.StudentID == uuid.Nil {
		return repository.StudentParent{}, ErrInvalidStudentParentStudentID
	}

	if params.ID == uuid.Nil {
		return repository.StudentParent{}, ErrInvalidStudentParentID
	}

	params.Relationship = strings.TrimSpace(params.Relationship)

	if params.Relationship == "" {
		return repository.StudentParent{}, ErrInvalidStudentParentRelation
	}

	item, err := s.repository.UpdateStudentParent(
		ctx,
		params,
	)

	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return repository.StudentParent{}, ErrStudentParentNotFound
		}

		if errors.Is(err, repository.ErrConflict) {
			return repository.StudentParent{}, ErrStudentParentConflict
		}

		return repository.StudentParent{}, err
	}

	return item, nil
}

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
