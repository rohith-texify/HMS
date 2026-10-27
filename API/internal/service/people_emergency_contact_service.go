package service

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/internal/database"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

var (
	ErrInvalidEmergencyContactID      = errors.New("invalid emergency contact id")
	ErrInvalidEmergencyStudentID      = errors.New("invalid student id")
	ErrInvalidEmergencyCollegeID      = errors.New("invalid college id")
	ErrInvalidEmergencyContactName    = errors.New("contact name is required")
	ErrInvalidEmergencyPhone          = errors.New("phone is required")
	ErrInvalidEmergencyContactPayload = errors.New("invalid emergency contact payload")
	ErrEmergencyContactNotFound       = errors.New("emergency contact not found")
	ErrEmergencyContactConflict       = errors.New("emergency contact conflict")
)

type EmergencyContactInput struct {
	ContactName    string `json:"contact_name"`
	Relationship   string `json:"relationship"`
	Phone          string `json:"phone"`
	AlternatePhone string `json:"alternate_phone"`
	Email          string `json:"email"`
	AddressLine1   string `json:"address_line1"`
	AddressLine2   string `json:"address_line2"`
	City           string `json:"city"`
	State          string `json:"state"`
	PostalCode     string `json:"postal_code"`
	Country        string `json:"country"`
	IsPrimary      bool   `json:"is_primary"`
}

type EmergencyContactService struct {
	db         *database.Database
	repository *repository.Repository
}

func NewEmergencyContactService(
	db *database.Database,
	repository *repository.Repository,
) *EmergencyContactService {
	return &EmergencyContactService{
		db:         db,
		repository: repository,
	}
}

func normalizeEmergencyContactInput(
	input EmergencyContactInput,
) EmergencyContactInput {
	input.ContactName = strings.TrimSpace(input.ContactName)
	input.Relationship = strings.TrimSpace(input.Relationship)
	input.Phone = strings.TrimSpace(input.Phone)
	input.AlternatePhone = strings.TrimSpace(input.AlternatePhone)
	input.Email = strings.TrimSpace(input.Email)
	input.AddressLine1 = strings.TrimSpace(input.AddressLine1)
	input.AddressLine2 = strings.TrimSpace(input.AddressLine2)
	input.City = strings.TrimSpace(input.City)
	input.State = strings.TrimSpace(input.State)
	input.PostalCode = strings.TrimSpace(input.PostalCode)
	input.Country = strings.TrimSpace(input.Country)

	return input
}

func validateEmergencyContactInput(
	input EmergencyContactInput,
) error {
	if strings.TrimSpace(input.ContactName) == "" {
		return ErrInvalidEmergencyContactName
	}

	if strings.TrimSpace(input.Phone) == "" {
		return ErrInvalidEmergencyPhone
	}

	return nil
}

func (s *EmergencyContactService) ListEmergencyContacts(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
) ([]repository.EmergencyContact, error) {
	if collegeID == uuid.Nil {
		return nil, ErrInvalidEmergencyCollegeID
	}

	if studentID == uuid.Nil {
		return nil, ErrInvalidEmergencyStudentID
	}

	return s.repository.ListEmergencyContacts(
		ctx,
		collegeID,
		studentID,
	)
}

func (s *EmergencyContactService) GetEmergencyContact(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
	contactID uuid.UUID,
) (repository.EmergencyContact, error) {
	if collegeID == uuid.Nil {
		return repository.EmergencyContact{}, ErrInvalidEmergencyCollegeID
	}

	if studentID == uuid.Nil {
		return repository.EmergencyContact{}, ErrInvalidEmergencyStudentID
	}

	if contactID == uuid.Nil {
		return repository.EmergencyContact{}, ErrInvalidEmergencyContactID
	}

	contact, err := s.repository.GetEmergencyContact(
		ctx,
		collegeID,
		studentID,
		contactID,
	)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return repository.EmergencyContact{}, ErrEmergencyContactNotFound
		}

		return repository.EmergencyContact{}, err
	}

	return contact, nil
}

