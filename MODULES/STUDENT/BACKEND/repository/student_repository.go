package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/MODULES/STUDENT/BACKEND/models"
)

// GetStudentByUserID resolves the student entity from the authenticated user's ID or email.
func (r *Repository) GetStudentByUserID(ctx context.Context, collegeID, userID uuid.UUID, userEmail string) (*models.StudentProfile, error) {
	db := r.getDB(ctx)

	query := `
		SELECT 
			s.id, s.college_id, s.user_id, s.admission_number, 
			s.registration_number, s.roll_number, s.first_name, 
			s.middle_name, s.last_name, s.date_of_birth, s.gender, 
			s.blood_group, s.phone, s.email, s.address_line1, 
			s.address_line2, s.city, s.state, s.postal_code, 
			s.country, s.student_status, s.hostel_status, s.admission_date,
			d.name AS department_name,
			prog.name AS program_name,
			c.name AS course_name,
			ay.name AS academic_year,
			sem.semester_number,
			b.name AS batch_name
		FROM app.students s
		LEFT JOIN app.departments d ON d.department_id = s.department_id
		LEFT JOIN app.programs prog ON prog.program_id = s.program_id
		LEFT JOIN app.courses c ON c.course_id = s.course_id
		LEFT JOIN app.academic_years ay ON ay.academic_year_id = s.academic_year_id
		LEFT JOIN app.semesters sem ON sem.semester_id = s.semester_id
		LEFT JOIN app.batches b ON b.batch_id = s.batch_id
		WHERE s.college_id = $1 
		  AND (s.user_id = $2 OR LOWER(s.email) = LOWER($3))
		LIMIT 1
	`

	var sp models.StudentProfile
	var dob, admDate sql.NullTime
	var semNum sql.NullInt32
	var deptName, progName, courseName, ayName, batchName sql.NullString

	err := db.QueryRow(ctx, query, collegeID, userID, userEmail).Scan(
		&sp.ID, &sp.CollegeID, &sp.UserID, &sp.AdmissionNumber,
		&sp.RegistrationNumber, &sp.RollNumber, &sp.FirstName,
		&sp.MiddleName, &sp.LastName, &dob, &sp.Gender,
		&sp.BloodGroup, &sp.Phone, &sp.Email, &sp.AddressLine1,
		&sp.AddressLine2, &sp.City, &sp.State, &sp.PostalCode,
		&sp.Country, &sp.StudentStatus, &sp.HostelStatus, &admDate,
		&deptName, &progName, &courseName, &ayName, &semNum, &batchName,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrStudentNotFound
		}
		return nil, fmt.Errorf("query student by user failed: %w", err)
	}

	if dob.Valid {
		sp.DateOfBirth = &dob.Time
	}
	if admDate.Valid {
		sp.AdmissionDate = &admDate.Time
	}
	if semNum.Valid {
		sNum := int(semNum.Int32)
		sp.SemesterNumber = &sNum
	}
	if deptName.Valid {
		sp.DepartmentName = &deptName.String
	}
	if progName.Valid {
		sp.ProgramName = &progName.String
	}
	if courseName.Valid {
		sp.CourseName = &courseName.String
	}
	if ayName.Valid {
		sp.AcademicYear = &ayName.String
	}
	if batchName.Valid {
		sp.BatchName = &batchName.String
	}

	// Compute full name
	names := []string{sp.FirstName}
	if sp.MiddleName != nil && *sp.MiddleName != "" {
		names = append(names, *sp.MiddleName)
	}
	if sp.LastName != nil && *sp.LastName != "" {
		names = append(names, *sp.LastName)
	}
	sp.FullName = strings.Join(names, " ")

	return &sp, nil
}

