package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

// ListApprovalRequests retrieves a list of approval requests with optional filtering and pagination.
func (r *Repository) ListApprovalRequests(
	ctx context.Context,
	status *string,
	collegeID *uuid.UUID,
	requestedBy *uuid.UUID,
	excludeRequester *uuid.UUID,
	limit, offset int,
) ([]models.ApprovalRequest, int, error) {
	// Build the WHERE clause based on optional filters
	whereClause := ""
	args := []interface{}{}
	argPos := 1

	conditions := []string{}

	if status != nil && *status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argPos))
		args = append(args, *status)
		argPos++
	}

	if collegeID != nil {
		conditions = append(conditions, fmt.Sprintf("college_id = $%d", argPos))
		args = append(args, *collegeID)
		argPos++
	}

	if requestedBy != nil {
		conditions = append(conditions, fmt.Sprintf("requested_by = $%d", argPos))
		args = append(args, *requestedBy)
		argPos++
	}

	if excludeRequester != nil {
		conditions = append(conditions, fmt.Sprintf("requested_by != $%d", argPos))
		args = append(args, *excludeRequester)
		argPos++
	}

	if len(conditions) > 0 {
		whereClause = "WHERE " + conditions[0]
		for i := 1; i < len(conditions); i++ {
			whereClause += " AND " + conditions[i]
		}
	}

	// Count total records
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM platform.approval_requests
		%s
	`, whereClause)

	var total int
	err := r.Executor(ctx).QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count approval requests: %w", err)
	}

	// Query for paginated results
	query := fmt.Sprintf(`
		SELECT
			request_id,
			operation_type,
			college_id,
			payload,
			requested_by,
			status,
			reason,
			snapshot,
			expires_at,
			executed_at,
			created_at,
			updated_at
		FROM platform.approval_requests
		%s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argPos, argPos+1)

	args = append(args, limit, offset)

	rows, err := r.Executor(ctx).Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list approval requests: %w", err)
	}
	defer rows.Close()

	var requests []models.ApprovalRequest
	for rows.Next() {
		var req models.ApprovalRequest
		if err := rows.Scan(
			&req.RequestID,
			&req.OperationType,
			&req.CollegeID,
			&req.Payload,
			&req.RequestedBy,
			&req.Status,
			&req.Reason,
			&req.Snapshot,
			&req.ExpiresAt,
			&req.ExecutedAt,
			&req.CreatedAt,
			&req.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan approval request: %w", err)
		}
		requests = append(requests, req)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("failed while reading approval requests: %w", err)
	}

	return requests, total, nil
}

