package services

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/validators"
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
	repo *repository.Repository
}

func NewStudentParentService(
	repo *repository.Repository,
) *StudentParentService {
	return &StudentParentService{
		repo: repo,
	}
}

func (s *StudentParentService) ListStudentParents(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
	limit int,
	offset int,
) ([]models.StudentParent, error) {
	if collegeID == uuid.Nil {
		return nil, ErrInvalidStudentParentCollegeID
	}
	if studentID == uuid.Nil {
		return nil, ErrInvalidStudentParentStudentID
	}

	lim, off, err := validators.ValidatePagination(limit, offset)
	if err != nil {
		return nil, ErrInvalidStudentParentPagination
	}

	return s.repo.ListStudentParents(
		ctx,
		repository.ListStudentParentsParams{
			CollegeID: collegeID,
			StudentID: studentID,
			Limit:     lim,
			Offset:    off,
		},
	)
}

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

	item, err := s.repo.GetStudentParent(ctx, collegeID, studentID, relationshipID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return models.StudentParent{}, ErrStudentParentNotFound
		}
		return models.StudentParent{}, err
	}

	return item, nil
}

func (s *StudentParentService) CreateStudentParent(
	ctx context.Context,
	params repository.CreateStudentParentParams,
) (models.StudentParent, error) {
	if params.CollegeID == uuid.Nil {
		return models.StudentParent{}, ErrInvalidStudentParentCollegeID
	}
	if params.StudentID == uuid.Nil {
		return models.StudentParent{}, ErrInvalidStudentParentStudentID
	}
	if err := validators.ValidateStudentParentInput(params.ParentID, params.Relationship); err != nil {
		if params.ParentID == uuid.Nil {
			return models.StudentParent{}, ErrInvalidStudentParentParentID
		}
		return models.StudentParent{}, ErrInvalidStudentParentRelation
	}

	params.Relationship = strings.TrimSpace(params.Relationship)

	item, err := s.repo.CreateStudentParent(ctx, params)
	if err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return models.StudentParent{}, ErrStudentParentConflict
		}
		return models.StudentParent{}, err
	}

	return item, nil
}

func (s *StudentParentService) UpdateStudentParent(
	ctx context.Context,
	params repository.UpdateStudentParentParams,
) (models.StudentParent, error) {
	if params.CollegeID == uuid.Nil {
		return models.StudentParent{}, ErrInvalidStudentParentCollegeID
	}
	if params.StudentID == uuid.Nil {
		return models.StudentParent{}, ErrInvalidStudentParentStudentID
	}
	if params.ID == uuid.Nil {
		return models.StudentParent{}, ErrInvalidStudentParentID
	}

	params.Relationship = strings.TrimSpace(params.Relationship)
	if params.Relationship == "" {
		return models.StudentParent{}, ErrInvalidStudentParentRelation
	}

	item, err := s.repo.UpdateStudentParent(ctx, params)
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

	err := s.repo.DeleteStudentParent(ctx, collegeID, studentID, relationshipID)
	if errors.Is(err, repository.ErrNotFound) {
		return ErrStudentParentNotFound
	}
	return err
}

