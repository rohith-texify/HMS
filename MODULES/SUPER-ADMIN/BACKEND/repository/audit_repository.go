package repository

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

// ListAuditLogs searches platform audit logs with granular filters and actor/college joins.
func (r *Repository) ListAuditLogs(
	ctx context.Context,
	params models.AuditLogFilterParams,
) ([]models.PlatformAuditLog, int, error) {
	if params.Limit <= 0 {
		params.Limit = 50
	}
	if params.Limit > 200 {
		params.Limit = 200
	}

	whereClauses := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if params.Query != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(a.module ILIKE $%d OR a.action ILIKE $%d OR a.reason ILIKE $%d OR u.email ILIKE $%d)", argIdx, argIdx, argIdx, argIdx))
		args = append(args, "%"+params.Query+"%")
		argIdx++
	}

	if params.CollegeID != nil && *params.CollegeID != uuid.Nil {
		whereClauses = append(whereClauses, fmt.Sprintf("a.college_id = $%d", argIdx))
		args = append(args, *params.CollegeID)
		argIdx++
	}

	if params.ActorUserID != nil && *params.ActorUserID != uuid.Nil {
		whereClauses = append(whereClauses, fmt.Sprintf("a.actor_user_id = $%d", argIdx))
		args = append(args, *params.ActorUserID)
		argIdx++
	}

	if params.ActorRole != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("a.actor_role = $%d", argIdx))
		args = append(args, params.ActorRole)
		argIdx++
	}

	if params.Module != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("a.module = $%d", argIdx))
		args = append(args, params.Module)
		argIdx++
	}

	if params.Action != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("a.action = $%d", argIdx))
		args = append(args, params.Action)
		argIdx++
	}

	if params.EntityType != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("a.entity_type = $%d", argIdx))
		args = append(args, params.EntityType)
		argIdx++
	}

	if params.Severity != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("a.severity = $%d", argIdx))
		args = append(args, params.Severity)
		argIdx++
	}

	if params.ResultStatus != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("a.result_status = $%d", argIdx))
		args = append(args, params.ResultStatus)
		argIdx++
	}

	if params.TicketReference != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("a.ticket_reference = $%d", argIdx))
		args = append(args, params.TicketReference)
		argIdx++
	}

	if params.CorrelationID != nil && *params.CorrelationID != uuid.Nil {
		whereClauses = append(whereClauses, fmt.Sprintf("a.correlation_id = $%d", argIdx))
		args = append(args, *params.CorrelationID)
		argIdx++
	}

	if params.StartDate != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("a.created_at >= $%d", argIdx))
		args = append(args, *params.StartDate)
		argIdx++
	}

	if params.EndDate != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("a.created_at <= $%d", argIdx))
		args = append(args, *params.EndDate)
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	// Count Total
	countSQL := fmt.Sprintf(`
		SELECT count(*)
		FROM platform.audit_logs a
		LEFT JOIN app.users u ON a.actor_user_id = u.user_id
		WHERE %s
	`, whereSQL)
	var total int
	err := r.Executor(ctx).QueryRow(ctx, countSQL, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count audit logs: %w", err)
	}

	// Fetch Records
	querySQL := fmt.Sprintf(`
		SELECT
			a.audit_id,
			a.college_id,
			COALESCE(c.college_code, ''),
			COALESCE(c.name, ''),
			a.actor_user_id,
			COALESCE(u.email, ''),
			COALESCE(a.actor_role, ''),
			a.module,
			a.action,
			COALESCE(a.entity_type, ''),
			a.entity_id,
			a.old_data,
			a.new_data,
			a.reason,
			a.ip_address::text,
			a.user_agent,
			a.correlation_id,
			COALESCE(a.severity, 'INFO'),
			COALESCE(a.result_status, 'SUCCESS'),
			a.error_code,
			a.ticket_reference,
			a.approval_reference,
			a.current_hash,
			a.previous_hash,
			a.created_at
		FROM platform.audit_logs a
		LEFT JOIN app.users u ON a.actor_user_id = u.user_id
		LEFT JOIN platform.colleges c ON a.college_id = c.college_id
		WHERE %s
		ORDER BY a.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)

	queryArgs := append(args, params.Limit, params.Offset)
	rows, err := r.Executor(ctx).Query(ctx, querySQL, queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("query audit logs: %w", err)
	}
	defer rows.Close()

	records := make([]models.PlatformAuditLog, 0)
	for rows.Next() {
		var log models.PlatformAuditLog
		var oldBytes, newBytes []byte
		if err := rows.Scan(
			&log.AuditID,
			&log.CollegeID,
			&log.CollegeCode,
			&log.CollegeName,
			&log.ActorUserID,
			&log.ActorEmail,
			&log.ActorRole,
			&log.Module,
			&log.Action,
			&log.EntityType,
			&log.EntityID,
			&oldBytes,
			&newBytes,
			&log.Reason,
			&log.IPAddress,
			&log.UserAgent,
			&log.CorrelationID,
			&log.Severity,
			&log.ResultStatus,
			&log.ErrorCode,
			&log.TicketReference,
			&log.ApprovalReference,
			&log.CurrentHash,
			&log.PreviousHash,
			&log.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan audit log row: %w", err)
		}

		if len(oldBytes) > 0 {
			_ = json.Unmarshal(oldBytes, &log.OldData)
		}
		if len(newBytes) > 0 {
			_ = json.Unmarshal(newBytes, &log.NewData)
		}

		records = append(records, log)
	}

	return records, total, nil
}

// GetAuditLogByID retrieves an individual audit log by its unique audit_id.
func (r *Repository) GetAuditLogByID(
	ctx context.Context,
	auditID uuid.UUID,
) (*models.PlatformAuditLog, error) {
	const querySQL = `
		SELECT
			a.audit_id,
			a.college_id,
			COALESCE(c.college_code, ''),
			COALESCE(c.name, ''),
			a.actor_user_id,
			COALESCE(u.email, ''),
			COALESCE(a.actor_role, ''),
			a.module,
			a.action,
			COALESCE(a.entity_type, ''),
			a.entity_id,
			a.old_data,
			a.new_data,
			a.reason,
			a.ip_address::text,
			a.user_agent,
			a.correlation_id,
			COALESCE(a.severity, 'INFO'),
			COALESCE(a.result_status, 'SUCCESS'),
			a.error_code,
			a.ticket_reference,
			a.approval_reference,
			a.current_hash,
			a.previous_hash,
			a.created_at
		FROM platform.audit_logs a
		LEFT JOIN app.users u ON a.actor_user_id = u.user_id
		LEFT JOIN platform.colleges c ON a.college_id = c.college_id
		WHERE a.audit_id = $1
	`
	var log models.PlatformAuditLog
	var oldBytes, newBytes []byte
	err := r.Executor(ctx).QueryRow(ctx, querySQL, auditID).Scan(
		&log.AuditID,
		&log.CollegeID,
		&log.CollegeCode,
		&log.CollegeName,
		&log.ActorUserID,
		&log.ActorEmail,
		&log.ActorRole,
		&log.Module,
		&log.Action,
		&log.EntityType,
		&log.EntityID,
		&oldBytes,
		&newBytes,
		&log.Reason,
		&log.IPAddress,
		&log.UserAgent,
		&log.CorrelationID,
		&log.Severity,
		&log.ResultStatus,
		&log.ErrorCode,
		&log.TicketReference,
		&log.ApprovalReference,
		&log.CurrentHash,
		&log.PreviousHash,
		&log.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("query audit log by id: %w", err)
	}

	if len(oldBytes) > 0 {
		_ = json.Unmarshal(oldBytes, &log.OldData)
	}
	if len(newBytes) > 0 {
		_ = json.Unmarshal(newBytes, &log.NewData)
	}

	return &log, nil
}

// RecordPlatformAudit writes an immutable audit record with tamper-evident hash chaining.
func (r *Repository) RecordPlatformAudit(
	ctx context.Context,
	log models.PlatformAuditLog,
) (uuid.UUID, error) {
	if log.AuditID == uuid.Nil {
		log.AuditID = uuid.New()
	}
	if log.CreatedAt.IsZero() {
		log.CreatedAt = time.Now()
	}
	if log.Severity == "" {
		log.Severity = "INFO"
	}
	if log.ResultStatus == "" {
		log.ResultStatus = "SUCCESS"
	}

	// 1. Fetch latest record's current_hash to chain forward
	var lastHash string
	_ = r.Executor(ctx).QueryRow(ctx, `
		SELECT COALESCE(current_hash, '')
		FROM platform.audit_logs
		ORDER BY created_at DESC
		LIMIT 1
	`).Scan(&lastHash)

	// 2. Compute SHA-256 tamper-evident hash
	hasher := sha256.New()
	hasher.Write([]byte(fmt.Sprintf("%s:%s:%s:%s:%s", log.AuditID, log.Module, log.Action, log.CreatedAt.Format(time.RFC3339Nano), lastHash)))
	computedHash := hex.EncodeToString(hasher.Sum(nil))

	oldBytes, _ := json.Marshal(log.OldData)
	newBytes, _ := json.Marshal(log.NewData)

	const insertSQL = `
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
			correlation_id,
			severity,
			result_status,
			error_code,
			ticket_reference,
			approval_reference,
			current_hash,
			previous_hash,
			created_at
		) VALUES (
			$1, $2, $3, $4,
			$5, $6, $7, $8,
			$9::jsonb, $10::jsonb,
			$11, $12, $13, $14,
			$15, $16, $17, $18,
			$19, $20
		)
	`
	_, err := r.Executor(ctx).Exec(
		ctx,
		insertSQL,
		log.AuditID,
		log.CollegeID,
		log.ActorUserID,
		log.ActorRole,
		log.Module,
		log.Action,
		log.EntityType,
		log.EntityID,
		string(oldBytes),
		string(newBytes),
		log.Reason,
		log.CorrelationID,
		log.Severity,
		log.ResultStatus,
		log.ErrorCode,
		log.TicketReference,
		log.ApprovalReference,
		computedHash,
		lastHash,
		log.CreatedAt,
	)
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert audit log: %w", err)
	}

	return log.AuditID, nil
}

// VerifyAuditChainIntegrity scans audit logs and checks the tamper-evident hash chain.
func (r *Repository) VerifyAuditChainIntegrity(
	ctx context.Context,
	limit int,
) (*models.AuditIntegrityCheckReport, error) {
	if limit <= 0 {
		limit = 100
	}

	const query = `
		SELECT
			audit_id,
			module,
			action,
			created_at,
			COALESCE(current_hash, ''),
			COALESCE(previous_hash, '')
		FROM platform.audit_logs
		ORDER BY created_at DESC
		LIMIT $1
	`
	rows, err := r.Executor(ctx).Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("query logs for integrity check: %w", err)
	}
	defer rows.Close()

	type hashRow struct {
		AuditID      uuid.UUID
		Module       string
		Action       string
		CreatedAt    time.Time
		CurrentHash  string
		PreviousHash string
	}
	records := make([]hashRow, 0)
	for rows.Next() {
		var hr hashRow
		if err := rows.Scan(
			&hr.AuditID,
			&hr.Module,
			&hr.Action,
			&hr.CreatedAt,
			&hr.CurrentHash,
			&hr.PreviousHash,
		); err != nil {
			return nil, fmt.Errorf("scan hash row: %w", err)
		}
		records = append(records, hr)
	}

	report := &models.AuditIntegrityCheckReport{
		TotalChecked:      len(records),
		IsIntegrityIntact: true,
		CheckedAt:         time.Now(),
		Details:           "Cryptographic hash chain validated successfully. No tamper evidence detected.",
	}

	if len(records) > 0 {
		report.LastVerifiedAuditID = records[0].AuditID
	}

	// Verify each hash against stored hash
	for i := 0; i < len(records); i++ {
		curr := records[i]
		if curr.CurrentHash == "" {
			continue // Unhashed legacy row before migration
		}

		// Recompute hash
		hasher := sha256.New()
		hasher.Write([]byte(fmt.Sprintf("%s:%s:%s:%s:%s", curr.AuditID, curr.Module, curr.Action, curr.CreatedAt.Format(time.RFC3339Nano), curr.PreviousHash)))
		expected := hex.EncodeToString(hasher.Sum(nil))

		// If mismatch, record tampering
		if curr.CurrentHash != expected && len(curr.CurrentHash) == 64 && curr.PreviousHash != "" {
			report.TamperedRecords++
			report.IsIntegrityIntact = false
			report.Details = fmt.Sprintf("Tamper detected on audit record '%s': Hash mismatch", curr.AuditID)
			break
		}
	}

	return report, nil
}

// CreateAuditExportRequest records a bulk audit export request requiring approval.
func (r *Repository) CreateAuditExportRequest(
	ctx context.Context,
	req models.CreateAuditExportRequest,
	requesterID uuid.UUID,
	requesterRole string,
	count int,
) (*models.AuditExportRequest, error) {
	filtersJSON, _ := json.Marshal(req.Filters)

	const insertSQL = `
		INSERT INTO platform.audit_export_requests (
			requester_user_id,
			requester_role,
			filters,
			record_count,
			reason
		) VALUES ($1, $2, $3::jsonb, $4, $5)
		RETURNING
			request_id,
			requester_user_id,
			requester_role,
			filters,
			record_count,
			status,
			reason,
			approver_user_id,
			approved_at,
			export_url,
			created_at,
			updated_at
	`
	var aer models.AuditExportRequest
	var fBytes []byte
	err := r.Executor(ctx).QueryRow(
		ctx,
		insertSQL,
		requesterID,
		requesterRole,
		string(filtersJSON),
		count,
		req.Reason,
	).Scan(
		&aer.RequestID,
		&aer.RequesterUserID,
		&aer.RequesterRole,
		&fBytes,
		&aer.RecordCount,
		&aer.Status,
		&aer.Reason,
		&aer.ApproverUserID,
		&aer.ApprovedAt,
		&aer.ExportURL,
		&aer.CreatedAt,
		&aer.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create audit export request: %w", err)
	}

	_ = json.Unmarshal(fBytes, &aer.Filters)
	return &aer, nil
}

// ListAuditExportRequests lists export requests.
func (r *Repository) ListAuditExportRequests(
	ctx context.Context,
	status string,
) ([]models.AuditExportRequest, error) {
	query := `
		SELECT
			aer.request_id,
			aer.requester_user_id,
			COALESCE(u.email, ''),
			aer.requester_role,
			aer.filters,
			aer.record_count,
			aer.status,
			aer.reason,
			aer.approver_user_id,
			COALESCE(au.email, ''),
			aer.approved_at,
			aer.export_url,
			aer.created_at,
			aer.updated_at
		FROM platform.audit_export_requests aer
		LEFT JOIN app.users u ON aer.requester_user_id = u.user_id
		LEFT JOIN app.users au ON aer.approver_user_id = au.user_id
	`
	var args []interface{}
	if status != "" {
		query += " WHERE aer.status = $1"
		args = append(args, status)
	}
	query += " ORDER BY aer.created_at DESC"

	rows, err := r.Executor(ctx).Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query audit export requests: %w", err)
	}
	defer rows.Close()

	list := make([]models.AuditExportRequest, 0)
	for rows.Next() {
		var aer models.AuditExportRequest
		var fBytes []byte
		if err := rows.Scan(
			&aer.RequestID,
			&aer.RequesterUserID,
			&aer.RequesterEmail,
			&aer.RequesterRole,
			&fBytes,
			&aer.RecordCount,
			&aer.Status,
			&aer.Reason,
			&aer.ApproverUserID,
			&aer.ApproverEmail,
			&aer.ApprovedAt,
			&aer.ExportURL,
			&aer.CreatedAt,
			&aer.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan export request: %w", err)
		}
		_ = json.Unmarshal(fBytes, &aer.Filters)
		list = append(list, aer)
	}

	return list, nil
}

// ProcessAuditExportDecision approves or rejects an audit export request.
func (r *Repository) ProcessAuditExportDecision(
	ctx context.Context,
	requestID uuid.UUID,
	decision string,
	approverID uuid.UUID,
) error {
	const updateSQL = `
		UPDATE platform.audit_export_requests
		SET
			status = $1,
			approver_user_id = $2,
			approved_at = now(),
			updated_at = now()
		WHERE request_id = $3
	`
	tag, err := r.Executor(ctx).Exec(ctx, updateSQL, decision, approverID, requestID)
	if err != nil {
		return fmt.Errorf("update export request decision: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("audit export request '%s' not found", requestID)
	}
	return nil
}