// GetApprovalRequestByID retrieves a single approval request by its ID.
func (r *Repository) GetApprovalRequestByID(
	ctx context.Context,
	requestID uuid.UUID,
) (*models.ApprovalRequest, error) {
	query := `
		SELECT
			request_id,
			operation_type,
			college_id,
			payload,
			requested_by,
			status,
			reason,
			snapshot,
			expires_at,
			executed_at,
			created_at,
			updated_at
		FROM platform.approval_requests
		WHERE request_id = $1
	`

	var req models.ApprovalRequest
	err := r.Executor(ctx).QueryRow(ctx, query, requestID).Scan(
		&req.RequestID,
		&req.OperationType,
		&req.CollegeID,
		&req.Payload,
		&req.RequestedBy,
		&req.Status,
		&req.Reason,
		&req.Snapshot,
		&req.ExpiresAt,
		&req.ExecutedAt,
		&req.CreatedAt,
		&req.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &req, nil
}

// GetApprovalStepsByRequestID retrieves all approval steps for a given request.
func (r *Repository) GetApprovalStepsByRequestID(
	ctx context.Context,
	requestID uuid.UUID,
) ([]models.ApprovalStep, error) {
	query := `
		SELECT
			approval_step_id,
			request_id,
			step_order,
			approver_id,
			decision,
			comment,
			decision_reason,
			decided_at,
			created_at,
			updated_at
		FROM platform.approval_steps
		WHERE request_id = $1
		ORDER BY step_order ASC
	`

	rows, err := r.Executor(ctx).Query(ctx, query, requestID)
	if err != nil {
		return nil, fmt.Errorf("failed to get approval steps: %w", err)
	}
	defer rows.Close()

	var steps []models.ApprovalStep
	for rows.Next() {
		var step models.ApprovalStep
		if err := rows.Scan(
			&step.ApprovalStepID,
			&step.RequestID,
			&step.StepOrder,
			&step.ApproverID,
			&step.Decision,
			&step.Comment,
			&step.DecisionReason,
			&step.DecidedAt,
			&step.CreatedAt,
			&step.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan approval step: %w", err)
		}
		steps = append(steps, step)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed while reading approval steps: %w", err)
	}

	return steps, nil
}

// GetApprovalStepByID retrieves a single approval step by its ID.
func (r *Repository) GetApprovalStepByID(
	ctx context.Context,
	stepID uuid.UUID,
) (*models.ApprovalStep, error) {
	query := `
		SELECT
			approval_step_id,
			request_id,
			step_order,
			approver_id,
			decision,
			comment,
			decision_reason,
			decided_at,
			created_at,
			updated_at
		FROM platform.approval_steps
		WHERE approval_step_id = $1
	`

	var step models.ApprovalStep
	err := r.Executor(ctx).QueryRow(ctx, query, stepID).Scan(
		&step.ApprovalStepID,
		&step.RequestID,
		&step.StepOrder,
		&step.ApproverID,
		&step.Decision,
		&step.Comment,
		&step.DecisionReason,
		&step.DecidedAt,
		&step.CreatedAt,
		&step.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &step, nil
}

// UpdateApprovalStepDecision updates an approval step with the approver's decision.
func (r *Repository) UpdateApprovalStepDecision(
	ctx context.Context,
	stepID uuid.UUID,
	approverID uuid.UUID,
	decision string,
	comment *string,
	reason *string,
) (*models.ApprovalStep, error) {
	now := time.Now()

	query := `
		UPDATE platform.approval_steps
		SET
			approver_id = $1,
			decision = $2,
			comment = $3,
			decision_reason = $4,
			decided_at = $5,
			updated_at = $6
		WHERE approval_step_id = $7
		RETURNING
			approval_step_id,
			request_id,
			step_order,
			approver_id,
			decision,
			comment,
			decision_reason,
			decided_at,
			created_at,
			updated_at
	`

	var step models.ApprovalStep
	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		approverID,
		decision,
		comment,
		reason,
		now,
		now,
		stepID,
	).Scan(
		&step.ApprovalStepID,
		&step.RequestID,
		&step.StepOrder,
		&step.ApproverID,
		&step.Decision,
		&step.Comment,
		&step.DecisionReason,
		&step.DecidedAt,
		&step.CreatedAt,
		&step.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update approval step: %w", err)
	}

	return &step, nil
}

// UpdateApprovalRequestStatus updates the status of an approval request.
func (r *Repository) UpdateApprovalRequestStatus(
	ctx context.Context,
	requestID uuid.UUID,
	status string,
) error {
	query := `
		UPDATE platform.approval_requests
		SET
			status = $1,
			updated_at = $2
		WHERE request_id = $3
	`

	_, err := r.Executor(ctx).Exec(ctx, query, status, time.Now(), requestID)
	if err != nil {
		return fmt.Errorf("failed to update approval request status: %w", err)
	}

	return nil
}

// MarkApprovalRequestAsExecuted marks an approval request as executed.
func (r *Repository) MarkApprovalRequestAsExecuted(
	ctx context.Context,
	requestID uuid.UUID,
) error {
	query := `
		UPDATE platform.approval_requests
		SET
			status = 'EXECUTED',
			executed_at = $1,
			updated_at = $2
		WHERE request_id = $3
	`

	now := time.Now()
	_, err := r.Executor(ctx).Exec(ctx, query, now, now, requestID)
	if err != nil {
		return fmt.Errorf("failed to mark approval request as executed: %w", err)
	}

	return nil
}

// CreateApprovalRequest inserts a new approval request.
func (r *Repository) CreateApprovalRequest(
	ctx context.Context,
	req models.ApprovalRequest,
) (*models.ApprovalRequest, error) {
	payloadJSON, err := json.Marshal(req.Payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	var snapshotJSON []byte
	if req.Snapshot != nil {
		snapshotJSON, err = json.Marshal(req.Snapshot)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal snapshot: %w", err)
		}
	}

	query := `
		INSERT INTO platform.approval_requests (
			request_id,
			operation_type,
			college_id,
			payload,
			requested_by,
			status,
			reason,
			snapshot,
			expires_at,
			created_at,
			updated_at
		)
		VALUES (
			gen_random_uuid(),
			$1, $2, $3::jsonb, $4, 'PENDING', $5, $6, $7, NOW(), NOW()
		)
		RETURNING
			request_id,
			operation_type,
			college_id,
			payload,
			requested_by,
			status,
			reason,
			snapshot,
			expires_at,
			executed_at,
			created_at,
			updated_at
	`

	var created models.ApprovalRequest
	err = r.Executor(ctx).QueryRow(
		ctx,
		query,
		req.OperationType,
		req.CollegeID,
		string(payloadJSON),
		req.RequestedBy,
		req.Reason,
		snapshotJSON,
		req.ExpiresAt,
	).Scan(
		&created.RequestID,
		&created.OperationType,
		&created.CollegeID,
		&created.Payload,
		&created.RequestedBy,
		&created.Status,
		&created.Reason,
		&created.Snapshot,
		&created.ExpiresAt,
		&created.ExecutedAt,
		&created.CreatedAt,
		&created.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert approval request: %w", err)
	}

	return &created, nil
}

// CreateApprovalStep inserts an individual approval step.
func (r *Repository) CreateApprovalStep(
	ctx context.Context,
	requestID uuid.UUID,
	stepOrder int,
	approverID *uuid.UUID,
) (*models.ApprovalStep, error) {
	query := `
		INSERT INTO platform.approval_steps (
			approval_step_id,
			request_id,
			step_order,
			approver_id,
			decision,
			created_at,
			updated_at
		)
		VALUES (
			gen_random_uuid(),
			$1, $2, $3, 'PENDING', NOW(), NOW()
		)
		RETURNING
			approval_step_id,
			request_id,
			step_order,
			approver_id,
			decision,
			comment,
			decision_reason,
			decided_at,
			created_at,
			updated_at
	`

	var step models.ApprovalStep
	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		requestID,
		stepOrder,
		approverID,
	).Scan(
		&step.ApprovalStepID,
		&step.RequestID,
		&step.StepOrder,
		&step.ApproverID,
		&step.Decision,
		&step.Comment,
		&step.DecisionReason,
		&step.DecidedAt,
		&step.CreatedAt,
		&step.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert approval step: %w", err)
	}

	return &step, nil
}

