package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

var validStaffStatuses = map[string]bool{
	"ACTIVE":     true,
	"INACTIVE":   true,
	"SUSPENDED":  true,
	"RESIGNED":   true,
	"TERMINATED": true,
	"RETIRED":    true,
}

type CreateStaffInput struct {
	UserID           uuid.UUID
	EmployeeNumber   string
	FirstName        string
	MiddleName       string
	LastName         string
	Designation      string
	DepartmentID     *uuid.UUID
	Phone            string
	AlternatePhone   string
	Email            string
	JoiningDate      string
	EmploymentStatus string
}

type UpdateStaffInput struct {
	EmployeeNumber string
	FirstName      string
	MiddleName     string
	LastName       string
	Designation    string
	Phone          string
	AlternatePhone string
	Email          string
	JoiningDate    string
}

type StaffService struct {
	repo *repository.Repository
}

func NewStaffService(repo *repository.Repository) *StaffService {
	return &StaffService{repo: repo}
}

func (s *StaffService) List(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]repository.StaffProfile, error) {
	if collegeID == uuid.Nil {
		return nil, fmt.Errorf("college ID is required")
	}

	return s.repo.ListStaffProfiles(ctx, collegeID)
}

func (s *StaffService) Get(
	ctx context.Context,
	collegeID uuid.UUID,
	staffID uuid.UUID,
) (repository.StaffProfile, error) {
	if collegeID == uuid.Nil {
		return repository.StaffProfile{}, fmt.Errorf("college ID is required")
	}

	if staffID == uuid.Nil {
		return repository.StaffProfile{}, fmt.Errorf("staff ID is required")
	}

	return s.repo.GetStaffProfile(ctx, collegeID, staffID)
}

func (s *StaffService) Create(
	ctx context.Context,
	collegeID uuid.UUID,
	input CreateStaffInput,
) (repository.StaffProfile, error) {
	if collegeID == uuid.Nil {
		return repository.StaffProfile{}, fmt.Errorf("college ID is required")
	}

	if input.UserID == uuid.Nil {
		return repository.StaffProfile{}, fmt.Errorf("user ID is required")
	}

	input.FirstName = strings.TrimSpace(input.FirstName)

	if input.FirstName == "" {
		return repository.StaffProfile{}, fmt.Errorf("first name is required")
	}

	input.EmploymentStatus = strings.ToUpper(
		strings.TrimSpace(input.EmploymentStatus),
	)

	if input.EmploymentStatus == "" {
		input.EmploymentStatus = "ACTIVE"
	}

	if !validStaffStatuses[input.EmploymentStatus] {
		return repository.StaffProfile{}, fmt.Errorf(
			"invalid employment_status",
		)
	}

	var parsedJoiningDate *string
	if input.JoiningDate != "" {
		parsedJoiningDate = &input.JoiningDate
	}

	_ = parsedJoiningDate

	return s.repo.CreateStaffProfile(
		ctx,
		collegeID,
		input.UserID,
		input.EmployeeNumber,
		input.FirstName,
		input.MiddleName,
		input.LastName,
		input.Designation,
		input.DepartmentID,
		input.Phone,
		input.AlternatePhone,
		input.Email,
		nil,
		input.EmploymentStatus,
		map[string]interface{}{},
	)
}

func (s *StaffService) Update(
	ctx context.Context,
	collegeID uuid.UUID,
	staffID uuid.UUID,
	input UpdateStaffInput,
) (repository.StaffProfile, error) {
	if collegeID == uuid.Nil {
		return repository.StaffProfile{}, fmt.Errorf("college ID is required")
	}

	if staffID == uuid.Nil {
		return repository.StaffProfile{}, fmt.Errorf("staff ID is required")
	}

	input.FirstName = strings.TrimSpace(input.FirstName)

	if input.FirstName == "" {
		return repository.StaffProfile{}, fmt.Errorf("first name is required")
	}

	return s.repo.UpdateStaffProfile(
		ctx,
		collegeID,
		staffID,
		input.FirstName,
		input.MiddleName,
		input.LastName,
		input.Designation,
		input.Phone,
		input.AlternatePhone,
		input.Email,
	)
}

func (s *StaffService) UpdateStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	staffID uuid.UUID,
	status string,
) (repository.StaffProfile, error) {
	if collegeID == uuid.Nil {
		return repository.StaffProfile{}, fmt.Errorf("college ID is required")
	}

	if staffID == uuid.Nil {
		return repository.StaffProfile{}, fmt.Errorf("staff ID is required")
	}

	status = strings.ToUpper(strings.TrimSpace(status))

	if !validStaffStatuses[status] {
		return repository.StaffProfile{}, fmt.Errorf(
			"invalid employment_status",
		)
	}

	return s.repo.UpdateStaffStatus(
		ctx,
		collegeID,
		staffID,
		status,
	)
}
