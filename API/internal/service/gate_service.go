package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

type GateService struct {
	repository *repository.Repository
}

func NewGateService(repository *repository.Repository) *GateService {
	return &GateService{
		repository: repository,
	}
}

type CreateGateInput struct {
	HostelID            *uuid.UUID `json:"hostel_id"`
	Code                string     `json:"code"`
	Name                string     `json:"name"`
	GateType            string     `json:"gate_type"`
	LocationDescription *string    `json:"location_description"`
	Status              string     `json:"status"`
}

type UpdateGateInput struct {
	HostelID            *uuid.UUID `json:"hostel_id"`
	Code                string     `json:"code"`
	Name                string     `json:"name"`
	GateType            string     `json:"gate_type"`
	LocationDescription *string    `json:"location_description"`
	Status              string     `json:"status"`
}

type UpdateGateStatusInput struct {
	Status string `json:"status"`
}

func (s *GateService) ListGates(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]repository.Gate, error) {
	if collegeID == uuid.Nil {
		return nil, fmt.Errorf("college ID is required")
	}

	return s.repository.ListGates(ctx, collegeID)
}

func (s *GateService) CreateGate(
	ctx context.Context,
	collegeID uuid.UUID,
	input CreateGateInput,
) (repository.Gate, error) {
	if collegeID == uuid.Nil {
		return repository.Gate{}, fmt.Errorf("college ID is required")
	}

	input.Code = strings.TrimSpace(input.Code)
	input.Name = strings.TrimSpace(input.Name)
	input.GateType = strings.TrimSpace(input.GateType)
	input.Status = strings.TrimSpace(input.Status)

	if input.Code == "" {
		return repository.Gate{}, fmt.Errorf("code is required")
	}

	if input.Name == "" {
		return repository.Gate{}, fmt.Errorf("name is required")
	}

	if input.GateType == "" {
		return repository.Gate{}, fmt.Errorf("gate_type is required")
	}

	if input.Status == "" {
		return repository.Gate{}, fmt.Errorf("status is required")
	}

	if input.LocationDescription != nil {
		value := strings.TrimSpace(*input.LocationDescription)
		input.LocationDescription = &value
	}

	return s.repository.CreateGate(
		ctx,
		collegeID,
		input.HostelID,
		input.Code,
		input.Name,
		input.GateType,
		input.LocationDescription,
		input.Status,
	)
}

func (s *GateService) GetGate(
	ctx context.Context,
	collegeID uuid.UUID,
	gateID uuid.UUID,
) (repository.Gate, error) {
	if collegeID == uuid.Nil {
		return repository.Gate{}, fmt.Errorf("college ID is required")
	}

	if gateID == uuid.Nil {
		return repository.Gate{}, fmt.Errorf("gate ID is required")
	}

	return s.repository.GetGate(ctx, collegeID, gateID)
}

func (s *GateService) UpdateGate(
	ctx context.Context,
	collegeID uuid.UUID,
	gateID uuid.UUID,
	input UpdateGateInput,
) (repository.Gate, error) {
	if collegeID == uuid.Nil {
		return repository.Gate{}, fmt.Errorf("college ID is required")
	}

	if gateID == uuid.Nil {
		return repository.Gate{}, fmt.Errorf("gate ID is required")
	}

	input.Code = strings.TrimSpace(input.Code)
	input.Name = strings.TrimSpace(input.Name)
	input.GateType = strings.TrimSpace(input.GateType)
	input.Status = strings.TrimSpace(input.Status)

	if input.Code == "" {
		return repository.Gate{}, fmt.Errorf("code is required")
	}

	if input.Name == "" {
		return repository.Gate{}, fmt.Errorf("name is required")
	}

	if input.GateType == "" {
		return repository.Gate{}, fmt.Errorf("gate_type is required")
	}

	if input.Status == "" {
		return repository.Gate{}, fmt.Errorf("status is required")
	}

	if input.LocationDescription != nil {
		value := strings.TrimSpace(*input.LocationDescription)
		input.LocationDescription = &value
	}

	return s.repository.UpdateGate(
		ctx,
		collegeID,
		gateID,
		input.HostelID,
		input.Code,
		input.Name,
		input.GateType,
		input.LocationDescription,
		input.Status,
	)
}

func (s *GateService) UpdateGateStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	gateID uuid.UUID,
	input UpdateGateStatusInput,
) (repository.Gate, error) {
	if collegeID == uuid.Nil {
		return repository.Gate{}, fmt.Errorf("college ID is required")
	}

	if gateID == uuid.Nil {
		return repository.Gate{}, fmt.Errorf("gate ID is required")
	}

	input.Status = strings.TrimSpace(input.Status)

	if input.Status == "" {
		return repository.Gate{}, fmt.Errorf("status is required")
	}

	return s.repository.UpdateGateStatus(
		ctx,
		collegeID,
		gateID,
		input.Status,
	)
}
