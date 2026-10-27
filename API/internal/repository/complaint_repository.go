package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type ComplaintCategory string
type ComplaintPriority string
type ComplaintStatus string
type ComplaintUpdateType string

const (
	ComplaintCategoryHostel      ComplaintCategory = "HOSTEL"
	ComplaintCategoryRoom        ComplaintCategory = "ROOM"
	ComplaintCategoryFood        ComplaintCategory = "FOOD"
	ComplaintCategoryMaintenance ComplaintCategory = "MAINTENANCE"
	// other categories omitted for brevity in consts but allowed in db

	ComplaintPriorityLow    ComplaintPriority = "LOW"
	ComplaintPriorityNormal ComplaintPriority = "NORMAL"
	ComplaintPriorityHigh   ComplaintPriority = "HIGH"
	ComplaintPriorityUrgent ComplaintPriority = "URGENT"

	ComplaintStatusDraft      ComplaintStatus = "DRAFT"
	ComplaintStatusOpen       ComplaintStatus = "OPEN"
	ComplaintStatusAssigned   ComplaintStatus = "ASSIGNED"
	ComplaintStatusInProgress ComplaintStatus = "IN_PROGRESS"
	ComplaintStatusResolved   ComplaintStatus = "RESOLVED"
	ComplaintStatusClosed     ComplaintStatus = "CLOSED"
	ComplaintStatusCancelled  ComplaintStatus = "CANCELLED"
	ComplaintStatusRejected   ComplaintStatus = "REJECTED"
	ComplaintStatusReopened   ComplaintStatus = "REOPENED"

	ComplaintUpdateStatusChange ComplaintUpdateType = "STATUS_CHANGE"
	ComplaintUpdateAssignment   ComplaintUpdateType = "ASSIGNMENT"
	ComplaintUpdateResolution   ComplaintUpdateType = "RESOLUTION"
	ComplaintUpdateComment      ComplaintUpdateType = "COMMENT"
	ComplaintUpdateSystem       ComplaintUpdateType = "SYSTEM"
)