// ListStudentGuardians retrieves verified parent/guardian records linked to the student.
func (r *Repository) ListStudentGuardians(ctx context.Context, collegeID, studentID uuid.UUID) ([]models.GuardianInfo, error) {
	db := r.getDB(ctx)

	query := `
		SELECT 
			p.id, p.first_name, p.middle_name, p.last_name, 
			sp.relationship, p.phone, p.alternate_phone, p.email, 
			p.occupation, sp.is_primary, sp.can_receive_notifications, sp.can_pickup_student
		FROM app.student_parents sp
		JOIN app.parents p ON p.id = sp.parent_id
		WHERE sp.college_id = $1 AND sp.student_id = $2
		ORDER BY sp.is_primary DESC, sp.created_at ASC
	`

	rows, err := db.Query(ctx, query, collegeID, studentID)
	if err != nil {
		return nil, fmt.Errorf("query student guardians failed: %w", err)
	}
	defer rows.Close()

	var guardians []models.GuardianInfo
	for rows.Next() {
		var g models.GuardianInfo
		var mName, lName, altPhone, email, occupation sql.NullString
		var rel sql.NullString

		if err := rows.Scan(
			&g.ID, &g.FirstName, &mName, &lName,
			&rel, &g.Phone, &altPhone, &email,
			&occupation, &g.IsPrimary, &g.CanReceiveNotifications, &g.CanPickupStudent,
		); err != nil {
			return nil, fmt.Errorf("scan guardian failed: %w", err)
		}

		if mName.Valid {
			g.MiddleName = &mName.String
		}
		if lName.Valid {
			g.LastName = &lName.String
		}
		if altPhone.Valid {
			g.AlternatePhone = &altPhone.String
		}
		if email.Valid {
			g.Email = &email.String
		}
		if occupation.Valid {
			g.Occupation = &occupation.String
		}
		if rel.Valid {
			g.Relationship = rel.String
		}

		names := []string{g.FirstName}
		if g.MiddleName != nil && *g.MiddleName != "" {
			names = append(names, *g.MiddleName)
		}
		if g.LastName != nil && *g.LastName != "" {
			names = append(names, *g.LastName)
		}
		g.FullName = strings.Join(names, " ")

		guardians = append(guardians, g)
	}

	if guardians == nil {
		guardians = []models.GuardianInfo{}
	}

	return guardians, nil
}

// ListEmergencyContacts retrieves authorized emergency contacts for the student.
func (r *Repository) ListEmergencyContacts(ctx context.Context, collegeID, studentID uuid.UUID) ([]models.EmergencyContactInfo, error) {
	db := r.getDB(ctx)

	query := `
		SELECT 
			id, contact_name, relationship, phone, alternate_phone, email, is_primary
		FROM app.emergency_contacts
		WHERE college_id = $1 AND student_id = $2
		ORDER BY is_primary DESC, created_at ASC
	`

	rows, err := db.Query(ctx, query, collegeID, studentID)
	if err != nil {
		return nil, fmt.Errorf("query emergency contacts failed: %w", err)
	}
	defer rows.Close()

	var contacts []models.EmergencyContactInfo
	for rows.Next() {
		var ec models.EmergencyContactInfo
		var rel, altPhone, email sql.NullString

		if err := rows.Scan(
			&ec.ID, &ec.ContactName, &rel, &ec.Phone, &altPhone, &email, &ec.IsPrimary,
		); err != nil {
			return nil, fmt.Errorf("scan emergency contact failed: %w", err)
		}

		if rel.Valid {
			ec.Relationship = &rel.String
		}
		if altPhone.Valid {
			ec.AlternatePhone = &altPhone.String
		}
		if email.Valid {
			ec.Email = &email.String
		}

		contacts = append(contacts, ec)
	}

	if contacts == nil {
		contacts = []models.EmergencyContactInfo{}
	}

	return contacts, nil
}

