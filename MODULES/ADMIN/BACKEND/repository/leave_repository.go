package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/models"
)

// ListLeaveRequests returns all leave requests for a college.
func (r *Repository) ListLeaveRequests(ctx context.Context, collegeID uuid.UUID) ([]models.LeaveRequest, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, college_id, student_id, leave_type, start_date, end_date,
		       reason, status, approved_by, decision_note, created_at, updated_at
		FROM app.leave_requests
		WHERE college_id = $1
		ORDER BY created_at DESC
	`

	rows, err := db.Query(ctx, query, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var leaves []models.LeaveRequest
	for rows.Next() {
		var l models.LeaveRequest
		if err := rows.Scan(
			&l.ID, &l.CollegeID, &l.StudentID, &l.LeaveType,
			&l.StartDate, &l.EndDate, &l.Reason, &l.Status,
			&l.ApprovedBy, &l.DecisionNote, &l.CreatedAt, &l.UpdatedAt,
		); err != nil {
			return nil, err
		}
		leaves = append(leaves, l)
	}
	return leaves, nil
}

// GetLeaveSummary returns counts of leave requests by status.
func (r *Repository) GetLeaveSummary(ctx context.Context, collegeID uuid.UUID) (*models.LeaveSummary, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT
			COUNT(*) as total,
			COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending,
			COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved,
			COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected,
			COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled
		FROM app.leave_requests
		WHERE college_id = $1
	`

	var s models.LeaveSummary
	err = db.QueryRow(ctx, query, collegeID).Scan(
		&s.Total, &s.Pending, &s.Approved, &s.Rejected, &s.Cancelled,
	)
	if err != nil {
		return &models.LeaveSummary{}, nil
	}
	return &s, nil
}
