package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type CollegeOnboardingStep struct {
	OnboardingID uuid.UUID  `json:"onboarding_id"`
	CollegeID    uuid.UUID  `json:"college_id"`
	StepCode     string     `json:"step_code"`
	Status       string     `json:"status"`
	CompletedBy  *uuid.UUID `json:"completed_by,omitempty"`
	CompletedAt  *string    `json:"completed_at,omitempty"`
	Notes        *string    `json:"notes,omitempty"`
}

// CreateInitialCollegeOnboardingSteps creates the initial checklist.
// Call this inside the same transaction that creates the college.
func (r *Repository) CreateInitialCollegeOnboardingSteps(
	ctx context.Context,
	collegeID uuid.UUID,
) error {
	if collegeID == uuid.Nil {
		return fmt.Errorf("college ID is required for onboarding")
	}

	stepCodes := []string{
		"COLLEGE_PROFILE",
		"COLLEGE_ADMIN",
		"BRANDING",
		"ENTITLEMENTS",
		"READINESS_REVIEW",
		"GO_LIVE",
	}

	for _, stepCode := range stepCodes {
		_, err := r.Executor(ctx).Exec(
			ctx,
			`
			INSERT INTO platform.college_onboarding (
				college_id,
				step_code,
				status
			)
			VALUES ($1, $2, 'PENDING')
			ON CONFLICT (college_id, step_code) DO NOTHING
			`,
			collegeID,
			stepCode,
		)
		if err != nil {
			return fmt.Errorf(
				"create onboarding step %s: %w",
				stepCode,
				err,
			)
		}
	}

	return nil
}

// ListCollegeOnboardingSteps retrieves a college's onboarding checklist.
func (r *Repository) ListCollegeOnboardingSteps(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]CollegeOnboardingStep, error) {
	rows, err := r.Executor(ctx).Query(
		ctx,
		`
		SELECT
			onboarding_id,
			college_id,
			step_code,
			status,
			completed_by,
			completed_at::text,
			notes
		FROM platform.college_onboarding
		WHERE college_id = $1
		ORDER BY created_at ASC, step_code ASC
		`,
		collegeID,
	)
	if err != nil {
		return nil, fmt.Errorf(
			"list college onboarding steps: %w",
			err,
		)
	}
	defer rows.Close()

	steps := make([]CollegeOnboardingStep, 0)

	for rows.Next() {
		var step CollegeOnboardingStep

		if err := rows.Scan(
			&step.OnboardingID,
			&step.CollegeID,
			&step.StepCode,
			&step.Status,
			&step.CompletedBy,
			&step.CompletedAt,
			&step.Notes,
		); err != nil {
			return nil, fmt.Errorf(
				"scan college onboarding step: %w",
				err,
			)
		}

		steps = append(steps, step)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf(
			"read college onboarding steps: %w",
			err,
		)
	}

	return steps, nil
}

type UpdateCollegeOnboardingParams struct {
	StepCode    string
	Status      string
	Notes       *string
	CompletedBy *uuid.UUID
}

type CollegeOnboardingUpdateResult struct {
	Step      CollegeOnboardingStep
	OldStatus string
}

// UpdateCollegeOnboardingStep updates a step inside the caller's transaction.
func (r *Repository) UpdateCollegeOnboardingStep(
	ctx context.Context,
	collegeID uuid.UUID,
	params UpdateCollegeOnboardingParams,
) (CollegeOnboardingUpdateResult, error) {
	if collegeID == uuid.Nil {
		return CollegeOnboardingUpdateResult{}, fmt.Errorf("college ID is required")
	}

	var result CollegeOnboardingUpdateResult

	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT status
		FROM platform.college_onboarding
		WHERE college_id = $1 AND step_code = $2
		FOR UPDATE
	`, collegeID, params.StepCode).Scan(&result.OldStatus)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return result, ErrNotFound
		}
		return result, fmt.Errorf("lock onboarding step: %w", err)
	}

	_, err = r.Executor(ctx).Exec(ctx, `
		UPDATE platform.college_onboarding
		SET
			status = $3,
			notes = $4,
			completed_by = CASE
				WHEN $3::varchar = 'COMPLETED' THEN $5::uuid
				ELSE NULL
			END,
			completed_at = CASE
				WHEN $3::varchar = 'COMPLETED' THEN NOW()
				ELSE NULL
			END,
			updated_at = NOW()
		WHERE college_id = $1 AND step_code = $2
	`, collegeID, params.StepCode, params.Status, params.Notes, params.CompletedBy)

	if err != nil {
		return result, fmt.Errorf("update onboarding step: %w", err)
	}

	var step CollegeOnboardingStep

	err = r.Executor(ctx).QueryRow(ctx, `
		SELECT
			onboarding_id, college_id, step_code, status,
			completed_by, completed_at::text, notes
		FROM platform.college_onboarding
		WHERE college_id = $1 AND step_code = $2
	`, collegeID, params.StepCode).Scan(
		&step.OnboardingID,
		&step.CollegeID,
		&step.StepCode,
		&step.Status,
		&step.CompletedBy,
		&step.CompletedAt,
		&step.Notes,
	)

	if err != nil {
		return result, fmt.Errorf("read updated onboarding step: %w", err)
	}

	result.Step = step
	return result, nil
}

// ValidateCollegeOnboardingReadyForActivation ensures all required
// onboarding steps exist and are completed before college activation.
// Call inside the same transaction as the college status update.
func (r *Repository) ValidateCollegeOnboardingReadyForActivation(
	ctx context.Context,
	collegeID uuid.UUID,
) error {
	rows, err := r.Executor(ctx).Query(
		ctx,
		`
		SELECT step_code, status
		FROM platform.college_onboarding
		WHERE college_id = $1
		ORDER BY step_code
		FOR UPDATE
		`,
		collegeID,
	)
	if err != nil {
		return fmt.Errorf("lock college onboarding checklist: %w", err)
	}
	defer rows.Close()

	requiredSteps := map[string]bool{
		"COLLEGE_PROFILE":  false,
		"COLLEGE_ADMIN":    false,
		"BRANDING":         false,
		"ENTITLEMENTS":     false,
		"READINESS_REVIEW": false,
		"GO_LIVE":          false,
	}

	for rows.Next() {
		var stepCode, status string
		if err := rows.Scan(&stepCode, &status); err != nil {
			return fmt.Errorf("read onboarding checklist: %w", err)
		}

		if _, required := requiredSteps[stepCode]; !required {
			continue
		}

		if status != "COMPLETED" {
			return fmt.Errorf(
				"onboarding step %s must be COMPLETED before activation",
				stepCode,
			)
		}

		requiredSteps[stepCode] = true
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate onboarding checklist: %w", err)
	}

	for stepCode, completed := range requiredSteps {
		if !completed {
			return fmt.Errorf(
				"required onboarding step %s is missing",
				stepCode,
			)
		}
	}

	return nil
}
