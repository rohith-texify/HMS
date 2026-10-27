package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type LeaveType string

const (
	LeaveTypeDayLeave  LeaveType = "DAY_LEAVE"
	LeaveTypeOvernight LeaveType = "OVERNIGHT"
	LeaveTypeWeekend   LeaveType = "WEEKEND"
	LeaveTypeEmergency LeaveType = "EMERGENCY"
	LeaveTypeMedical   LeaveType = "MEDICAL"
	LeaveTypeOther     LeaveType = "OTHER"
)

type LeaveStatus string

const (
	LeaveStatusDraft     LeaveStatus = "DRAFT"
	LeaveStatusPending   LeaveStatus = "PENDING"
	LeaveStatusApproved  LeaveStatus = "APPROVED"
	LeaveStatusRejected  LeaveStatus = "REJECTED"
	LeaveStatusCancelled LeaveStatus = "CANCELLED"
	LeaveStatusCompleted LeaveStatus = "COMPLETED"
	LeaveStatusExpired   LeaveStatus = "EXPIRED"
)

type LeaveRequest struct {
	ID           uuid.UUID   `json:"id"`
	CollegeID    uuid.UUID   `json:"college_id"`
	StudentID    uuid.UUID   `json:"student_id"`
	LeaveType    LeaveType   `json:"leave_type"`
	Reason       string      `json:"reason"`
	FromDate     time.Time   `json:"from_date"`
	ToDate       time.Time   `json:"to_date"`
	FromTime     *time.Time  `json:"from_time,omitempty"` // time fields mapped as time.Time (only time part matters)
	ToTime       *time.Time  `json:"to_time,omitempty"`
	Destination  *string     `json:"destination,omitempty"`
	ContactPhone *string     `json:"contact_phone,omitempty"`
	Status       LeaveStatus `json:"status"`
	RequestedAt  time.Time   `json:"requested_at"`
	ApprovedAt   *time.Time  `json:"approved_at,omitempty"`
	RejectedAt   *time.Time  `json:"rejected_at,omitempty"`
	CancelledAt  *time.Time  `json:"cancelled_at,omitempty"`
	CompletedAt  *time.Time  `json:"completed_at,omitempty"`
	CreatedBy    uuid.UUID   `json:"created_by"`
	UpdatedBy    *uuid.UUID  `json:"updated_by,omitempty"`
	CreatedAt    time.Time   `json:"created_at"`
	UpdatedAt    time.Time   `json:"updated_at"`
}

type LeaveApprovalDecision string

const (
	ApprovalDecisionPending   LeaveApprovalDecision = "PENDING"
	ApprovalDecisionApproved  LeaveApprovalDecision = "APPROVED"
	ApprovalDecisionRejected  LeaveApprovalDecision = "REJECTED"
	ApprovalDecisionCancelled LeaveApprovalDecision = "CANCELLED"
)

type LeaveApproval struct {
	ID             uuid.UUID             `json:"id"`
	CollegeID      uuid.UUID             `json:"college_id"`
	LeaveRequestID uuid.UUID             `json:"leave_request_id"`
	ApprovalLevel  int                   `json:"approval_level"`
	ApproverUserID uuid.UUID             `json:"approver_user_id"`
	Decision       LeaveApprovalDecision `json:"decision"`
	Remarks        *string               `json:"remarks,omitempty"`
	DecidedAt      *time.Time            `json:"decided_at,omitempty"`
	CreatedAt      time.Time             `json:"created_at"`
	UpdatedAt      time.Time             `json:"updated_at"`
}

var ErrLeaveNotFound = ErrNotFound

type ListLeaveParams struct {
	CollegeID uuid.UUID
	StudentID *uuid.UUID
	Status    *LeaveStatus
	StartDate *time.Time
	EndDate   *time.Time
}

type LeaveSummary struct {
	Total     int `json:"total"`
	Pending   int `json:"pending"`
	Approved  int `json:"approved"`
	Rejected  int `json:"rejected"`
	Cancelled int `json:"cancelled"`
}

// CreateLeaveRequest inserts a new leave request
func (r *Repository) CreateLeaveRequest(ctx context.Context, req *LeaveRequest) error {
	query := `
		INSERT INTO app.leave_requests (
			college_id, student_id, leave_type, reason,
			from_date, to_date, from_time, to_time,
			destination, contact_phone, status, requested_at,
			created_by, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4,
			$5, $6, $7, $8,
			$9, $10, $11, now(),
			$12, now(), now()
		) RETURNING id, requested_at, created_at, updated_at
	`
	err := r.Executor(ctx).QueryRow(ctx, query,
		req.CollegeID, req.StudentID, req.LeaveType, req.Reason,
		req.FromDate, req.ToDate, req.FromTime, req.ToTime,
		req.Destination, req.ContactPhone, req.Status,
		req.CreatedBy,
	).Scan(&req.ID, &req.RequestedAt, &req.CreatedAt, &req.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create leave request: %w", err)
	}
	return nil
}

