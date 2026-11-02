package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/models"
)

// ListBedAllocations returns all bed allocations for a college.
func (r *Repository) ListBedAllocations(ctx context.Context, collegeID uuid.UUID) ([]models.BedAllocation, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, college_id, student_id, bed_id, academic_year, from_date, to_date,
		       status, allocated_by, remarks, created_at, updated_at
		FROM app.bed_allocations
		WHERE college_id = $1
		ORDER BY created_at DESC
	`

	rows, err := db.Query(ctx, query, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var allocations []models.BedAllocation
	for rows.Next() {
		var a models.BedAllocation
		if err := rows.Scan(
			&a.ID, &a.CollegeID, &a.StudentID, &a.BedID, &a.AcademicYear,
			&a.FromDate, &a.ToDate, &a.Status, &a.AllocatedBy,
			&a.Remarks, &a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, err
		}
		allocations = append(allocations, a)
	}
	return allocations, nil
}

// GetCurrentAllocation returns active allocation for a student.
func (r *Repository) GetCurrentAllocation(ctx context.Context, collegeID, studentID uuid.UUID) (*models.BedAllocation, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, college_id, student_id, bed_id, academic_year, from_date, to_date,
		       status, allocated_by, remarks, created_at, updated_at
		FROM app.bed_allocations
		WHERE college_id = $1 AND student_id = $2 AND status = 'ACTIVE'
		LIMIT 1
	`

	var a models.BedAllocation
	err = db.QueryRow(ctx, query, collegeID, studentID).Scan(
		&a.ID, &a.CollegeID, &a.StudentID, &a.BedID, &a.AcademicYear,
		&a.FromDate, &a.ToDate, &a.Status, &a.AllocatedBy,
		&a.Remarks, &a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}
