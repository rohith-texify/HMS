package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

var validHostelCategories = map[string]bool{
	"BOYS":  true,
	"GIRLS": true,
	"MIXED": true,
	"OTHER": true,
}

var validHostelStatuses = map[string]bool{
	"ACTIVE":      true,
	"INACTIVE":    true,
	"MAINTENANCE": true,
}

type CreateHostelInput struct {
	Code          string
	Name          string
	Category      string
	Description   string
	Address       string
	TotalCapacity int
	Status        string
}

type UpdateHostelInput struct {
	Code          string
	Name          string
	Category      string
	Description   string
	Address       string
	TotalCapacity int
}

type HostelService struct {
	repo *repository.Repository
}

func NewHostelService(repo *repository.Repository) *HostelService {
	return &HostelService{
		repo: repo,
	}
}

func (s *HostelService) List(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]repository.Hostel, error) {
	if collegeID == uuid.Nil {
		return nil, fmt.Errorf("college ID is required")
	}

	return s.repo.ListHostels(ctx, collegeID)
}

func (s *HostelService) Get(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
) (repository.Hostel, error) {
	if collegeID == uuid.Nil {
		return repository.Hostel{}, fmt.Errorf("college ID is required")
	}

	if hostelID == uuid.Nil {
		return repository.Hostel{}, fmt.Errorf("hostel ID is required")
	}

	return s.repo.GetHostel(ctx, collegeID, hostelID)
}

func (s *HostelService) Create(
	ctx context.Context,
	collegeID uuid.UUID,
	input CreateHostelInput,
) (repository.Hostel, error) {
	if collegeID == uuid.Nil {
		return repository.Hostel{}, fmt.Errorf("college ID is required")
	}

	input.Code = strings.TrimSpace(input.Code)
	input.Name = strings.TrimSpace(input.Name)
	input.Category = strings.ToUpper(strings.TrimSpace(input.Category))
	input.Description = strings.TrimSpace(input.Description)
	input.Address = strings.TrimSpace(input.Address)
	input.Status = strings.ToUpper(strings.TrimSpace(input.Status))

	if input.Code == "" {
		return repository.Hostel{}, fmt.Errorf("code is required")
	}

	if input.Name == "" {
		return repository.Hostel{}, fmt.Errorf("name is required")
	}

	if !validHostelCategories[input.Category] {
		return repository.Hostel{}, fmt.Errorf(
			"invalid category",
		)
	}

	if input.TotalCapacity < 0 {
		return repository.Hostel{}, fmt.Errorf(
			"total_capacity cannot be negative",
		)
	}

	if input.Status == "" {
		input.Status = "ACTIVE"
	}

	if !validHostelStatuses[input.Status] {
		return repository.Hostel{}, fmt.Errorf(
			"invalid status",
		)
	}

	var description *string
	if input.Description != "" {
		description = &input.Description
	}

	var address *string
	if input.Address != "" {
		address = &input.Address
	}

	return s.repo.CreateHostel(
		ctx,
		collegeID,
		input.Code,
		input.Name,
		input.Category,
		description,
		address,
		input.TotalCapacity,
		input.Status,
	)
}

func (s *HostelService) Update(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	input UpdateHostelInput,
) (repository.Hostel, error) {
	if collegeID == uuid.Nil {
		return repository.Hostel{}, fmt.Errorf("college ID is required")
	}

	if hostelID == uuid.Nil {
		return repository.Hostel{}, fmt.Errorf("hostel ID is required")
	}

	input.Code = strings.TrimSpace(input.Code)
	input.Name = strings.TrimSpace(input.Name)
	input.Category = strings.ToUpper(strings.TrimSpace(input.Category))
	input.Description = strings.TrimSpace(input.Description)
	input.Address = strings.TrimSpace(input.Address)

	if input.Code == "" {
		return repository.Hostel{}, fmt.Errorf("code is required")
	}

	if input.Name == "" {
		return repository.Hostel{}, fmt.Errorf("name is required")
	}

	if !validHostelCategories[input.Category] {
		return repository.Hostel{}, fmt.Errorf(
			"invalid category",
		)
	}

	if input.TotalCapacity < 0 {
		return repository.Hostel{}, fmt.Errorf(
			"total_capacity cannot be negative",
		)
	}

	var description *string
	if input.Description != "" {
		description = &input.Description
	}

	var address *string
	if input.Address != "" {
		address = &input.Address
	}

	return s.repo.UpdateHostel(
		ctx,
		collegeID,
		hostelID,
		input.Code,
		input.Name,
		input.Category,
		description,
		address,
		input.TotalCapacity,
	)
}

func (s *HostelService) UpdateStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	status string,
) (repository.Hostel, error) {
	if collegeID == uuid.Nil {
		return repository.Hostel{}, fmt.Errorf("college ID is required")
	}

	if hostelID == uuid.Nil {
		return repository.Hostel{}, fmt.Errorf("hostel ID is required")
	}

	status = strings.ToUpper(strings.TrimSpace(status))

	if !validHostelStatuses[status] {
		return repository.Hostel{}, fmt.Errorf(
			"invalid status",
		)
	}

	return s.repo.UpdateHostelStatus(
		ctx,
		collegeID,
		hostelID,
		status,
	)
}
