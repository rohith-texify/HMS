package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/models"
)

// ListStudentAttendance returns roll-call records for a given date.
func (r *Repository) ListStudentAttendance(ctx context.Context, collegeID uuid.UUID, date time.Time) ([]models.StudentAttendance, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, college_id, student_id, date, status, marked_by, remarks, created_at
		FROM app.student_attendance
		WHERE college_id = $1 AND date::date = $2::date
		ORDER BY created_at ASC
	`

	rows, err := db.Query(ctx, query, collegeID, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []models.StudentAttendance
	for rows.Next() {
		var a models.StudentAttendance
		if err := rows.Scan(
			&a.ID, &a.CollegeID, &a.StudentID, &a.Date,
			&a.Status, &a.MarkedBy, &a.Remarks, &a.CreatedAt,
		); err != nil {
			return nil, err
		}
		records = append(records, a)
	}
	return records, nil
}

// GetAttendanceSummary returns aggregates for roll-call.
func (r *Repository) GetAttendanceSummary(ctx context.Context, collegeID uuid.UUID, date time.Time) (*models.AttendanceSummary, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT
			COUNT(*) as total,
			COUNT(CASE WHEN status = 'PRESENT' THEN 1 END) as present,
			COUNT(CASE WHEN status = 'ABSENT' THEN 1 END) as absent,
			COUNT(CASE WHEN status = 'LATE' THEN 1 END) as late,
			COUNT(CASE WHEN status = 'ON_LEAVE' THEN 1 END) as on_leave,
			COUNT(CASE WHEN status = 'EXCUSED' THEN 1 END) as excused,
			COUNT(CASE WHEN status = 'HOLIDAY' THEN 1 END) as holiday
		FROM app.student_attendance
		WHERE college_id = $1 AND date::date = $2::date
	`

	var s models.AttendanceSummary
	err = db.QueryRow(ctx, query, collegeID, date).Scan(
		&s.Total, &s.Present, &s.Absent, &s.Late, &s.OnLeave, &s.Excused, &s.Holiday,
	)
	if err != nil {
		return &models.AttendanceSummary{}, nil
	}
	return &s, nil
}

