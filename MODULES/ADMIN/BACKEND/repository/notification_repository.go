package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/models"
)

// ListNotifications returns broadcast notifications for a college.
func (r *Repository) ListNotifications(ctx context.Context, collegeID uuid.UUID) ([]models.Notification, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, college_id, title, message, priority, target_audience, created_at
		FROM app.notifications
		WHERE college_id = $1
		ORDER BY created_at DESC
	`

	rows, err := db.Query(ctx, query, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notifications []models.Notification
	for rows.Next() {
		var n models.Notification
		if err := rows.Scan(
			&n.ID, &n.CollegeID, &n.Title, &n.Message,
			&n.Priority, &n.TargetAudience, &n.CreatedAt,
		); err != nil {
			return nil, err
		}
		notifications = append(notifications, n)
	}
	return notifications, nil
}