func (s *EmergencyContactService) CreateEmergencyContact(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
	input EmergencyContactInput,
) (repository.EmergencyContact, error) {
	if collegeID == uuid.Nil {
		return repository.EmergencyContact{}, ErrInvalidEmergencyCollegeID
	}

	if studentID == uuid.Nil {
		return repository.EmergencyContact{}, ErrInvalidEmergencyStudentID
	}

	input = normalizeEmergencyContactInput(input)

	if err := validateEmergencyContactInput(input); err != nil {
		return repository.EmergencyContact{}, err
	}

	params := repository.CreateEmergencyContactParams{
		CollegeID:      collegeID,
		StudentID:      studentID,
		ContactName:    input.ContactName,
		Relationship:   input.Relationship,
		Phone:          input.Phone,
		AlternatePhone: input.AlternatePhone,
		Email:          input.Email,
		AddressLine1:   input.AddressLine1,
		AddressLine2:   input.AddressLine2,
		City:           input.City,
		State:          input.State,
		PostalCode:     input.PostalCode,
		Country:        input.Country,
		IsPrimary:      input.IsPrimary,
	}

	var contact repository.EmergencyContact

	err := s.db.WithTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
		created, err := s.repository.CreateEmergencyContact(
			txCtx,
			params,
		)
		if err != nil {
			return err
		}

		contact = created
		return nil
	})
	if err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return repository.EmergencyContact{}, ErrEmergencyContactConflict
		}

		return repository.EmergencyContact{}, err
	}

	return contact, nil
}

func (s *EmergencyContactService) UpdateEmergencyContact(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
	contactID uuid.UUID,
	input EmergencyContactInput,
) (repository.EmergencyContact, error) {
	if collegeID == uuid.Nil {
		return repository.EmergencyContact{}, ErrInvalidEmergencyCollegeID
	}

	if studentID == uuid.Nil {
		return repository.EmergencyContact{}, ErrInvalidEmergencyStudentID
	}

	if contactID == uuid.Nil {
		return repository.EmergencyContact{}, ErrInvalidEmergencyContactID
	}

	input = normalizeEmergencyContactInput(input)

	if err := validateEmergencyContactInput(input); err != nil {
		return repository.EmergencyContact{}, err
	}

	params := repository.UpdateEmergencyContactParams{
		CollegeID:      collegeID,
		StudentID:      studentID,
		ContactID:      contactID,
		ContactName:    input.ContactName,
		Relationship:   input.Relationship,
		Phone:          input.Phone,
		AlternatePhone: input.AlternatePhone,
		Email:          input.Email,
		AddressLine1:   input.AddressLine1,
		AddressLine2:   input.AddressLine2,
		City:           input.City,
		State:          input.State,
		PostalCode:     input.PostalCode,
		Country:        input.Country,
		IsPrimary:      input.IsPrimary,
	}

	var contact repository.EmergencyContact

	err := s.db.WithTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
		updated, err := s.repository.UpdateEmergencyContact(
			txCtx,
			params,
		)
		if err != nil {
			return err
		}

		contact = updated
		return nil
	})
	if err != nil {
		switch {
		case errors.Is(err, repository.ErrNotFound):
			return repository.EmergencyContact{}, ErrEmergencyContactNotFound
		case errors.Is(err, repository.ErrConflict):
			return repository.EmergencyContact{}, ErrEmergencyContactConflict
		default:
			return repository.EmergencyContact{}, err
		}
	}

	return contact, nil
}

func (s *EmergencyContactService) DeleteEmergencyContact(
	ctx context.Context,
	collegeID uuid.UUID,
	studentID uuid.UUID,
	contactID uuid.UUID,
) error {
	if collegeID == uuid.Nil {
		return ErrInvalidEmergencyCollegeID
	}

	if studentID == uuid.Nil {
		return ErrInvalidEmergencyStudentID
	}

	if contactID == uuid.Nil {
		return ErrInvalidEmergencyContactID
	}

	err := s.db.WithTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
		return s.repository.DeleteEmergencyContact(
			txCtx,
			collegeID,
			studentID,
			contactID,
		)
	})

	if errors.Is(err, repository.ErrNotFound) {
		return ErrEmergencyContactNotFound
	}

	return err
}

func IsEmergencyContactNotFound(err error) bool {
	return errors.Is(err, ErrEmergencyContactNotFound)
}

func IsEmergencyContactConflict(err error) bool {
	return errors.Is(err, ErrEmergencyContactConflict)
}
