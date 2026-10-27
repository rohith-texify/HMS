package service

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

var (
	ErrInvalidParentID         = errors.New("invalid parent id")
	ErrInvalidParentCollegeID  = errors.New("invalid college id")
	ErrInvalidParentFirstName  = errors.New("first name is required")
	ErrInvalidParentPagination = errors.New("invalid pagination")
	ErrParentNotFound          = errors.New("parent not found")
	ErrParentConflict          = errors.New("parent conflict")
)

type ParentService struct {
	repository *repository.Repository
}

func NewParentService(
	repository *repository.Repository,
) *ParentService {
	return &ParentService{
		repository: repository,
	}
}

func (s *ParentService) ListParents(
	ctx context.Context,
	collegeID uuid.UUID,
	limit int,
	offset int,
) ([]repository.Parent, error) {
	if collegeID == uuid.Nil {
		return nil, ErrInvalidParentCollegeID
	}

	if limit <= 0 || limit > 100 {
		return nil, ErrInvalidParentPagination
	}

	if offset < 0 {
		return nil, ErrInvalidParentPagination
	}

	return s.repository.ListParents(
		ctx,
		repository.ListParentsParams{
			CollegeID: collegeID,
			Limit:     limit,
			Offset:    offset,
		},
	)
}

func (s *ParentService) GetParentByID(
	ctx context.Context,
	collegeID uuid.UUID,
	parentID uuid.UUID,
) (repository.Parent, error) {
	if collegeID == uuid.Nil {
		return repository.Parent{}, ErrInvalidParentCollegeID
	}

	if parentID == uuid.Nil {
		return repository.Parent{}, ErrInvalidParentID
	}

	parent, err := s.repository.GetParentByID(
		ctx,
		collegeID,
		parentID,
	)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return repository.Parent{}, ErrParentNotFound
		}
		return repository.Parent{}, err
	}

	return parent, nil
}

func (s *ParentService) CreateParent(
	ctx context.Context,
	params repository.CreateParentParams,
) (repository.Parent, error) {
	if params.CollegeID == uuid.Nil {
		return repository.Parent{}, ErrInvalidParentCollegeID
	}

	params.FirstName = strings.TrimSpace(params.FirstName)

	if params.FirstName == "" {
		return repository.Parent{}, ErrInvalidParentFirstName
	}

	normalizeParentPointers(&params)

	parent, err := s.repository.CreateParent(ctx, params)
	if err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return repository.Parent{}, ErrParentConflict
		}
		return repository.Parent{}, err
	}

	return parent, nil
}

func (s *ParentService) UpdateParent(
	ctx context.Context,
	params repository.UpdateParentParams,
) (repository.Parent, error) {
	if params.CollegeID == uuid.Nil {
		return repository.Parent{}, ErrInvalidParentCollegeID
	}

	if params.ID == uuid.Nil {
		return repository.Parent{}, ErrInvalidParentID
	}

	params.FirstName = strings.TrimSpace(params.FirstName)

	if params.FirstName == "" {
		return repository.Parent{}, ErrInvalidParentFirstName
	}

	normalizeParentUpdatePointers(&params)

	parent, err := s.repository.UpdateParent(ctx, params)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return repository.Parent{}, ErrParentNotFound
		}
		if errors.Is(err, repository.ErrConflict) {
			return repository.Parent{}, ErrParentConflict
		}
		return repository.Parent{}, err
	}

	return parent, nil
}

func normalizeParentPointers(params *repository.CreateParentParams) {
	normalizeStringPointer(&params.MiddleName)
	normalizeStringPointer(&params.LastName)
	normalizeStringPointer(&params.Relationship)
	normalizeStringPointer(&params.Phone)
	normalizeStringPointer(&params.AlternatePhone)
	normalizeStringPointer(&params.Email)
	normalizeStringPointer(&params.Occupation)
	normalizeStringPointer(&params.AddressLine1)
	normalizeStringPointer(&params.AddressLine2)
	normalizeStringPointer(&params.City)
	normalizeStringPointer(&params.State)
	normalizeStringPointer(&params.PostalCode)
	normalizeStringPointer(&params.Country)
}

func normalizeParentUpdatePointers(params *repository.UpdateParentParams) {
	normalizeStringPointer(&params.MiddleName)
	normalizeStringPointer(&params.LastName)
	normalizeStringPointer(&params.Relationship)
	normalizeStringPointer(&params.Phone)
	normalizeStringPointer(&params.AlternatePhone)
	normalizeStringPointer(&params.Email)
	normalizeStringPointer(&params.Occupation)
	normalizeStringPointer(&params.AddressLine1)
	normalizeStringPointer(&params.AddressLine2)
	normalizeStringPointer(&params.City)
	normalizeStringPointer(&params.State)
	normalizeStringPointer(&params.PostalCode)
	normalizeStringPointer(&params.Country)
}

func normalizeStringPointer(value **string) {
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

func (s *ParentService) IsParentNotFound(err error) bool {
	return errors.Is(err, ErrParentNotFound)
}

func (s *ParentService) IsParentConflict(err error) bool {
	return errors.Is(err, ErrParentConflict)
}