// GetLeaveRequest retrieves a single leave request
func (r *Repository) GetLeaveRequest(ctx context.Context, collegeID uuid.UUID, id uuid.UUID) (*LeaveRequest, error) {
	query := `
		SELECT id, college_id, student_id, leave_type, reason,
			from_date, to_date, from_time, to_time,
			destination, contact_phone, status, requested_at,
			approved_at, rejected_at, cancelled_at, completed_at,
			created_by, updated_by, created_at, updated_at
		FROM app.leave_requests
		WHERE college_id = $1 AND id = $2
	`
	var req LeaveRequest
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID, id).Scan(
		&req.ID, &req.CollegeID, &req.StudentID, &req.LeaveType, &req.Reason,
		&req.FromDate, &req.ToDate, &req.FromTime, &req.ToTime,
		&req.Destination, &req.ContactPhone, &req.Status, &req.RequestedAt,
		&req.ApprovedAt, &req.RejectedAt, &req.CancelledAt, &req.CompletedAt,
		&req.CreatedBy, &req.UpdatedBy, &req.CreatedAt, &req.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrLeaveNotFound
		}
		return nil, err
	}
	return &req, nil
}

// UpdateLeaveRequestStatus updates status and relevant timestamp
func (r *Repository) UpdateLeaveRequestStatus(ctx context.Context, id, collegeID, updatedBy uuid.UUID, status LeaveStatus) error {
	now := time.Now().UTC()
	query := `
		UPDATE app.leave_requests
		SET status = $1, updated_by = $2, updated_at = $3
	`

	switch status {
	case LeaveStatusApproved:
		query += `, approved_at = $3`
	case LeaveStatusRejected:
		query += `, rejected_at = $3`
	case LeaveStatusCancelled:
		query += `, cancelled_at = $3`
	case LeaveStatusCompleted:
		query += `, completed_at = $3`
	}

	query += ` WHERE id = $4 AND college_id = $5`

	res, err := r.Executor(ctx).Exec(ctx, query, status, updatedBy, now, id, collegeID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrLeaveNotFound
	}
	return nil
}

// ListLeaveRequests retrieves multiple requests with filtering
func (r *Repository) ListLeaveRequests(ctx context.Context, p ListLeaveParams) ([]LeaveRequest, error) {
	query := `
		SELECT id, college_id, student_id, leave_type, reason,
			from_date, to_date, from_time, to_time,
			destination, contact_phone, status, requested_at,
			approved_at, rejected_at, cancelled_at, completed_at,
			created_by, updated_by, created_at, updated_at
		FROM app.leave_requests
		WHERE college_id = $1
	`
	args := []interface{}{p.CollegeID}
	argIdx := 2

	if p.StudentID != nil {
		query += fmt.Sprintf(" AND student_id = $%d", argIdx)
		args = append(args, *p.StudentID)
		argIdx++
	}

	if p.Status != nil {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *p.Status)
		argIdx++
	}

	if p.StartDate != nil {
		query += fmt.Sprintf(" AND from_date >= $%d", argIdx)
		args = append(args, *p.StartDate)
		argIdx++
	}

	if p.EndDate != nil {
		query += fmt.Sprintf(" AND to_date <= $%d", argIdx)
		args = append(args, *p.EndDate)
		argIdx++
	}

	query += " ORDER BY requested_at DESC"

	rows, err := r.Executor(ctx).Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reqs []LeaveRequest
	for rows.Next() {
		var req LeaveRequest
		err := rows.Scan(
			&req.ID, &req.CollegeID, &req.StudentID, &req.LeaveType, &req.Reason,
			&req.FromDate, &req.ToDate, &req.FromTime, &req.ToTime,
			&req.Destination, &req.ContactPhone, &req.Status, &req.RequestedAt,
			&req.ApprovedAt, &req.RejectedAt, &req.CancelledAt, &req.CompletedAt,
			&req.CreatedBy, &req.UpdatedBy, &req.CreatedAt, &req.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		reqs = append(reqs, req)
	}

	return reqs, nil
}

// CreateLeaveApproval creates a leave approval log
func (r *Repository) CreateLeaveApproval(ctx context.Context, app *LeaveApproval) error {
	query := `
		INSERT INTO app.leave_approvals (
			college_id, leave_request_id, approval_level, approver_user_id,
			decision, remarks, decided_at, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4,
			$5, $6, $7, now(), now()
		) RETURNING id, created_at, updated_at
	`
	err := r.Executor(ctx).QueryRow(ctx, query,
		app.CollegeID, app.LeaveRequestID, app.ApprovalLevel, app.ApproverUserID,
		app.Decision, app.Remarks, app.DecidedAt,
	).Scan(&app.ID, &app.CreatedAt, &app.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create leave approval: %w", err)
	}
	return nil
}

// GetLeaveSummary returns high level counts
func (r *Repository) GetLeaveSummary(ctx context.Context, collegeID uuid.UUID) (*LeaveSummary, error) {
	query := `
		SELECT 
			COUNT(*) as total,
			COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
			COUNT(*) FILTER (WHERE status = 'APPROVED') as approved,
			COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected,
			COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled
		FROM app.leave_requests
		WHERE college_id = $1
	`
	var summary LeaveSummary
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID).Scan(
		&summary.Total, &summary.Pending, &summary.Approved, &summary.Rejected, &summary.Cancelled,
	)
	if err != nil {
		return nil, err
	}
	return &summary, nil
}