// ListStudentDocuments retrieves permitted documents stored in app.files for the student.
func (r *Repository) ListStudentDocuments(ctx context.Context, collegeID, studentID uuid.UUID) ([]models.StudentDocumentInfo, error) {
	db := r.getDB(ctx)

	query := `
		SELECT 
			id, file_name, storage_path, mime_type, file_size, created_at, status
		FROM app.files
		WHERE college_id = $1 
		  AND owner_table = 'students' 
		  AND owner_id = $2 
		  AND status = 'ACTIVE'
		ORDER BY created_at DESC
	`

	rows, err := db.Query(ctx, query, collegeID, studentID)
	if err != nil {
		return nil, fmt.Errorf("query student documents failed: %w", err)
	}
	defer rows.Close()

	var docs []models.StudentDocumentInfo
	for rows.Next() {
		var doc models.StudentDocumentInfo
		var fName sql.NullString
		var mType sql.NullString
		var fSize sql.NullInt64

		if err := rows.Scan(
			&doc.ID, &fName, &doc.StoragePath, &mType, &fSize, &doc.UploadedAt, &doc.Status,
		); err != nil {
			return nil, fmt.Errorf("scan student document failed: %w", err)
		}

		if fName.Valid {
			doc.FileName = fName.String
		}
		if mType.Valid {
			doc.MimeType = &mType.String
		}
		if fSize.Valid {
			doc.FileSize = &fSize.Int64
		}

		docs = append(docs, doc)
	}

	if docs == nil {
		docs = []models.StudentDocumentInfo{}
	}

	return docs, nil
}

// GetCurrentBedAllocation fetches the active room allotment for the student.
func (r *Repository) GetCurrentBedAllocation(ctx context.Context, collegeID, studentID uuid.UUID) (*models.BedAllocation, error) {
	db := r.getDB(ctx)

	query := `
		SELECT 
			ba.id, ba.college_id, ba.student_id, ba.bed_id,
			b.bed_label,
			r.id AS room_id, r.room_number, r.floor_number,
			blk.id AS block_id, blk.name AS block_name,
			h.id AS hostel_id, h.name AS hostel_name, h.hostel_type,
			ba.allocation_type, ba.allocated_at, ba.released_at,
			ba.status, ba.remarks
		FROM app.bed_allocations ba
		JOIN app.beds b ON b.id = ba.bed_id
		JOIN app.rooms r ON r.id = b.room_id
		JOIN app.blocks blk ON blk.id = r.block_id
		JOIN app.hostels h ON h.id = blk.hostel_id
		WHERE ba.college_id = $1 
		  AND ba.student_id = $2 
		  AND ba.status = 'ACTIVE'
		ORDER BY ba.allocated_at DESC
		LIMIT 1
	`

	var alloc models.BedAllocation
	var remarks sql.NullString
	var releasedAt sql.NullTime

	err := db.QueryRow(ctx, query, collegeID, studentID).Scan(
		&alloc.ID, &alloc.CollegeID, &alloc.StudentID, &alloc.BedID,
		&alloc.BedLabel,
		&alloc.RoomID, &alloc.RoomNumber, &alloc.FloorNumber,
		&alloc.BlockID, &alloc.BlockName,
		&alloc.HostelID, &alloc.HostelName, &alloc.HostelType,
		&alloc.AllocationType, &alloc.AllocatedAt, &releasedAt,
		&alloc.Status, &remarks,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // No active room allocation
		}
		return nil, fmt.Errorf("query bed allocation failed: %w", err)
	}

	if remarks.Valid {
		alloc.Remarks = &remarks.String
	}
	if releasedAt.Valid {
		alloc.ReleasedAt = &releasedAt.Time
	}

	return &alloc, nil
}

