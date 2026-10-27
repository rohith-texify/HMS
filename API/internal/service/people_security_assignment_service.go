package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

type SecurityAssignmentService struct {
	repo *repository.Repository
}

func NewSecurityAssignmentService(
	repo *repository.Repository,
) *SecurityAssignmentService {
	return &SecurityAssignmentService{
		repo: repo,
	}
}

func (s *SecurityAssignmentService) List(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]repository.SecurityAssignment, error) {
	if collegeID == uuid.Nil {
		return nil, fmt.Errorf("college ID is required")
	}

	return s.repo.ListSecurityAssignments(ctx, collegeID)
}

func (s *SecurityAssignmentService) Get(
	ctx context.Context,
	collegeID uuid.UUID,
	assignmentID uuid.UUID,
) (repository.SecurityAssignment, error) {
	if collegeID == uuid.Nil {
		return repository.SecurityAssignment{}, fmt.Errorf("college ID is required")
	}

	if assignmentID == uuid.Nil {
		return repository.SecurityAssignment{}, fmt.Errorf("assignment ID is required")
	}

	return s.repo.GetSecurityAssignment(
		ctx,
		collegeID,
		assignmentID,
	)
}

func (s *SecurityAssignmentService) Create(
	ctx context.Context,
	collegeID uuid.UUID,
	staffID uuid.UUID,
	gateID uuid.UUID,
	shiftName string,
	shiftStart *string,
	shiftEnd *string,
	assignedFrom time.Time,
	assignedUntil *time.Time,
	isActive bool,
) (repository.SecurityAssignment, error) {
	if collegeID == uuid.Nil {
		return repository.SecurityAssignment{}, fmt.Errorf("college ID is required")
	}

	if staffID == uuid.Nil {
		return repository.SecurityAssignment{}, fmt.Errorf("staff ID is required")
	}

	if gateID == uuid.Nil {
		return repository.SecurityAssignment{}, fmt.Errorf("gate ID is required")
	}

	if assignedFrom.IsZero() {
		assignedFrom = time.Now().UTC()
	}

	if assignedUntil != nil && assignedUntil.Before(assignedFrom) {
		return repository.SecurityAssignment{}, fmt.Errorf(
			"assigned_until must be greater than or equal to assigned_from",
		)
	}

	shiftName = strings.TrimSpace(shiftName)

	normalizedShiftName := &shiftName
	if shiftName == "" {
		normalizedShiftName = nil
	}

	normalizedShiftStart, err := parseShiftTime(shiftStart)
	if err != nil {
		return repository.SecurityAssignment{}, err
	}

	normalizedShiftEnd, err := parseShiftTime(shiftEnd)
	if err != nil {
		return repository.SecurityAssignment{}, err
	}

	// isActive is passed to CreateSecurityAssignment.

	return s.repo.CreateSecurityAssignment(
		ctx,
		collegeID,
		staffID,
		gateID,
		normalizedShiftName,
		normalizedShiftStart,
		normalizedShiftEnd,
		assignedFrom,
		assignedUntil,
		isActive,
	)
}

func (s *SecurityAssignmentService) Update(
	ctx context.Context,
	collegeID uuid.UUID,
	assignmentID uuid.UUID,
	shiftName string,
	shiftStart *string,
	shiftEnd *string,
	assignedFrom time.Time,
	assignedUntil *time.Time,
	isActive bool,
) (repository.SecurityAssignment, error) {
	if collegeID == uuid.Nil {
		return repository.SecurityAssignment{}, fmt.Errorf("college ID is required")
	}

	if assignmentID == uuid.Nil {
		return repository.SecurityAssignment{}, fmt.Errorf("assignment ID is required")
	}

	if assignedFrom.IsZero() {
		return repository.SecurityAssignment{}, fmt.Errorf(
			"assigned_from is required",
		)
	}

	if assignedUntil != nil && assignedUntil.Before(assignedFrom) {
		return repository.SecurityAssignment{}, fmt.Errorf(
			"assigned_until must be greater than or equal to assigned_from",
		)
	}

	shiftName = strings.TrimSpace(shiftName)

	normalizedShiftName := &shiftName
	if shiftName == "" {
		normalizedShiftName = nil
	}

	normalizedShiftStart, err := parseShiftTime(shiftStart)
	if err != nil {
		return repository.SecurityAssignment{}, err
	}

	normalizedShiftEnd, err := parseShiftTime(shiftEnd)
	if err != nil {
		return repository.SecurityAssignment{}, err
	}

	return s.repo.UpdateSecurityAssignment(
		ctx,
		collegeID,
		assignmentID,
		normalizedShiftName,
		normalizedShiftStart,
		normalizedShiftEnd,
		assignedFrom,
		assignedUntil,
		isActive,
	)
}

func (s *SecurityAssignmentService) Delete(
	ctx context.Context,
	collegeID uuid.UUID,
	assignmentID uuid.UUID,
) error {
	if collegeID == uuid.Nil {
		return fmt.Errorf("college ID is required")
	}

	if assignmentID == uuid.Nil {
		return fmt.Errorf("assignment ID is required")
	}

	return s.repo.DeleteSecurityAssignment(
		ctx,
		collegeID,
		assignmentID,
	)
}

func parseShiftTime(value *string) (*time.Time, error) {
	if value == nil {
		return nil, nil
	}

	raw := strings.TrimSpace(*value)

	if raw == "" {
		return nil, nil
	}

	parsed, err := time.Parse("15:04", raw)
	if err != nil {
		parsed, err = time.Parse("15:04:05", raw)
		if err != nil {
			return nil, fmt.Errorf(
				"invalid shift time %q; expected HH:MM or HH:MM:SS",
				raw,
			)
		}
	}

	return &parsed, nil
}
