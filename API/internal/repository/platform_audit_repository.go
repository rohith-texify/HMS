package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
)

type CollegeLifecycleAuditParams struct {
	CollegeID       uuid.UUID
	ActorUserID     uuid.UUID
	ActorRole       string
	OldStatus       string
	NewStatus       string
	LifecycleReason string
}

// RecordCollegeLifecycleAudit writes a college lifecycle change.
// It uses Executor(ctx), so an existing transaction is reused.
func (r *Repository) RecordCollegeLifecycleAudit(
	ctx context.Context,
	params CollegeLifecycleAuditParams,
) error {
	if params.CollegeID == uuid.Nil {
		return fmt.Errorf("college ID is required for audit")
	}
	if params.ActorUserID == uuid.Nil {
		return fmt.Errorf("actor user ID is required for audit")
	}

	oldData, err := json.Marshal(map[string]string{
		"status": params.OldStatus,
	})
	if err != nil {
		return fmt.Errorf("marshal old lifecycle data: %w", err)
	}

	newData, err := json.Marshal(map[string]string{
		"status": params.NewStatus,
	})
	if err != nil {
		return fmt.Errorf("marshal new lifecycle data: %w", err)
	}

	_, err = r.Executor(ctx).Exec(ctx, `
		INSERT INTO platform.audit_logs (
			audit_id,
			college_id,
			actor_user_id,
			actor_role,
			module,
			action,
			entity_type,
			entity_id,
			old_data,
			new_data,
			reason,
			created_at,
			severity
		)
		VALUES (
			$1, $2, $3, $4,
			'platform_colleges',
			$5,
			'college',
			$2,
			$6::jsonb,
			$7::jsonb,
			$8,
			NOW(),
			'INFO'
		)
	`,
		uuid.New(),
		params.CollegeID,
		params.ActorUserID,
		params.ActorRole,
		"COLLEGE_STATUS_CHANGED",
		string(oldData),
		string(newData),
		params.LifecycleReason,
	)
	if err != nil {
		return fmt.Errorf("insert college lifecycle audit record: %w", err)
	}

	return nil
}