// ListGatePasses retrieves all gate pass records for the student.
func (r *Repository) ListGatePasses(ctx context.Context, collegeID, studentID uuid.UUID) ([]models.GatePass, error) {
	db := r.getDB(ctx)

	query := `
		SELECT 
			id, college_id, student_id, leave_request_id,
			pass_number, pass_type, reason, destination,
			valid_from, valid_until, status, qr_code_data,
			approved_by, approved_at, rejection_reason,
			actual_exit_at, actual_entry_at, created_at
		FROM app.gate_passes
		WHERE college_id = $1 AND student_id = $2
		ORDER BY created_at DESC
		LIMIT 50
	`

	rows, err := db.Query(ctx, query, collegeID, studentID)
	if err != nil {
		return nil, fmt.Errorf("list gate passes query failed: %w", err)
	}
	defer rows.Close()

	var passes []models.GatePass
	for rows.Next() {
		var p models.GatePass
		var dest, rejReason sql.NullString
		var appAt, exitAt, entryAt sql.NullTime

		err := rows.Scan(
			&p.ID, &p.CollegeID, &p.StudentID, &p.LeaveRequestID,
			&p.PassNumber, &p.PassType, &p.Reason, &dest,
			&p.ValidFrom, &p.ValidUntil, &p.Status, &p.QRCodeData,
			&p.ApprovedBy, &appAt, &rejReason,
			&exitAt, &entryAt, &p.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan gate pass failed: %w", err)
		}

		if dest.Valid {
			p.Destination = &dest.String
		}
		if rejReason.Valid {
			p.RejectionReason = &rejReason.String
		}
		if appAt.Valid {
			p.ApprovedAt = &appAt.Time
		}
		if exitAt.Valid {
			p.ActualExitAt = &exitAt.Time
		}
		if entryAt.Valid {
			p.ActualEntryAt = &entryAt.Time
		}

		passes = append(passes, p)
	}

	return passes, nil
}

// CreateGatePass inserts a newly requested gate pass.
func (r *Repository) CreateGatePass(ctx context.Context, p *models.GatePass) error {
	db := r.getDB(ctx)

	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	p.CreatedAt = time.Now()
	p.Status = "REQUESTED"

	// Generate institutional sequential pass number
	p.PassNumber = fmt.Sprintf("GP-%s-%d", time.Now().Format("20060102"), time.Now().Unix()%100000)
	p.QRCodeData = fmt.Sprintf("HMS-GP:%s:%s:%s", p.CollegeID, p.ID, p.PassNumber)

	query := `
		INSERT INTO app.gate_passes (
			id, college_id, student_id, leave_request_id,
			pass_number, pass_type, reason, destination,
			valid_from, valid_until, status, qr_code_data, created_at
		) VALUES (
			$1, $2, $3, $4,
			$5, $6, $7, $8,
			$9, $10, $11, $12, $13
		)
	`

	_, err := db.Exec(ctx, query,
		p.ID, p.CollegeID, p.StudentID, p.LeaveRequestID,
		p.PassNumber, p.PassType, p.Reason, p.Destination,
		p.ValidFrom, p.ValidUntil, p.Status, p.QRCodeData, p.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert gate pass failed: %w", err)
	}

	return nil
}

// GetAttendanceSummary calculates roll-call rates and retrieves recent session logs.
func (r *Repository) GetAttendanceSummary(ctx context.Context, collegeID, studentID uuid.UUID) (*models.AttendanceSummary, error) {
	db := r.getDB(ctx)

	summary := &models.AttendanceSummary{
		StudentID: studentID,
	}

	// Query aggregate counts
	countsQuery := `
		SELECT 
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE status = 'PRESENT') AS present_count,
			COUNT(*) FILTER (WHERE status = 'ABSENT') AS absent_count,
			COUNT(*) FILTER (WHERE status = 'ON_LEAVE') AS on_leave_count
		FROM app.attendance_records
		WHERE student_id = $1
	`

	_ = db.QueryRow(ctx, countsQuery, studentID).Scan(
		&summary.TotalSessions,
		&summary.PresentCount,
		&summary.AbsentCount,
		&summary.OnLeaveCount,
	)

	if summary.TotalSessions > 0 {
		summary.AttendancePercentage = float64(summary.PresentCount) / float64(summary.TotalSessions) * 100.0
	} else {
		// Zero sessions recorded; no rate can be calculated
		summary.AttendancePercentage = 0.0
	}

	// Query recent records
	recordsQuery := `
		SELECT 
			id, student_id, attendance_date, session_type,
			status, verification_method, recorded_at, remarks
		FROM app.attendance_records
		WHERE student_id = $1
		ORDER BY attendance_date DESC, recorded_at DESC
		LIMIT 20
	`

	rows, err := db.Query(ctx, recordsQuery, studentID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var rec models.AttendanceRecord
			var remarks sql.NullString
			if err := rows.Scan(
				&rec.ID, &rec.StudentID, &rec.AttendanceDate, &rec.SessionType,
				&rec.Status, &rec.VerificationMethod, &rec.RecordedAt, &remarks,
			); err == nil {
				if remarks.Valid {
					rec.Remarks = &remarks.String
				}
				summary.RecentRecords = append(summary.RecentRecords, rec)
			}
		}
	}

	return summary, nil
}

