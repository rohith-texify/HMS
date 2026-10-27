package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

type UpdateCollegeOnboardingInput struct {
	StepCode    string
	Status      string
	Notes       *string
	ActorUserID uuid.UUID
	ActorRole   string
}

func (s *PlatformCollegeService) GetCollegeOnboarding(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]repository.CollegeOnboardingStep, error) {
	if collegeID == uuid.Nil {
		return nil, fmt.Errorf("college ID is required")
	}

	// Confirm the college exists even if no checklist rows are present.
	if _, err := s.repo.GetCollege(ctx, collegeID); err != nil {
		return nil, err
	}

	return s.repo.ListCollegeOnboardingSteps(ctx, collegeID)
}

func (s *PlatformCollegeService) UpdateCollegeOnboarding(
	ctx context.Context,
	collegeID uuid.UUID,
	input UpdateCollegeOnboardingInput,
) (repository.CollegeOnboardingStep, error) {
	input.StepCode = strings.ToUpper(strings.TrimSpace(input.StepCode))
	input.Status = strings.ToUpper(strings.TrimSpace(input.Status))

	switch input.StepCode {
	case "COLLEGE_PROFILE", "COLLEGE_ADMIN", "BRANDING",
		"ENTITLEMENTS", "READINESS_REVIEW", "GO_LIVE":
	default:
		return repository.CollegeOnboardingStep{}, fmt.Errorf("invalid onboarding step")
	}

	switch input.Status {
	case "PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED", "FAILED":
	default:
		return repository.CollegeOnboardingStep{}, fmt.Errorf("invalid onboarding status")
	}

	if collegeID == uuid.Nil || input.ActorUserID == uuid.Nil {
		return repository.CollegeOnboardingStep{}, fmt.Errorf("college and authenticated actor IDs are required")
	}

	if strings.TrimSpace(input.ActorRole) == "" {
		return repository.CollegeOnboardingStep{}, fmt.Errorf("authenticated actor role is required")
	}

	if input.Status == "COMPLETED" && input.Notes == nil {
		return repository.CollegeOnboardingStep{}, fmt.Errorf("notes are required to document step completion")
	}

	var updated repository.CollegeOnboardingStep

	err := s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		// Lock the college row before changing its onboarding checklist.
		// Activation uses the same lock order to prevent concurrent updates.
		_, err := s.repo.GetCollegeStatusForUpdate(txCtx, collegeID)
		if err != nil {
			return fmt.Errorf(
				"lock college before updating onboarding: %w",
				err,
			)
		}

		result, err := s.repo.UpdateCollegeOnboardingStep(
			txCtx,
			collegeID,
			repository.UpdateCollegeOnboardingParams{
				StepCode:    input.StepCode,
				Status:      input.Status,
				Notes:       input.Notes,
				CompletedBy: &input.ActorUserID,
			},
		)
		if err != nil {
			return err
		}

		oldData, err := json.Marshal(map[string]string{
			"step_code": input.StepCode,
			"status":    result.OldStatus,
		})
		if err != nil {
			return err
		}

		newData, err := json.Marshal(map[string]string{
			"step_code": input.StepCode,
			"status":    input.Status,
		})
		if err != nil {
			return err
		}

		_, err = s.repo.Executor(txCtx).Exec(txCtx, `
			INSERT INTO platform.audit_logs (
				audit_id, college_id, actor_user_id, actor_role,
				module, action, entity_type, entity_id,
				old_data, new_data, created_at, severity
			)
			VALUES (
				$1, $2, $3, $4,
				'college_onboarding', 'ONBOARDING_STEP_UPDATED',
				'college_onboarding', $5,
				$6::jsonb, $7::jsonb, NOW(), 'INFO'
			)
		`,
			uuid.New(),
			collegeID,
			input.ActorUserID,
			input.ActorRole,
			result.Step.OnboardingID,
			string(oldData),
			string(newData),
		)
		if err != nil {
			return fmt.Errorf("audit onboarding update: %w", err)
		}

		updated = result.Step
		return nil
	})

	if err != nil {
		return repository.CollegeOnboardingStep{}, fmt.Errorf("update college onboarding: %w", err)
	}

	return updated, nil
}