// GetApprovalRequestByIDForUpdate retrieves a single approval request with an exclusive row lock.
func (r *Repository) GetApprovalRequestByIDForUpdate(
	ctx context.Context,
	requestID uuid.UUID,
) (*models.ApprovalRequest, error) {
	query := `
		SELECT
			request_id,
			operation_type,
			college_id,
			payload,
			requested_by,
			status,
			reason,
			snapshot,
			expires_at,
			executed_at,
			created_at,
			updated_at
		FROM platform.approval_requests
		WHERE request_id = $1
		FOR UPDATE
	`

	var req models.ApprovalRequest
	err := r.Executor(ctx).QueryRow(ctx, query, requestID).Scan(
		&req.RequestID,
		&req.OperationType,
		&req.CollegeID,
		&req.Payload,
		&req.RequestedBy,
		&req.Status,
		&req.Reason,
		&req.Snapshot,
		&req.ExpiresAt,
		&req.ExecutedAt,
		&req.CreatedAt,
		&req.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &req, nil
}

// GetApprovalStepByIDForUpdate retrieves a single approval step with an exclusive row lock.
func (r *Repository) GetApprovalStepByIDForUpdate(
	ctx context.Context,
	stepID uuid.UUID,
) (*models.ApprovalStep, error) {
	query := `
		SELECT
			approval_step_id,
			request_id,
			step_order,
			approver_id,
			decision,
			comment,
			decision_reason,
			decided_at,
			created_at,
			updated_at
		FROM platform.approval_steps
		WHERE approval_step_id = $1
		FOR UPDATE
	`

	var step models.ApprovalStep
	err := r.Executor(ctx).QueryRow(ctx, query, stepID).Scan(
		&step.ApprovalStepID,
		&step.RequestID,
		&step.StepOrder,
		&step.ApproverID,
		&step.Decision,
		&step.Comment,
		&step.DecisionReason,
		&step.DecidedAt,
		&step.CreatedAt,
		&step.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &step, nil
}

// RecordApprovalAudit writes an immutable audit log record to platform.audit_logs.
func (r *Repository) RecordApprovalAudit(
	ctx context.Context,
	params models.ApprovalAuditParams,
) error {
	if params.ActorUserID == uuid.Nil {
		return fmt.Errorf("actor user ID is required for audit")
	}

	oldDataJSON := []byte("{}")
	if params.OldData != nil {
		if b, err := json.Marshal(params.OldData); err == nil {
			oldDataJSON = b
		}
	}

	newDataJSON := []byte("{}")
	if params.NewData != nil {
		if b, err := json.Marshal(params.NewData); err == nil {
			newDataJSON = b
		}
	}

	module := params.Module
	if module == "" {
		module = "platform_approvals"
	}

	severity := params.Severity
	if severity == "" {
		severity = "INFO"
	}

	_, err := r.Executor(ctx).Exec(ctx, `
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
			$5, $6, $7, $8,
			$9::jsonb, $10::jsonb,
			$11, NOW(), $12
		)
	`,
		uuid.New(),
		params.CollegeID,
		params.ActorUserID,
		params.ActorRole,
		module,
		params.Action,
		params.EntityType,
		params.EntityID,
		string(oldDataJSON),
		string(newDataJSON),
		params.Reason,
		severity,
	)
	if err != nil {
		return fmt.Errorf("record approval audit: %w", err)
	}

	return nil
}

// ExecuteOperation executes an approved operation payload safely within a database transaction.
func (r *Repository) ExecuteOperation(
	ctx context.Context,
	opType string,
	collegeID *uuid.UUID,
	payload models.JSONB,
	actorID uuid.UUID,
) error {
	switch opType {
	case "COLLEGE_STATUS_UPDATE":
		statusVal, ok := payload["status"].(string)
		if !ok || statusVal == "" {
			return fmt.Errorf("status is required in payload for COLLEGE_STATUS_UPDATE")
		}
		if collegeID == nil || *collegeID == uuid.Nil {
			if cidStr, ok := payload["college_id"].(string); ok {
				cid, err := uuid.Parse(cidStr)
				if err == nil {
					collegeID = &cid
				}
			}
		}
		if collegeID == nil || *collegeID == uuid.Nil {
			return fmt.Errorf("college_id is required for COLLEGE_STATUS_UPDATE")
		}
		var reasonPtr *string
		if rVal, ok := payload["reason"].(string); ok && rVal != "" {
			reasonPtr = &rVal
		}
		now := time.Now()
		query := `UPDATE platform.colleges SET status = $1, lifecycle_reason = $2, updated_at = $3`
		args := []interface{}{statusVal, reasonPtr, now}
		argPos := 4
		switch statusVal {
		case "ACTIVE":
			query += fmt.Sprintf(`, activated_at = COALESCE(activated_at, $%d), suspended_at = NULL`, argPos)
			args = append(args, now)
			argPos++
		case "SUSPENDED":
			query += fmt.Sprintf(`, suspended_at = $%d`, argPos)
			args = append(args, now)
			argPos++
		case "DEACTIVATED":
			query += fmt.Sprintf(`, deactivated_at = $%d`, argPos)
			args = append(args, now)
			argPos++
		}
		query += fmt.Sprintf(` WHERE college_id = $%d`, argPos)
		args = append(args, *collegeID)
		tag, err := r.Executor(ctx).Exec(ctx, query, args...)
		if err != nil {
			return fmt.Errorf("execute COLLEGE_STATUS_UPDATE: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return fmt.Errorf("college %s not found for status update", collegeID.String())
		}
		return nil

	case "COLLEGE_MODULE_UPDATE":
		var cmID uuid.UUID
		if cmIDStr, ok := payload["college_module_id"].(string); ok {
			cmID, _ = uuid.Parse(cmIDStr)
		}
		statusVal, _ := payload["status"].(string)
		modeVal, _ := payload["mode"].(string)
		if statusVal == "" {
			statusVal = "ACTIVE"
		}
		if modeVal == "" {
			modeVal = "FULL"
		}
		var reasonVal *string
		if rStr, ok := payload["reason"].(string); ok && rStr != "" {
			reasonVal = &rStr
		}
		if cmID != uuid.Nil {
			_, err := r.Executor(ctx).Exec(ctx, `
				UPDATE platform.college_modules
				SET status = $1, mode = $2, reason = $3, change_reason = $3, changed_by = $4, updated_at = NOW()
				WHERE college_module_id = $5
			`, statusVal, modeVal, reasonVal, actorID, cmID)
			if err != nil {
				return fmt.Errorf("execute COLLEGE_MODULE_UPDATE: %w", err)
			}
		} else if collegeID != nil && *collegeID != uuid.Nil {
			var modID uuid.UUID
			if mStr, ok := payload["module_id"].(string); ok {
				modID, _ = uuid.Parse(mStr)
			}
			if modID != uuid.Nil {
				_, err := r.Executor(ctx).Exec(ctx, `
					UPDATE platform.college_modules
					SET status = $1, mode = $2, reason = $3, change_reason = $3, changed_by = $4, updated_at = NOW()
					WHERE college_id = $5 AND module_id = $6
				`, statusVal, modeVal, reasonVal, actorID, *collegeID, modID)
				if err != nil {
					return fmt.Errorf("execute COLLEGE_MODULE_UPDATE: %w", err)
				}
			}
		}
		return nil

	case "COLLEGE_SETTING_UPDATE":
		keyVal, ok := payload["key"].(string)
		if !ok || keyVal == "" {
			return fmt.Errorf("setting key is required")
		}
		valStr, _ := payload["value"].(string)
		if collegeID == nil || *collegeID == uuid.Nil {
			if cidStr, ok := payload["college_id"].(string); ok {
				cid, err := uuid.Parse(cidStr)
				if err == nil {
					collegeID = &cid
				}
			}
		}
		if collegeID == nil || *collegeID == uuid.Nil {
			return fmt.Errorf("college_id is required for setting update")
		}

		var valJSON []byte
		if valStr == "" {
			valJSON = []byte("{}")
		} else if json.Valid([]byte(valStr)) {
			valJSON = []byte(valStr)
		} else {
			var err error
			valJSON, err = json.Marshal(valStr)
			if err != nil {
				valJSON = []byte("{}")
			}
		}

		_, err := r.Executor(ctx).Exec(ctx, `
			INSERT INTO platform.college_settings (college_id, setting_key, setting_value, updated_at)
			VALUES ($1, $2, $3::jsonb, NOW())
			ON CONFLICT (college_id, setting_key)
			DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
		`, *collegeID, keyVal, string(valJSON))
		if err != nil {
			return fmt.Errorf("execute COLLEGE_SETTING_UPDATE: %w", err)
		}
		return nil

	case "MODULE_CATALOGUE_UPDATE":
		var mID uuid.UUID
		if mIDStr, ok := payload["module_id"].(string); ok {
			var err error
			mID, err = uuid.Parse(mIDStr)
			if err != nil {
				return fmt.Errorf("invalid module_id: %w", err)
			}
		}
		isActive, ok := payload["is_active"].(bool)
		if !ok {
			return fmt.Errorf("is_active boolean required")
		}
		_, err := r.Executor(ctx).Exec(ctx, `
			UPDATE platform.modules
			SET is_active = $1, updated_at = NOW()
			WHERE module_id = $2
		`, isActive, mID)
		if err != nil {
			return fmt.Errorf("execute MODULE_CATALOGUE_UPDATE: %w", err)
		}
		return nil

	case "COLLEGE_CREATE":
		code, _ := payload["college_code"].(string)
		name, _ := payload["name"].(string)
		if code == "" || name == "" {
			return fmt.Errorf("college_code and name are required")
		}
		newColID := uuid.New()
		city, _ := payload["city"].(string)
		state, _ := payload["state"].(string)
		tz, _ := payload["timezone"].(string)
		if tz == "" {
			tz = "Asia/Kolkata"
		}
		email, _ := payload["contact_email"].(string)

		_, err := r.Executor(ctx).Exec(ctx, `
			INSERT INTO platform.colleges (college_id, college_code, name, city, state, timezone, contact_email, status, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, 'ONBOARDING', NOW(), NOW())
		`, newColID, code, name, city, state, tz, email)
		if err != nil {
			return fmt.Errorf("execute COLLEGE_CREATE: %w", err)
		}

		// Seed onboarding steps
		steps := []string{
			"COLLEGE_PROFILE",
			"COLLEGE_ADMIN",
			"READINESS_REVIEW",
			"GO_LIVE",
		}
		for _, s := range steps {
			_, _ = r.Executor(ctx).Exec(ctx, `
				INSERT INTO platform.college_onboarding (onboarding_id, college_id, step_code, status, created_at, updated_at)
				VALUES (gen_random_uuid(), $1, $2, 'PENDING', NOW(), NOW())
				ON CONFLICT DO NOTHING
			`, newColID, s)
		}
		return nil

	case "PLATFORM_NOTIFICATION_PUBLISH":
		notifIDStr, ok := payload["notification_id"].(string)
		if !ok || notifIDStr == "" {
			return fmt.Errorf("notification_id is required for PLATFORM_NOTIFICATION_PUBLISH")
		}
		notifID, err := uuid.Parse(notifIDStr)
		if err != nil {
			return fmt.Errorf("invalid notification_id: %w", err)
		}
		now := time.Now().UTC()
		_, err = r.Executor(ctx).Exec(ctx, `
			UPDATE app.platform_notifications
			SET status = 'PUBLISHED', published_by = $1, published_at = $2, updated_at = $2
			WHERE id = $3 AND status IN ('DRAFT', 'SCHEDULED')
		`, actorID, now, notifID)
		if err != nil {
			return fmt.Errorf("execute PLATFORM_NOTIFICATION_PUBLISH: %w", err)
		}
		return nil

	default:
		return fmt.Errorf("unsupported approval operation type: %s", opType)
	}
}