// ListLeaves retrieves all leave applications submitted by the student.
func (r *Repository) ListLeaves(ctx context.Context, collegeID, studentID uuid.UUID) ([]models.LeaveRequest, error) {
	db := r.getDB(ctx)

	query := `
		SELECT 
			id, college_id, student_id, leave_type,
			start_date, end_date, reason, parent_consent_status,
			status, approved_by, approved_at, created_at
		FROM app.leave_requests
		WHERE college_id = $1 AND student_id = $2
		ORDER BY created_at DESC
		LIMIT 50
	`

	rows, err := db.Query(ctx, query, collegeID, studentID)
	if err != nil {
		return nil, fmt.Errorf("list leaves query failed: %w", err)
	}
	defer rows.Close()

	var leaves []models.LeaveRequest
	for rows.Next() {
		var l models.LeaveRequest
		var appAt sql.NullTime

		err := rows.Scan(
			&l.ID, &l.CollegeID, &l.StudentID, &l.LeaveType,
			&l.StartDate, &l.EndDate, &l.Reason, &l.ParentConsentStatus,
			&l.Status, &l.ApprovedBy, &appAt, &l.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan leave request failed: %w", err)
		}

		if appAt.Valid {
			l.ApprovedAt = &appAt.Time
		}

		leaves = append(leaves, l)
	}

	return leaves, nil
}

// CreateLeave inserts a new student leave request.
func (r *Repository) CreateLeave(ctx context.Context, l *models.LeaveRequest) error {
	db := r.getDB(ctx)

	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	l.CreatedAt = time.Now()
	l.Status = "PENDING"
	if l.ParentConsentStatus == "" {
		l.ParentConsentStatus = "PENDING"
	}

	query := `
		INSERT INTO app.leave_requests (
			id, college_id, student_id, leave_type,
			start_date, end_date, reason, parent_consent_status,
			status, created_at
		) VALUES (
			$1, $2, $3, $4,
			$5, $6, $7, $8,
			$9, $10
		)
	`

	_, err := db.Exec(ctx, query,
		l.ID, l.CollegeID, l.StudentID, l.LeaveType,
		l.StartDate, l.EndDate, l.Reason, l.ParentConsentStatus,
		l.Status, l.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert leave request failed: %w", err)
	}

	return nil
}

