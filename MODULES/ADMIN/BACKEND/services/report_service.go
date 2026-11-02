package services

import (
	"context"

	"github.com/google/uuid"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/models"
)

// GetDashboardSummary aggregates high level metrics for the College Admin dashboard.
func (s *ReportService) GetDashboardSummary(ctx context.Context, collegeID uuid.UUID) (map[string]interface{}, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Report service is not initialized")
	}

	db, err := s.repo.GetDB(ctx)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, "Database context failure")
	}

	var totalStudents int
	_ = db.QueryRow(ctx, "SELECT COUNT(*) FROM app.students WHERE college_id = $1", collegeID).Scan(&totalStudents)

	var totalHostels int
	_ = db.QueryRow(ctx, "SELECT COUNT(*) FROM app.hostels WHERE college_id = $1", collegeID).Scan(&totalHostels)

	var activeAllocations int
	_ = db.QueryRow(ctx, "SELECT COUNT(*) FROM app.student_bed_allocations WHERE college_id = $1 AND status = 'ACTIVE'", collegeID).Scan(&activeAllocations)

	var openComplaints int
	_ = db.QueryRow(ctx, "SELECT COUNT(*) FROM app.complaints WHERE college_id = $1 AND status IN ('PENDING', 'IN_PROGRESS', 'OPEN')", collegeID).Scan(&openComplaints)

	return map[string]interface{}{
		"total_students":     totalStudents,
		"total_hostels":      totalHostels,
		"active_allocations": activeAllocations,
		"open_complaints":    openComplaints,
	}, nil
}

