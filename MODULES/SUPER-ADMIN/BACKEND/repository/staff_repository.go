package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

// PlatformStaffAuditParams holds fields for auditing company staff operations.
type PlatformStaffAuditParams struct {
	ActorUserID uuid.UUID
	ActorRole   string
	TargetStaff uuid.UUID
	Action      string
	Email       string
	Details     map[string]interface{}
}

// ListPlatformStaff retrieves all company / platform staff accounts.
func (r *Repository) ListPlatformStaff(
	ctx context.Context,
	status string,
	limit int,
	offset int,
) ([]models.PlatformStaffAccount, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	var countQuery strings.Builder
	countQuery.WriteString(`
		SELECT COUNT(DISTINCT u.user_id)
		FROM app.users u
		JOIN platform.user_roles ur ON ur.user_id = u.user_id
		JOIN platform.roles r ON r.role_id = ur.role_id
		WHERE r.scope = 'PLATFORM'
		  AND ur.college_id IS NULL
	`)
	args := []interface{}{}
	argIdx := 1

	if status != "" {
		countQuery.WriteString(fmt.Sprintf(" AND u.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	var total int
	err := r.Executor(ctx).QueryRow(ctx, countQuery.String(), args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count platform staff: %w", err)
	}

	var query strings.Builder
	query.WriteString(`
		SELECT
			u.user_id,
			u.email,
			u.phone,
			u.status,
			r.role_code,
			r.role_name,
			r.scope,
			u.mfa_enabled,
			u.last_login_at,
			u.created_at
		FROM app.users u
		JOIN platform.user_roles ur ON ur.user_id = u.user_id
		JOIN platform.roles r ON r.role_id = ur.role_id
		WHERE r.scope = 'PLATFORM'
		  AND ur.college_id IS NULL
	`)

	queryArgs := []interface{}{}
	qArgIdx := 1

	if status != "" {
		query.WriteString(fmt.Sprintf(" AND u.status = $%d", qArgIdx))
		queryArgs = append(queryArgs, status)
		qArgIdx++
	}

	query.WriteString(fmt.Sprintf(" ORDER BY u.created_at DESC LIMIT $%d OFFSET $%d", qArgIdx, qArgIdx+1))
	queryArgs = append(queryArgs, limit, offset)

	rows, err := r.Executor(ctx).Query(ctx, query.String(), queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("list platform staff query: %w", err)
	}
	defer rows.Close()

	var staffList []models.PlatformStaffAccount
	for rows.Next() {
		var s models.PlatformStaffAccount
		if err := rows.Scan(
			&s.UserID,
			&s.Email,
			&s.Phone,
			&s.Status,
			&s.RoleCode,
			&s.RoleName,
			&s.RoleScope,
			&s.MFAEnabled,
			&s.LastLoginAt,
			&s.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan platform staff row: %w", err)
		}
		staffList = append(staffList, s)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate platform staff: %w", err)
	}

	return staffList, total, nil
}

// GetPlatformStaffByID retrieves a single platform staff member by their user ID.
func (r *Repository) GetPlatformStaffByID(
	ctx context.Context,
	userID uuid.UUID,
) (*models.PlatformStaffAccount, error) {
	if userID == uuid.Nil {
		return nil, fmt.Errorf("user ID is required")
	}

	query := `
		SELECT
			u.user_id,
			u.email,
			u.phone,
			u.status,
			r.role_code,
			r.role_name,
			r.scope,
			u.mfa_enabled,
			u.last_login_at,
			u.created_at
		FROM app.users u
		JOIN platform.user_roles ur ON ur.user_id = u.user_id
		JOIN platform.roles r ON r.role_id = ur.role_id
		WHERE u.user_id = $1
		  AND r.scope = 'PLATFORM'
		  AND ur.college_id IS NULL
		LIMIT 1
	`
	var s models.PlatformStaffAccount
	err := r.Executor(ctx).QueryRow(ctx, query, userID).Scan(
		&s.UserID,
		&s.Email,
		&s.Phone,
		&s.Status,
		&s.RoleCode,
		&s.RoleName,
		&s.RoleScope,
		&s.MFAEnabled,
		&s.LastLoginAt,
		&s.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, pgx.ErrNoRows
		}
		return nil, fmt.Errorf("get platform staff: %w", err)
	}

	return &s, nil
}

// CountActivePlatformStaff counts how many active platform staff accounts exist.
func (r *Repository) CountActivePlatformStaff(ctx context.Context) (int, error) {
	const query = `
		SELECT COUNT(DISTINCT u.user_id)
		FROM app.users u
		JOIN platform.user_roles ur ON ur.user_id = u.user_id
		JOIN platform.roles r ON r.role_id = ur.role_id
		WHERE r.scope = 'PLATFORM'
		  AND ur.college_id IS NULL
		  AND ur.status = 'ACTIVE'
		  AND u.status = 'ACTIVE'
	`
	var count int
	err := r.Executor(ctx).QueryRow(ctx, query).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count active platform staff: %w", err)
	}
	return count, nil
}

// UpdatePlatformStaffProfile updates permitted fields (phone) for a platform staff member.
func (r *Repository) UpdatePlatformStaffProfile(
	ctx context.Context,
	userID uuid.UUID,
	phone *string,
) (*models.PlatformStaffAccount, error) {
	if userID == uuid.Nil {
		return nil, fmt.Errorf("user ID is required")
	}

	// Verify target user is a platform staff member
	staff, err := r.GetPlatformStaffByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	_, err = r.Executor(ctx).Exec(ctx, `
		UPDATE app.users
		SET phone = $1,
		    updated_at = now()
		WHERE user_id = $2
	`, phone, userID)
	if err != nil {
		return nil, fmt.Errorf("update platform staff profile: %w", err)
	}

	staff.Phone = phone
	return staff, nil
}

// UpdatePlatformStaffStatus updates account status with atomic Last Platform Owner / Super Admin protection.
func (r *Repository) UpdatePlatformStaffStatus(
	ctx context.Context,
	userID uuid.UUID,
	targetStatus string,
) (*models.PlatformStaffAccount, error) {
	if userID == uuid.Nil {
		return nil, fmt.Errorf("user ID is required")
	}

	// 1. Lock and check target staff member
	var currentStatus string
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT u.status
		FROM app.users u
		JOIN platform.user_roles ur ON ur.user_id = u.user_id
		JOIN platform.roles r ON r.role_id = ur.role_id
		WHERE u.user_id = $1
		  AND r.scope = 'PLATFORM'
		  AND ur.college_id IS NULL
		FOR UPDATE OF u
	`, userID).Scan(&currentStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("platform staff member not found")
		}
		return nil, fmt.Errorf("lock platform staff row: %w", err)
	}

	// 2. If deactivating or suspending, enforce Last Platform Owner protection
	if (targetStatus == "DEACTIVATED" || targetStatus == "SUSPENDED") && currentStatus == "ACTIVE" {
		activeCount, countErr := r.CountActivePlatformStaff(ctx)
		if countErr != nil {
			return nil, countErr
		}
		if activeCount <= 1 {
			return nil, fmt.Errorf("cannot deactivate the last active Platform Owner / Super Administrator")
		}
	}

	// 3. Update app.users
	_, err = r.Executor(ctx).Exec(ctx, `
		UPDATE app.users
		SET status = $1,
		    updated_at = now()
		WHERE user_id = $2
	`, targetStatus, userID)
	if err != nil {
		return nil, fmt.Errorf("update user status: %w", err)
	}

	// 4. Update platform.user_roles
	userRoleStatus := "ACTIVE"
	if targetStatus == "DEACTIVATED" {
		userRoleStatus = "REVOKED"
	} else if targetStatus == "SUSPENDED" {
		userRoleStatus = "SUSPENDED"
	}
	_, err = r.Executor(ctx).Exec(ctx, `
		UPDATE platform.user_roles
		SET status = $1,
		    updated_at = now()
		WHERE user_id = $2
		  AND college_id IS NULL
	`, userRoleStatus, userID)
	if err != nil {
		return nil, fmt.Errorf("update user role status: %w", err)
	}

	return r.GetPlatformStaffByID(ctx, userID)
}

// GetPlatformStaffPendingApprovals retrieves pending approval steps assigned to this staff member.
func (r *Repository) GetPlatformStaffPendingApprovals(
	ctx context.Context,
	userID uuid.UUID,
) ([]models.StaffPendingApprovalItem, error) {
	if userID == uuid.Nil {
		return nil, fmt.Errorf("user ID is required")
	}

	query := `
		SELECT
			s.approval_step_id,
			s.request_id,
			r.operation_type,
			r.college_id,
			r.requested_by,
			s.step_order,
			r.reason,
			s.created_at,
			r.expires_at
		FROM platform.approval_steps s
		JOIN platform.approval_requests r ON r.request_id = s.request_id
		WHERE s.approver_id = $1
		  AND s.decision = 'PENDING'
		  AND r.status = 'PENDING'
		ORDER BY s.created_at ASC
	`
	rows, err := r.Executor(ctx).Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("query pending approvals: %w", err)
	}
	defer rows.Close()

	var items []models.StaffPendingApprovalItem
	for rows.Next() {
		var item models.StaffPendingApprovalItem
		if err := rows.Scan(
			&item.ApprovalStepID,
			&item.RequestID,
			&item.OperationType,
			&item.CollegeID,
			&item.RequestedBy,
			&item.StepOrder,
			&item.Reason,
			&item.CreatedAt,
			&item.ExpiresAt,
		); err != nil {
			return nil, fmt.Errorf("scan pending approval item: %w", err)
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate pending approvals: %w", err)
	}

	return items, nil
}

// RecordPlatformStaffAudit writes an immutable audit record to platform.audit_logs.
func (r *Repository) RecordPlatformStaffAudit(
	ctx context.Context,
	params PlatformStaffAuditParams,
) error {
	newData, err := json.Marshal(map[string]interface{}{
		"target_user_id": params.TargetStaff.String(),
		"target_email":   params.Email,
		"details":        params.Details,
	})
	if err != nil {
		return fmt.Errorf("marshal staff audit data: %w", err)
	}

	var actorUserArg interface{}
	if params.ActorUserID != uuid.Nil {
		actorUserArg = params.ActorUserID
	}

	var actorRoleArg interface{}
	if strings.TrimSpace(params.ActorRole) != "" {
		actorRoleArg = strings.TrimSpace(params.ActorRole)
	}

	const query = `
		INSERT INTO platform.audit_logs (
			audit_id,
			college_id,
			actor_user_id,
			actor_role,
			module,
			action,
			entity_type,
			entity_id,
			new_data,
			severity,
			created_at
		) VALUES (
			gen_random_uuid(),
			NULL,
			$1,
			$2,
			'super_admin_company_staff',
			$3,
			'app.users',
			$4,
			$5,
			'INFO',
			now()
		)
	`
	_, err = r.Executor(ctx).Exec(
		ctx,
		query,
		actorUserArg,
		actorRoleArg,
		params.Action,
		params.TargetStaff,
		newData,
	)
	if err != nil {
		return fmt.Errorf("insert staff audit log: %w", err)
	}
	return nil
}
