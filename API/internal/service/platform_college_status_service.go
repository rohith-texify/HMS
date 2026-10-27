package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

type UpdateCollegeStatusInput struct {
	Status          string
	LifecycleReason string

	// Taken from the authenticated JWT context, never from the request body.
	ActorUserID uuid.UUID
	ActorRole   string
}

func (s *PlatformCollegeService) UpdateCollegeStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	input UpdateCollegeStatusInput,
) (repository.PlatformCollegeStatus, error) {
	if collegeID == uuid.Nil {
		return repository.PlatformCollegeStatus{}, fmt.Errorf("college ID is required")
	}

	input.Status = strings.ToUpper(strings.TrimSpace(input.Status))
	input.LifecycleReason = strings.TrimSpace(input.LifecycleReason)

	switch input.Status {
	case "ONBOARDING", "ACTIVE", "SUSPENDED", "DEACTIVATED":
		// Supported status.
	default:
		return repository.PlatformCollegeStatus{}, fmt.Errorf(
			"invalid college status: %s", input.Status,
		)
	}

	if input.LifecycleReason == "" {
		return repository.PlatformCollegeStatus{}, fmt.Errorf("lifecycle reason is required")
	}

	var college repository.PlatformCollegeStatus

	err := s.db.WithPlatformTransaction(
		ctx,
		func(txCtx context.Context, _ pgx.Tx) error {
			currentStatus, err := s.repo.GetCollegeStatusForUpdate(
				txCtx,
				collegeID,
			)
			if err != nil {
				return err
			}

			if currentStatus == input.Status {
				return fmt.Errorf(
					"college status is already %s",
					currentStatus,
				)
			}

			allowed := false

			switch currentStatus {
			case "ONBOARDING":
				allowed = input.Status == "ACTIVE" ||
					input.Status == "DEACTIVATED"
			case "ACTIVE":
				allowed = input.Status == "SUSPENDED" ||
					input.Status == "DEACTIVATED"
			case "SUSPENDED":
				allowed = input.Status == "ACTIVE" ||
					input.Status == "DEACTIVATED"
			case "DEACTIVATED":
				allowed = input.Status == "ACTIVE"
			}

			if !allowed {
				return fmt.Errorf(
					"invalid college status transition: %s -> %s",
					currentStatus,
					input.Status,
				)
			}

			// Do not activate a college until every required onboarding
			// step exists and has been completed.
			if currentStatus == "ONBOARDING" &&
				input.Status == "ACTIVE" {
				if err := s.repo.ValidateCollegeOnboardingReadyForActivation(
					txCtx,
					collegeID,
				); err != nil {
					return fmt.Errorf(
						"college onboarding is not ready for activation: %w",
						err,
					)
				}
			}

			if input.ActorUserID == uuid.Nil {
				return fmt.Errorf("authenticated actor user ID is required")
			}

			college, err = s.repo.UpdateCollegeStatus(
				txCtx,
				collegeID,
				repository.UpdateCollegeStatusParams{
					Status:          input.Status,
					LifecycleReason: input.LifecycleReason,
				},
			)
			if err != nil {
				return err
			}

			return s.repo.RecordCollegeLifecycleAudit(
				txCtx,
				repository.CollegeLifecycleAuditParams{
					CollegeID:       collegeID,
					ActorUserID:     input.ActorUserID,
					ActorRole:       input.ActorRole,
					OldStatus:       currentStatus,
					NewStatus:       input.Status,
					LifecycleReason: input.LifecycleReason,
				},
			)
		},
	)

	if err != nil {
		return repository.PlatformCollegeStatus{}, fmt.Errorf(
			"failed to update college status: %w", err,
		)
	}

	return college, nil
}
