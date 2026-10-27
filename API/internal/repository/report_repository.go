package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type DashboardOverview struct {
	TotalStudents       int `json:"total_students"`
	ActiveStudents      int `json:"active_students"`
	TotalStaff          int `json:"total_staff"`
	TotalHostels        int `json:"total_hostels"`
	TotalBeds           int `json:"total_beds"`
	OccupiedBeds        int `json:"occupied_beds"`
	OpenComplaints      int `json:"open_complaints"`
	OpenMaintenance     int `json:"open_maintenance"`
	UnreadNotifications int `json:"unread_notifications"`
}

type StudentStats struct {
	TotalByStatus       map[string]int `json:"total_by_status"`
	TotalByHostelStatus map[string]int `json:"total_by_hostel_status"`
}

type HostelOccupancy struct {
	HostelID            uuid.UUID `json:"hostel_id"`
	HostelName          string    `json:"hostel_name"`
	TotalCapacity       int       `json:"total_capacity"`
	OccupiedBeds        int       `json:"occupied_beds"`
	AvailableCapacity   int       `json:"available_capacity"`
	OccupancyPercentage float64   `json:"occupancy_percentage"`
}

type AllocationStats struct {
	TotalAllocated int `json:"total_allocated"`
	TotalReleased  int `json:"total_released"`
}

type AttendanceStats struct {
	PresentCount int `json:"present_count"`
	AbsentCount  int `json:"absent_count"`
	LateCount    int `json:"late_count"`
	LeaveCount   int `json:"leave_count"`
}

type LeaveStats struct {
	Pending   int `json:"pending"`
	Approved  int `json:"approved"`
	Rejected  int `json:"rejected"`
	Cancelled int `json:"cancelled"`
}

type ComplaintStats struct {
	Open       int `json:"open"`
	InProgress int `json:"in_progress"`
	Resolved   int `json:"resolved"`
	Closed     int `json:"closed"`
}

type MaintenanceStats struct {
	Open       int `json:"open"`
	InProgress int `json:"in_progress"`
	Resolved   int `json:"resolved"`
	Closed     int `json:"closed"`
}

type StaffStats struct {
	TotalByStatus map[string]int `json:"total_by_status"`
}

type PlatformOverview struct {
	TotalColleges            int `json:"total_colleges"`
	OnboardingColleges       int `json:"onboarding_colleges"`
	ActiveColleges           int `json:"active_colleges"`
	SuspendedColleges        int `json:"suspended_colleges"`
	DeactivatedColleges      int `json:"deactivated_colleges"`
	PendingApprovals         int `json:"pending_approvals"`
	ApprovedApprovals        int `json:"approved_approvals"`
	RejectedApprovals        int `json:"rejected_approvals"`
	TotalUsers               int `json:"total_users"`
	ActiveUsers              int `json:"active_users"`
	TotalModules             int `json:"total_modules"`
	ActiveModules            int `json:"active_modules"`
	CollegeModuleAssignments int `json:"college_module_assignments"`
}

// PlatformActivity contains only safe summary fields for the dashboard.
// Audit payloads, IP addresses, user agents and free-text reasons are excluded.
type PlatformActivity struct {
	AuditID     uuid.UUID `json:"audit_id"`
	CreatedAt   time.Time `json:"created_at"`
	Action      string    `json:"action"`
	Module      string    `json:"module"`
	EntityType  string    `json:"entity_type"`
	EntityID    string    `json:"entity_id,omitempty"`
	Severity    string    `json:"severity"`
	ActorUserID string    `json:"actor_user_id,omitempty"`
	ActorRole   string    `json:"actor_role"`
	CollegeID   string    `json:"college_id,omitempty"`
}

func (r *Repository) GetDashboardOverview(ctx context.Context, collegeID uuid.UUID) (*DashboardOverview, error) {
	query := `
		SELECT 
			(SELECT COUNT(*) FROM app.students WHERE college_id = $1) as total_students,
			(SELECT COUNT(*) FROM app.students WHERE college_id = $1 AND student_status = 'ACTIVE') as active_students,
			(SELECT COUNT(*) FROM app.staff_profiles WHERE college_id = $1) as total_staff,
			(SELECT COUNT(*) FROM app.hostels WHERE college_id = $1) as total_hostels,
			(SELECT COUNT(*) FROM app.beds WHERE college_id = $1) as total_beds,
			(SELECT COUNT(*) FROM app.beds WHERE college_id = $1 AND status = 'OCCUPIED') as occupied_beds,
			(SELECT COUNT(*) FROM app.complaints WHERE college_id = $1 AND status IN ('OPEN', 'IN_PROGRESS', 'ASSIGNED')) as open_complaints,
			(SELECT COUNT(*) FROM app.room_maintenance WHERE college_id = $1 AND status IN ('OPEN', 'IN_PROGRESS')) as open_maintenance
	`

	var res DashboardOverview
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID).Scan(
		&res.TotalStudents,
		&res.ActiveStudents,
		&res.TotalStaff,
		&res.TotalHostels,
		&res.TotalBeds,
		&res.OccupiedBeds,
		&res.OpenComplaints,
		&res.OpenMaintenance,
	)
	if err != nil {
		return nil, err
	}

	// Notifications count isn't global per college, it's per user typically.
	// We'll leave UnreadNotifications = 0 or we can count global system notifications.
	return &res, nil
}

