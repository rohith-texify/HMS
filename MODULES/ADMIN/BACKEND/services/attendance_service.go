package services

import (
	"context"
	"time"

	"github.com/google/uuid"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/models"
)

// ListStudentAttendance returns daily roll-call attendance records.
func (s *AttendanceService) ListStudentAttendance(
	ctx context.Context,
	collegeID uuid.UUID,
	date time.Time,
) ([]models.StudentAttendance, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Attendance service is not initialized")
	}
	if date.IsZero() {
		date = time.Now().UTC()
	}
	return s.repo.ListStudentAttendance(ctx, collegeID, date)
}

// GetAttendanceSummary returns counts of present, absent, on-leave, and late students.
func (s *AttendanceService) GetAttendanceSummary(
	ctx context.Context,
	collegeID uuid.UUID,
	date time.Time,
) (*models.AttendanceSummary, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Attendance service is not initialized")
	}
	if date.IsZero() {
		date = time.Now().UTC()
	}
	return s.repo.GetAttendanceSummary(ctx, collegeID, date)
}

