package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/MODULES/HOSTEL-INCHARGE/BACKEND/models"
)

// ListInchargeHostels lists all staff assigned to a given hostel.
func (r *Repository) ListInchargeHostels(
	ctx context.Context,
	collegeID, hostelID uuid.UUID,
) ([]models.InchargeHostelAssignment, error) {
	rows, err := r.Executor(ctx).Query(ctx, `
		SELECT
			id,
			college_id,
			staff_id,
			hostel_id,
			assigned_from,
			assigned_until,
			is_primary,
			created_at,
			updated_at
		FROM app.incharge_hostels
		WHERE college_id = $1
		  AND hostel_id = $2
		ORDER BY is_primary DESC, assigned_from DESC
	`, collegeID, hostelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []models.InchargeHostelAssignment
	for rows.Next() {
		var item models.InchargeHostelAssignment
		if err := rows.Scan(
			&item.ID,
			&item.CollegeID,
			&item.StaffID,
			&item.HostelID,
			&item.AssignedFrom,
			&item.AssignedUntil,
			&item.IsPrimary,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

// GetInchargeHostel fetches a single incharge assignment.
func (r *Repository) GetInchargeHostel(
	ctx context.Context,
	collegeID, hostelID, assignmentID uuid.UUID,
) (models.InchargeHostelAssignment, error) {
	var item models.InchargeHostelAssignment
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT
			id,
			college_id,
			staff_id,
			hostel_id,
			assigned_from,
			assigned_until,
			is_primary,
			created_at,
			updated_at
		FROM app.incharge_hostels
		WHERE college_id = $1
		  AND hostel_id = $2
		  AND id = $3
	`, collegeID, hostelID, assignmentID).Scan(
		&item.ID,
		&item.CollegeID,
		&item.StaffID,
		&item.HostelID,
		&item.AssignedFrom,
		&item.AssignedUntil,
		&item.IsPrimary,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.InchargeHostelAssignment{}, ErrNotFound
		}
		return models.InchargeHostelAssignment{}, err
	}
	return item, nil
}

// GetMyHostel resolves the assigned hostel profile for the authenticated staff user.
func (r *Repository) GetMyHostel(
	ctx context.Context,
	collegeID, userID uuid.UUID,
) (*models.MyHostelProfile, error) {
	var res models.MyHostelProfile
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT 
			h.id,
			COALESCE(h.code::text, ''),
			h.name,
			COALESCE(h.category, 'RESIDENTIAL'),
			COALESCE(h.total_capacity, 0),
			COALESCE((SELECT COUNT(*) FROM app.rooms r WHERE r.hostel_id = h.id), 0),
			sp.id,
			TRIM(CONCAT(sp.first_name, ' ', COALESCE(sp.last_name, ''))),
			COALESCE(sp.designation, 'Hostel Incharge'),
			ih.is_primary,
			ih.assigned_from,
			ih.assigned_until
		FROM app.incharge_hostels ih
		JOIN app.hostels h ON h.id = ih.hostel_id
		JOIN app.staff_profiles sp ON sp.id = ih.staff_id
		WHERE ih.college_id = $1
		  AND sp.user_id = $2
		  AND (ih.assigned_until IS NULL OR ih.assigned_until >= CURRENT_DATE)
		ORDER BY ih.is_primary DESC, ih.assigned_from DESC
		LIMIT 1
	`, collegeID, userID).Scan(
		&res.HostelID,
		&res.HostelCode,
		&res.HostelName,
		&res.HostelType,
		&res.TotalCapacity,
		&res.TotalRooms,
		&res.StaffID,
		&res.StaffName,
		&res.Designation,
		&res.IsPrimary,
		&res.AssignedFrom,
		&res.AssignedUntil,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Super/College admin oversight fallback: preview first active hostel
			var isCollegeAdmin bool
			_ = r.Executor(ctx).QueryRow(ctx, `
				SELECT EXISTS (
					SELECT 1 FROM platform.user_roles ur
					JOIN platform.roles r ON r.role_id = ur.role_id
					WHERE ur.user_id = $1 AND ur.college_id = $2 AND r.role_code IN ('COLLEGE_ADMIN', 'SUPER_ADMIN')
				)
			`, userID, collegeID).Scan(&isCollegeAdmin)

			if isCollegeAdmin {
				var adminRes models.MyHostelProfile
				errAdmin := r.Executor(ctx).QueryRow(ctx, `
					SELECT id, COALESCE(code::text, ''), name, COALESCE(category, 'RESIDENTIAL'),
					       COALESCE(total_capacity, 0), COALESCE((SELECT COUNT(*) FROM app.rooms r WHERE r.hostel_id = app.hostels.id), 0)
					FROM app.hostels
					WHERE college_id = $1 AND status = 'ACTIVE'
					ORDER BY name ASC LIMIT 1
				`, collegeID).Scan(
					&adminRes.HostelID,
					&adminRes.HostelCode,
					&adminRes.HostelName,
					&adminRes.HostelType,
					&adminRes.TotalCapacity,
					&adminRes.TotalRooms,
				)
				if errAdmin == nil {
					adminRes.StaffName = "Administrator Preview"
					adminRes.Designation = "College Administrator"
					adminRes.IsPrimary = true
					adminRes.AssignedFrom = time.Now()
					return &adminRes, nil
				}
			}
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &res, nil
}

// ListHostelResidents returns resident students enrolled in the specified hostel.
func (r *Repository) ListHostelResidents(
	ctx context.Context,
	collegeID, hostelID uuid.UUID,
) ([]models.ResidentStudent, error) {
	query := `
		SELECT 
			s.id,
			s.admission_number,
			COALESCE(s.roll_number, ''),
			s.first_name,
			COALESCE(s.last_name, ''),
			COALESCE(s.email::text, ''),
			COALESCE(s.phone, ''),
			COALESCE(s.gender, ''),
			COALESCE(s.blood_group, ''),
			COALESCE(s.hostel_status, 'HOUSED'),
			ba.id,
			COALESCE(ba.allocation_type, 'REGULAR'),
			ba.allocated_at,
			b.id,
			b.name,
			r.id,
			r.name,
			COALESCE(r.code::text, ''),
			r.block_id,
			COALESCE(blk.name, '')
		FROM app.bed_allocations ba
		JOIN app.beds b ON b.id = ba.bed_id
		JOIN app.rooms r ON r.id = b.room_id
		LEFT JOIN app.blocks blk ON blk.id = r.block_id
		JOIN app.students s ON s.id = ba.student_id
		WHERE ba.college_id = $1
		  AND r.hostel_id = $2
		  AND ba.status = 'ACTIVE'
		ORDER BY r.code, b.name, s.first_name
	`

	rows, err := r.Executor(ctx).Query(ctx, query, collegeID, hostelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	residents := make([]models.ResidentStudent, 0)
	for rows.Next() {
		var item models.ResidentStudent
		if err := rows.Scan(
			&item.StudentID,
			&item.AdmissionNumber,
			&item.RollNumber,
			&item.FirstName,
			&item.LastName,
			&item.Email,
			&item.Phone,
			&item.Gender,
			&item.BloodGroup,
			&item.HostelStatus,
			&item.AllocationID,
			&item.AllocationType,
			&item.AllocatedAt,
			&item.BedID,
			&item.BedName,
			&item.RoomID,
			&item.RoomName,
			&item.RoomCode,
			&item.BlockID,
			&item.BlockName,
		); err != nil {
			return nil, err
		}
		item.FullName = strings.TrimSpace(item.FirstName + " " + item.LastName)
		residents = append(residents, item)
	}
	return residents, nil
}

// ListVacantBeds returns available beds in the specified hostel.
func (r *Repository) ListVacantBeds(
	ctx context.Context,
	collegeID, hostelID uuid.UUID,
) ([]models.VacantBed, error) {
	query := `
		SELECT 
			b.id,
			b.name,
			r.id,
			COALESCE(r.code::text, ''),
			r.name,
			r.block_id,
			COALESCE(blk.name, '')
		FROM app.beds b
		JOIN app.rooms r ON r.id = b.room_id
		LEFT JOIN app.blocks blk ON blk.id = r.block_id
		WHERE b.college_id = $1
		  AND r.hostel_id = $2
		  AND b.status = 'AVAILABLE'
		  AND NOT EXISTS (
			  SELECT 1 FROM app.bed_allocations ba WHERE ba.bed_id = b.id AND ba.status = 'ACTIVE'
		  )
		ORDER BY r.code, b.name
	`

	rows, err := r.Executor(ctx).Query(ctx, query, collegeID, hostelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	beds := make([]models.VacantBed, 0)
	for rows.Next() {
		var item models.VacantBed
		if err := rows.Scan(
			&item.BedID,
			&item.BedName,
			&item.RoomID,
			&item.RoomCode,
			&item.RoomName,
			&item.BlockID,
			&item.BlockName,
		); err != nil {
			return nil, err
		}
		beds = append(beds, item)
	}
	return beds, nil
}

// ListUnallocatedStudents returns students who do not yet have an active bed allocation.
func (r *Repository) ListUnallocatedStudents(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]models.UnallocatedStudent, error) {
	query := `
		SELECT 
			s.id,
			s.admission_number,
			COALESCE(s.roll_number, ''),
			s.first_name,
			COALESCE(s.last_name, ''),
			COALESCE(s.email::text, ''),
			COALESCE(s.phone, ''),
			COALESCE(s.gender, ''),
			COALESCE(s.year_of_study, 1),
			COALESCE(s.department, '')
		FROM app.students s
		WHERE s.college_id = $1
		  AND s.student_status = 'ACTIVE'
		  AND NOT EXISTS (
			  SELECT 1 FROM app.bed_allocations ba WHERE ba.student_id = s.id AND ba.status = 'ACTIVE'
		  )
		ORDER BY s.admission_number ASC
		LIMIT 100
	`

	rows, err := r.Executor(ctx).Query(ctx, query, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	students := make([]models.UnallocatedStudent, 0)
	for rows.Next() {
		var item models.UnallocatedStudent
		if err := rows.Scan(
			&item.StudentID,
			&item.AdmissionNumber,
			&item.RollNumber,
			&item.FirstName,
			&item.LastName,
			&item.Email,
			&item.Phone,
			&item.Gender,
			&item.YearOfStudy,
			&item.Department,
		); err != nil {
			return nil, err
		}
		item.FullName = strings.TrimSpace(item.FirstName + " " + item.LastName)
		students = append(students, item)
	}
	return students, nil
}

// GetDashboardSummary aggregates live hostel metrics for the incharge dashboard.
func (r *Repository) GetDashboardSummary(
	ctx context.Context,
	collegeID, hostelID uuid.UUID,
) (*models.InchargeDashboardSummary, error) {
	var summary models.InchargeDashboardSummary
	summary.HostelID = hostelID

	// 1. Capacity & hostel name
	_ = r.Executor(ctx).QueryRow(ctx, `
		SELECT name, COALESCE(total_capacity, 0)
		FROM app.hostels
		WHERE id = $1 AND college_id = $2
	`, hostelID, collegeID).Scan(&summary.HostelName, &summary.TotalCapacity)

	// 2. Active residents / occupied beds count
	_ = r.Executor(ctx).QueryRow(ctx, `
		SELECT COUNT(DISTINCT ba.id)
		FROM app.bed_allocations ba
		JOIN app.beds b ON b.id = ba.bed_id
		JOIN app.rooms r ON r.id = b.room_id
		WHERE ba.college_id = $1 AND r.hostel_id = $2 AND ba.status = 'ACTIVE'
	`, collegeID, hostelID).Scan(&summary.OccupiedBeds)
	summary.TotalResidents = summary.OccupiedBeds

	// 3. Vacant beds
	summary.VacantBeds = summary.TotalCapacity - summary.OccupiedBeds
	if summary.VacantBeds < 0 {
		summary.VacantBeds = 0
	}
	if summary.TotalCapacity > 0 {
		summary.OccupancyRate = float64(summary.OccupiedBeds) / float64(summary.TotalCapacity) * 100.0
	}

	// 4. Today's attendance
	_ = r.Executor(ctx).QueryRow(ctx, `
		SELECT 
			COUNT(CASE WHEN status = 'PRESENT' THEN 1 END),
			COUNT(CASE WHEN status = 'ABSENT' THEN 1 END),
			COUNT(CASE WHEN status = 'ON_LEAVE' THEN 1 END)
		FROM app.student_attendance sa
		JOIN app.rooms r ON r.id = sa.room_id
		WHERE sa.college_id = $1 AND r.hostel_id = $2 AND sa.attendance_date = CURRENT_DATE
	`, collegeID, hostelID).Scan(&summary.TodayPresent, &summary.TodayAbsent, &summary.TodayOnLeave)

	// 5. Open complaints
	_ = r.Executor(ctx).QueryRow(ctx, `
		SELECT COUNT(*)
		FROM app.complaints
		WHERE college_id = $1 AND hostel_id = $2 AND status IN ('OPEN', 'IN_PROGRESS', 'PENDING')
	`, collegeID, hostelID).Scan(&summary.OpenComplaints)

	// 6. Active announcements
	_ = r.Executor(ctx).QueryRow(ctx, `
		SELECT COUNT(*)
		FROM app.notifications
		WHERE college_id = $1 AND is_active = true
	`, collegeID).Scan(&summary.ActiveAnnounce)

	return &summary, nil
}
