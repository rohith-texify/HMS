package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/models"
)

// ListComplaints returns maintenance service desk complaints for a college.
func (r *Repository) ListComplaints(ctx context.Context, collegeID uuid.UUID) ([]models.Complaint, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, college_id, student_id, category, title, description, priority, status, assigned_to, created_at, updated_at
		FROM app.complaints
		WHERE college_id = $1
		ORDER BY created_at DESC
	`

	rows, err := db.Query(ctx, query, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var complaints []models.Complaint
	for rows.Next() {
		var c models.Complaint
		if err := rows.Scan(
			&c.ID, &c.CollegeID, &c.StudentID, &c.Category,
			&c.Title, &c.Description, &c.Priority, &c.Status,
			&c.AssignedTo, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		complaints = append(complaints, c)
	}
	return complaints, nil
}

// GetComplaintSummary returns ticket counts by status.
func (r *Repository) GetComplaintSummary(ctx context.Context, collegeID uuid.UUID) (*models.ComplaintSummary, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT
			COUNT(*) as total,
			COUNT(CASE WHEN status = 'OPEN' THEN 1 END) as open,
			COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress,
			COUNT(CASE WHEN status = 'RESOLVED' THEN 1 END) as resolved,
			COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) as closed
		FROM app.complaints
		WHERE college_id = $1
	`

	var s models.ComplaintSummary
	err = db.QueryRow(ctx, query, collegeID).Scan(
		&s.Total, &s.Open, &s.InProgress, &s.Resolved, &s.Closed,
	)
	if err != nil {
		return &models.ComplaintSummary{}, nil
	}
	return &s, nil
}
