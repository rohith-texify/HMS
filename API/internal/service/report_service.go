package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

type ReportService struct {
	repo *repository.Repository
}

func NewReportService(repo *repository.Repository) *ReportService {
	return &ReportService{
		repo: repo,
	}
}

func (s *ReportService) GetDashboardOverview(ctx context.Context, collegeID uuid.UUID) (*repository.DashboardOverview, error) {
	return s.repo.GetDashboardOverview(ctx, collegeID)
}

func (s *ReportService) GetStudentStats(ctx context.Context, collegeID uuid.UUID) (*repository.StudentStats, error) {
	return s.repo.GetStudentStats(ctx, collegeID)
}

func (s *ReportService) GetHostelOccupancy(ctx context.Context, collegeID uuid.UUID) ([]repository.HostelOccupancy, error) {
	return s.repo.GetHostelOccupancy(ctx, collegeID)
}

func (s *ReportService) GetAllocationStats(ctx context.Context, collegeID uuid.UUID) (*repository.AllocationStats, error) {
	return s.repo.GetAllocationStats(ctx, collegeID)
}

func (s *ReportService) GetAttendanceStats(ctx context.Context, collegeID uuid.UUID) (*repository.AttendanceStats, error) {
	return s.repo.GetAttendanceStats(ctx, collegeID)
}

func (s *ReportService) GetLeaveStats(ctx context.Context, collegeID uuid.UUID) (*repository.LeaveStats, error) {
	return s.repo.GetLeaveStats(ctx, collegeID)
}

func (s *ReportService) GetComplaintStats(ctx context.Context, collegeID uuid.UUID) (*repository.ComplaintStats, error) {
	return s.repo.GetComplaintStats(ctx, collegeID)
}

func (s *ReportService) GetMaintenanceStats(ctx context.Context, collegeID uuid.UUID) (*repository.MaintenanceStats, error) {
	return s.repo.GetMaintenanceStats(ctx, collegeID)
}

func (s *ReportService) GetStaffStats(ctx context.Context, collegeID uuid.UUID) (*repository.StaffStats, error) {
	return s.repo.GetStaffStats(ctx, collegeID)
}

func (s *ReportService) GetPlatformOverview(ctx context.Context) (*repository.PlatformOverview, error) {
	return s.repo.GetPlatformOverview(ctx)
}

func (s *ReportService) GetRecentPlatformActivity(
	ctx context.Context,
	limit int,
) ([]repository.PlatformActivity, error) {
	return s.repo.GetRecentPlatformActivity(ctx, limit)
}