// ListComplaints retrieves all maintenance issues and grievances filed by the student.
func (r *Repository) ListComplaints(ctx context.Context, collegeID, studentID uuid.UUID) ([]models.Complaint, error) {
	db := r.getDB(ctx)

	query := `
		SELECT 
			id, college_id, student_id, hostel_id, room_id,
			category, title, description, priority, status,
			assigned_to, resolution_notes, resolved_at, created_at
		FROM app.complaints
		WHERE college_id = $1 AND student_id = $2
		ORDER BY created_at DESC
		LIMIT 50
	`

	rows, err := db.Query(ctx, query, collegeID, studentID)
	if err != nil {
		return nil, fmt.Errorf("list complaints query failed: %w", err)
	}
	defer rows.Close()

	var complaints []models.Complaint
	for rows.Next() {
		var c models.Complaint
		var resNotes sql.NullString
		var resAt sql.NullTime

		err := rows.Scan(
			&c.ID, &c.CollegeID, &c.StudentID, &c.HostelID, &c.RoomID,
			&c.Category, &c.Title, &c.Description, &c.Priority, &c.Status,
			&c.AssignedTo, &resNotes, &resAt, &c.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan complaint failed: %w", err)
		}

		if resNotes.Valid {
			c.ResolutionNotes = &resNotes.String
		}
		if resAt.Valid {
			c.ResolvedAt = &resAt.Time
		}

		complaints = append(complaints, c)
	}

	return complaints, nil
}

// CreateComplaint inserts a new student grievance.
func (r *Repository) CreateComplaint(ctx context.Context, c *models.Complaint) error {
	db := r.getDB(ctx)

	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	c.CreatedAt = time.Now()
	c.Status = "PENDING"
	if c.Priority == "" {
		c.Priority = "MEDIUM"
	}

	query := `
		INSERT INTO app.complaints (
			id, college_id, student_id, hostel_id, room_id,
			category, title, description, priority, status, created_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10, $11
		)
	`

	_, err := db.Exec(ctx, query,
		c.ID, c.CollegeID, c.StudentID, c.HostelID, c.RoomID,
		c.Category, c.Title, c.Description, c.Priority, c.Status, c.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert complaint failed: %w", err)
	}

	return nil
}

// GetTodayMessMenu provides institutional dining menu for the day from app.meal_menus.
func (r *Repository) GetTodayMessMenu(ctx context.Context, collegeID uuid.UUID) (*models.TodayMessMenu, error) {
	db := r.getDB(ctx)
	now := time.Now()
	dayName := strings.ToUpper(now.Weekday().String())

	query := `
		SELECT meal_type, items, is_special
		FROM app.meal_menus
		WHERE college_id = $1 AND menu_date = CURRENT_DATE
		ORDER BY 
			CASE meal_type
				WHEN 'BREAKFAST' THEN 1
				WHEN 'LUNCH' THEN 2
				WHEN 'SNACKS' THEN 3
				WHEN 'DINNER' THEN 4
				ELSE 5
			END ASC
	`

	rows, err := db.Query(ctx, query, collegeID)
	if err != nil {
		return nil, fmt.Errorf("query meal menus failed: %w", err)
	}
	defer rows.Close()

	var meals []models.MessMealItem
	for rows.Next() {
		var mealType, itemsStr string
		var isSpecial bool
		if err := rows.Scan(&mealType, &itemsStr, &isSpecial); err != nil {
			continue
		}

		var items []string
		for _, itm := range strings.Split(itemsStr, ",") {
			trimmed := strings.TrimSpace(itm)
			if trimmed != "" {
				items = append(items, trimmed)
			}
		}
		if len(items) == 0 && itemsStr != "" {
			items = []string{itemsStr}
		}

		timings := ""
		switch mealType {
		case "BREAKFAST":
			timings = "07:30 AM - 09:00 AM"
		case "LUNCH":
			timings = "12:30 PM - 02:00 PM"
		case "SNACKS":
			timings = "04:30 PM - 05:30 PM"
		case "DINNER":
			timings = "07:30 PM - 09:00 PM"
		}

		meals = append(meals, models.MessMealItem{
			MealType: mealType,
			Items:    items,
			Timings:  timings,
			IsVeg:    true,
			Special:  isSpecial,
		})
	}

	if meals == nil {
		meals = []models.MessMealItem{}
	}

	menu := &models.TodayMessMenu{
		DayOfWeek: dayName,
		Date:      now.Format("02 Jan 2006"),
		Meals:     meals,
	}

	return menu, nil
}