type Complaint struct {
	ID              uuid.UUID         `json:"id"`
	CollegeID       uuid.UUID         `json:"college_id"`
	StudentID       *uuid.UUID        `json:"student_id,omitempty"`
	ComplaintNumber string            `json:"complaint_number"`
	Category        ComplaintCategory `json:"category"`
	Title           string            `json:"title"`
	Description     string            `json:"description"`
	Priority        ComplaintPriority `json:"priority"`
	Status          ComplaintStatus   `json:"status"`
	AssignedTo      *uuid.UUID        `json:"assigned_to,omitempty"`
	Resolution      *string           `json:"resolution,omitempty"`
	ResolvedAt      *time.Time        `json:"resolved_at,omitempty"`
	ClosedAt        *time.Time        `json:"closed_at,omitempty"`
	CreatedBy       uuid.UUID         `json:"created_by"`
	UpdatedBy       *uuid.UUID        `json:"updated_by,omitempty"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
}

type ComplaintUpdate struct {
	ID             uuid.UUID           `json:"id"`
	CollegeID      uuid.UUID           `json:"college_id"`
	ComplaintID    uuid.UUID           `json:"complaint_id"`
	UpdateType     ComplaintUpdateType `json:"update_type"`
	PreviousStatus *ComplaintStatus    `json:"previous_status,omitempty"`
	NewStatus      *ComplaintStatus    `json:"new_status,omitempty"`
	Message        string              `json:"message"`
	UpdatedBy      *uuid.UUID          `json:"updated_by,omitempty"`
	CreatedAt      time.Time           `json:"created_at"`
}

type OpenComplaintSummary struct {
	CollegeID      uuid.UUID `json:"college_id"`
	Category       string    `json:"category"`
	Priority       string    `json:"priority"`
	Status         string    `json:"status"`
	ComplaintCount int64     `json:"complaint_count"`
}

var ErrComplaintNotFound = ErrNotFound

// Generate a complaint number
func generateComplaintNumber() string {
	return fmt.Sprintf("CMP-%d", time.Now().UnixMilli())
}

func (r *Repository) CreateComplaint(ctx context.Context, c *Complaint) error {
	c.ComplaintNumber = generateComplaintNumber()
	query := `
		INSERT INTO app.complaints (college_id, student_id, complaint_number, category, title, description, priority, status, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
		RETURNING id, created_at, updated_at
	`
	err := r.Executor(ctx).QueryRow(ctx, query,
		c.CollegeID, c.StudentID, c.ComplaintNumber, c.Category, c.Title, c.Description, c.Priority, c.Status, c.CreatedBy,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create complaint: %w", err)
	}
	return nil
}

func (r *Repository) GetComplaint(ctx context.Context, collegeID, id uuid.UUID) (*Complaint, error) {
	query := `
		SELECT id, college_id, student_id, complaint_number, category, title, description, priority, status, assigned_to, resolution, resolved_at, closed_at, created_by, updated_by, created_at, updated_at
		FROM app.complaints
		WHERE college_id = $1 AND id = $2
	`
	var c Complaint
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID, id).Scan(
		&c.ID, &c.CollegeID, &c.StudentID, &c.ComplaintNumber, &c.Category, &c.Title, &c.Description, &c.Priority, &c.Status, &c.AssignedTo, &c.Resolution, &c.ResolvedAt, &c.ClosedAt, &c.CreatedBy, &c.UpdatedBy, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrComplaintNotFound
		}
		return nil, err
	}
	return &c, nil
}

func (r *Repository) ListComplaints(ctx context.Context, collegeID uuid.UUID) ([]Complaint, error) {
	query := `
		SELECT id, college_id, student_id, complaint_number, category, title, description, priority, status, assigned_to, resolution, resolved_at, closed_at, created_by, updated_by, created_at, updated_at
		FROM app.complaints
		WHERE college_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.Executor(ctx).Query(ctx, query, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var comps []Complaint
	for rows.Next() {
		var c Complaint
		if err := rows.Scan(&c.ID, &c.CollegeID, &c.StudentID, &c.ComplaintNumber, &c.Category, &c.Title, &c.Description, &c.Priority, &c.Status, &c.AssignedTo, &c.Resolution, &c.ResolvedAt, &c.ClosedAt, &c.CreatedBy, &c.UpdatedBy, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		comps = append(comps, c)
	}
	return comps, nil
}

func (r *Repository) UpdateComplaintState(ctx context.Context, c *Complaint) error {
	query := `
		UPDATE app.complaints
		SET status = $1, assigned_to = $2, resolution = $3, resolved_at = $4, updated_by = $5, updated_at = now()
		WHERE college_id = $6 AND id = $7
	`
	_, err := r.Executor(ctx).Exec(ctx, query, c.Status, c.AssignedTo, c.Resolution, c.ResolvedAt, c.UpdatedBy, c.CollegeID, c.ID)
	return err
}

func (r *Repository) AddComplaintUpdate(ctx context.Context, u *ComplaintUpdate) error {
	query := `
		INSERT INTO app.complaint_updates (college_id, complaint_id, update_type, previous_status, new_status, message, updated_by, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, now())
		RETURNING id, created_at
	`
	err := r.Executor(ctx).QueryRow(ctx, query,
		u.CollegeID, u.ComplaintID, u.UpdateType, u.PreviousStatus, u.NewStatus, u.Message, u.UpdatedBy,
	).Scan(&u.ID, &u.CreatedAt)
	return err
}

func (r *Repository) ListComplaintUpdates(ctx context.Context, collegeID, complaintID uuid.UUID) ([]ComplaintUpdate, error) {
	query := `
		SELECT id, college_id, complaint_id, update_type, previous_status, new_status, message, updated_by, created_at
		FROM app.complaint_updates
		WHERE college_id = $1 AND complaint_id = $2
		ORDER BY created_at DESC
	`
	rows, err := r.Executor(ctx).Query(ctx, query, collegeID, complaintID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var updates []ComplaintUpdate
	for rows.Next() {
		var u ComplaintUpdate
		if err := rows.Scan(&u.ID, &u.CollegeID, &u.ComplaintID, &u.UpdateType, &u.PreviousStatus, &u.NewStatus, &u.Message, &u.UpdatedBy, &u.CreatedAt); err != nil {
			return nil, err
		}
		updates = append(updates, u)
	}
	return updates, nil
}

func (r *Repository) GetComplaintSummary(ctx context.Context, collegeID uuid.UUID) ([]OpenComplaintSummary, error) {
	query := `
		SELECT college_id, category, priority, status, complaint_count
		FROM app.v_open_complaint_summary
		WHERE college_id = $1
	`
	rows, err := r.Executor(ctx).Query(ctx, query, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []OpenComplaintSummary
	for rows.Next() {
		var o OpenComplaintSummary
		if err := rows.Scan(&o.CollegeID, &o.Category, &o.Priority, &o.Status, &o.ComplaintCount); err != nil {
			return nil, err
		}
		list = append(list, o)
	}
	return list, nil
}