func (r *Repository) GetStudentStats(ctx context.Context, collegeID uuid.UUID) (*StudentStats, error) {
	query1 := `SELECT student_status, COUNT(*) FROM app.students WHERE college_id = $1 GROUP BY student_status`
	rows1, err := r.Executor(ctx).Query(ctx, query1, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows1.Close()

	stats := &StudentStats{
		TotalByStatus:       make(map[string]int),
		TotalByHostelStatus: make(map[string]int),
	}
	for rows1.Next() {
		var status string
		var count int
		if err := rows1.Scan(&status, &count); err != nil {
			return nil, err
		}
		stats.TotalByStatus[status] = count
	}

	query2 := `SELECT hostel_status, COUNT(*) FROM app.students WHERE college_id = $1 GROUP BY hostel_status`
	rows2, err := r.Executor(ctx).Query(ctx, query2, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows2.Close()

	for rows2.Next() {
		var status string
		var count int
		if err := rows2.Scan(&status, &count); err != nil {
			return nil, err
		}
		stats.TotalByHostelStatus[status] = count
	}

	return stats, nil
}

func (r *Repository) GetHostelOccupancy(ctx context.Context, collegeID uuid.UUID) ([]HostelOccupancy, error) {
	query := `
		SELECT hostel_id, hostel_name, total_capacity, occupied_beds, available_capacity, occupancy_percentage
		FROM app.v_hostel_occupancy
		WHERE college_id = $1
	`
	rows, err := r.Executor(ctx).Query(ctx, query, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []HostelOccupancy
	for rows.Next() {
		var h HostelOccupancy
		if err := rows.Scan(&h.HostelID, &h.HostelName, &h.TotalCapacity, &h.OccupiedBeds, &h.AvailableCapacity, &h.OccupancyPercentage); err != nil {
			return nil, err
		}
		res = append(res, h)
	}
	return res, nil
}

func (r *Repository) GetAllocationStats(ctx context.Context, collegeID uuid.UUID) (*AllocationStats, error) {
	query := `SELECT status, COUNT(*) FROM app.bed_allocations WHERE college_id = $1 GROUP BY status`
	rows, err := r.Executor(ctx).Query(ctx, query, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats AllocationStats
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		if status == "ALLOCATED" {
			stats.TotalAllocated = count
		} else if status == "RELEASED" {
			stats.TotalReleased = count
		}
	}
	return &stats, nil
}

func (r *Repository) GetAttendanceStats(ctx context.Context, collegeID uuid.UUID) (*AttendanceStats, error) {
	query := `SELECT status, COUNT(*) FROM app.attendance_records WHERE college_id = $1 GROUP BY status`
	rows, err := r.Executor(ctx).Query(ctx, query, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats AttendanceStats
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		switch status {
		case "PRESENT":
			stats.PresentCount = count
		case "ABSENT":
			stats.AbsentCount = count
		case "LATE":
			stats.LateCount = count
		case "LEAVE":
			stats.LeaveCount = count
		}
	}
	return &stats, nil
}

func (r *Repository) GetLeaveStats(ctx context.Context, collegeID uuid.UUID) (*LeaveStats, error) {
	query := `SELECT status, COUNT(*) FROM app.leave_requests WHERE college_id = $1 GROUP BY status`
	rows, err := r.Executor(ctx).Query(ctx, query, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats LeaveStats
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		switch status {
		case "PENDING":
			stats.Pending = count
		case "APPROVED":
			stats.Approved = count
		case "REJECTED":
			stats.Rejected = count
		case "CANCELLED":
			stats.Cancelled = count
		}
	}
	return &stats, nil
}

func (r *Repository) GetComplaintStats(ctx context.Context, collegeID uuid.UUID) (*ComplaintStats, error) {
	query := `SELECT status, COUNT(*) FROM app.complaints WHERE college_id = $1 GROUP BY status`
	rows, err := r.Executor(ctx).Query(ctx, query, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats ComplaintStats
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		switch status {
		case "OPEN":
			stats.Open += count
		case "ASSIGNED", "IN_PROGRESS":
			stats.InProgress += count
		case "RESOLVED":
			stats.Resolved = count
		case "CLOSED":
			stats.Closed = count
		}
	}
	return &stats, nil
}

func (r *Repository) GetMaintenanceStats(ctx context.Context, collegeID uuid.UUID) (*MaintenanceStats, error) {
	query := `SELECT status, COUNT(*) FROM app.room_maintenance WHERE college_id = $1 GROUP BY status`
	rows, err := r.Executor(ctx).Query(ctx, query, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats MaintenanceStats
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		switch status {
		case "OPEN":
			stats.Open = count
		case "IN_PROGRESS":
			stats.InProgress = count
		case "RESOLVED":
			stats.Resolved = count
		case "CLOSED":
			stats.Closed = count
		}
	}
	return &stats, nil
}

func (r *Repository) GetStaffStats(ctx context.Context, collegeID uuid.UUID) (*StaffStats, error) {
	query := `SELECT employment_status, COUNT(*) FROM app.staff_profiles WHERE college_id = $1 GROUP BY employment_status`
	rows, err := r.Executor(ctx).Query(ctx, query, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := &StaffStats{
		TotalByStatus: make(map[string]int),
	}
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		stats.TotalByStatus[status] = count
	}
	return stats, nil
}

func (r *Repository) GetPlatformOverview(ctx context.Context) (*PlatformOverview, error) {
	query := `
		SELECT
			COUNT(*)::int,
			COUNT(*) FILTER (WHERE status = 'ONBOARDING')::int,
			COUNT(*) FILTER (WHERE status = 'ACTIVE')::int,
			COUNT(*) FILTER (WHERE status = 'SUSPENDED')::int,
			COUNT(*) FILTER (WHERE status = 'DEACTIVATED')::int,
			(SELECT COUNT(*)::int FROM platform.approval_requests WHERE status = 'PENDING'),
			(SELECT COUNT(*)::int FROM platform.approval_requests WHERE status = 'APPROVED'),
			(SELECT COUNT(*)::int FROM platform.approval_requests WHERE status = 'REJECTED'),
			(SELECT COUNT(*)::int FROM app.users),
			(SELECT COUNT(*)::int FROM app.users WHERE status = 'ACTIVE'),
			(SELECT COUNT(*)::int FROM platform.modules),
			(SELECT COUNT(*)::int FROM platform.modules WHERE is_active = TRUE),
			(SELECT COUNT(*)::int FROM platform.college_modules)
		FROM platform.colleges
	`

	var stats PlatformOverview
	err := r.Executor(ctx).QueryRow(ctx, query).Scan(
		&stats.TotalColleges,
		&stats.OnboardingColleges,
		&stats.ActiveColleges,
		&stats.SuspendedColleges,
		&stats.DeactivatedColleges,
		&stats.PendingApprovals,
		&stats.ApprovedApprovals,
		&stats.RejectedApprovals,
		&stats.TotalUsers,
		&stats.ActiveUsers,
		&stats.TotalModules,
		&stats.ActiveModules,
		&stats.CollegeModuleAssignments,
	)
	if err != nil {
		return nil, err
	}

	return &stats, nil
}

// GetRecentPlatformActivity returns newest audit events first.
// The caller must provide a limit between 1 and 50.
func (r *Repository) GetRecentPlatformActivity(
	ctx context.Context,
	limit int,
) ([]PlatformActivity, error) {
	if limit < 1 || limit > 50 {
		limit = 10
	}

	query := `
		SELECT
			audit_id,
			created_at,
			COALESCE(action, ''),
			COALESCE(module, ''),
			COALESCE(entity_type, ''),
			COALESCE(entity_id::text, ''),
			COALESCE(severity, ''),
			COALESCE(actor_user_id::text, ''),
			COALESCE(actor_role, ''),
			COALESCE(college_id::text, '')
		FROM platform.audit_logs
		ORDER BY created_at DESC, audit_id DESC
		LIMIT $1
	`

	rows, err := r.Executor(ctx).Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	activities := make([]PlatformActivity, 0, limit)
	for rows.Next() {
		var item PlatformActivity
		if err := rows.Scan(
			&item.AuditID,
			&item.CreatedAt,
			&item.Action,
			&item.Module,
			&item.EntityType,
			&item.EntityID,
			&item.Severity,
			&item.ActorUserID,
			&item.ActorRole,
			&item.CollegeID,
		); err != nil {
			return nil, err
		}
		activities = append(activities, item)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return activities, nil
}
