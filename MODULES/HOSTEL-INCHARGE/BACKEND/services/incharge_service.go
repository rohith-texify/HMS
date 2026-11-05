package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/MODULES/HOSTEL-INCHARGE/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/HOSTEL-INCHARGE/BACKEND/repository"
)

// InchargeService implements business operations for hostel incharge workflows.
type InchargeService struct {
	db   *database.Database
	repo *repository.Repository
}

// NewInchargeService initializes the service.
func NewInchargeService(
	db *database.Database,
	repo *repository.Repository,
) *InchargeService {
	return &InchargeService{
		db:   db,
		repo: repo,
	}
}

// List returns all incharge assignments for a specified hostel.
func (s *InchargeService) List(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
) ([]models.InchargeHostel, error) {
	if collegeID == uuid.Nil {
		return nil, fmt.Errorf("college ID is required")
	}
	if hostelID == uuid.Nil {
		return nil, fmt.Errorf("hostel ID is required")
	}

	return s.repo.ListInchargeHostels(ctx, collegeID, hostelID)
}

// Get retrieves a specific assignment by ID.
func (s *InchargeService) Get(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	assignmentID uuid.UUID,
) (models.InchargeHostel, error) {
	if collegeID == uuid.Nil {
		return models.InchargeHostel{}, fmt.Errorf("college ID is required")
	}
	if hostelID == uuid.Nil {
		return models.InchargeHostel{}, fmt.Errorf("hostel ID is required")
	}
	if assignmentID == uuid.Nil {
		return models.InchargeHostel{}, fmt.Errorf("assignment ID is required")
	}

	return s.repo.GetInchargeHostel(ctx, collegeID, hostelID, assignmentID)
}

// Create registers an assignment of a staff member to a hostel.
func (s *InchargeService) Create(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	staffID uuid.UUID,
	assignedFrom time.Time,
	assignedUntil *time.Time,
	isPrimary bool,
) (models.InchargeHostel, error) {
	if collegeID == uuid.Nil {
		return models.InchargeHostel{}, fmt.Errorf("college ID is required")
	}
	if hostelID == uuid.Nil {
		return models.InchargeHostel{}, fmt.Errorf("hostel ID is required")
	}
	if staffID == uuid.Nil {
		return models.InchargeHostel{}, fmt.Errorf("staff ID is required")
	}
	if assignedFrom.IsZero() {
		assignedFrom = time.Now().UTC()
	}
	if assignedUntil != nil && assignedUntil.Before(assignedFrom) {
		return models.InchargeHostel{}, fmt.Errorf("assigned_until must be greater than or equal to assigned_from")
	}

	var result models.InchargeHostel

	err := s.db.WithTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
		_ = tx
		if isPrimary {
			if err := s.repo.ClearPrimaryIncharge(txCtx, collegeID, hostelID); err != nil {
				return err
			}
		}

		var err error
		result, err = s.repo.CreateInchargeHostel(
			txCtx,
			collegeID,
			staffID,
			hostelID,
			assignedFrom,
			assignedUntil,
			isPrimary,
		)
		return err
	})

	if err != nil {
		return models.InchargeHostel{}, err
	}

	return result, nil
}

// Update modifies an existing incharge assignment.
func (s *InchargeService) Update(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	assignmentID uuid.UUID,
	assignedFrom time.Time,
	assignedUntil *time.Time,
	isPrimary bool,
) (models.InchargeHostel, error) {
	if collegeID == uuid.Nil {
		return models.InchargeHostel{}, fmt.Errorf("college ID is required")
	}
	if hostelID == uuid.Nil {
		return models.InchargeHostel{}, fmt.Errorf("hostel ID is required")
	}
	if assignmentID == uuid.Nil {
		return models.InchargeHostel{}, fmt.Errorf("assignment ID is required")
	}
	if assignedFrom.IsZero() {
		assignedFrom = time.Now().UTC()
	}
	if assignedUntil != nil && assignedUntil.Before(assignedFrom) {
		return models.InchargeHostel{}, fmt.Errorf("assigned_until must be greater than or equal to assigned_from")
	}

	var result models.InchargeHostel

	err := s.db.WithTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
		_ = tx
		if isPrimary {
			if err := s.repo.ClearPrimaryIncharge(txCtx, collegeID, hostelID); err != nil {
				return err
			}
		}

		var err error
		result, err = s.repo.UpdateInchargeHostel(
			txCtx,
			collegeID,
			hostelID,
			assignmentID,
			assignedFrom,
			assignedUntil,
			isPrimary,
		)
		return err
	})

	if err != nil {
		return models.InchargeHostel{}, err
	}

	return result, nil
}

// Delete removes an incharge assignment.
func (s *InchargeService) Delete(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	assignmentID uuid.UUID,
) error {
	if collegeID == uuid.Nil {
		return fmt.Errorf("college ID is required")
	}
	if hostelID == uuid.Nil {
		return fmt.Errorf("hostel ID is required")
	}
	if assignmentID == uuid.Nil {
		return fmt.Errorf("assignment ID is required")
	}

	return s.repo.DeleteInchargeHostel(ctx, collegeID, hostelID, assignmentID)
}

// CreateInchargeAccount provisions credentials and assigns a staff member with strict concurrency quota safety.
func (s *InchargeService) CreateInchargeAccount(
	ctx context.Context,
	collegeID uuid.UUID,
	input models.CreateInchargeAccountInput,
) (models.CreateInchargeAccountResult, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return models.CreateInchargeAccountResult{}, fmt.Errorf("full name is required")
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))
	if email == "" || !strings.Contains(email, "@") {
		return models.CreateInchargeAccountResult{}, fmt.Errorf("a valid institutional email address is required")
	}

	if len(input.Password) < 8 {
		return models.CreateInchargeAccountResult{}, fmt.Errorf("password must be at least 8 characters")
	}

	if input.Password != input.ConfirmPassword {
		return models.CreateInchargeAccountResult{}, fmt.Errorf("password and confirm password do not match")
	}

	if input.HostelID == uuid.Nil {
		return models.CreateInchargeAccountResult{}, fmt.Errorf("assigned hostel is required")
	}

	if collegeID == uuid.Nil {
		return models.CreateInchargeAccountResult{}, fmt.Errorf("college ID is required")
	}

	designation := strings.TrimSpace(input.Designation)
	if designation == "" {
		if input.IsPrimary {
			designation = "Primary Hostel Incharge"
		} else {
			designation = "Hostel Incharge"
		}
	}

	phone := strings.TrimSpace(input.Phone)

	// Verify hostel exists and belongs to this college
	var hostelName, hostelCode string
	err := s.repo.Executor(ctx).QueryRow(ctx, `
		SELECT name, COALESCE(code::text, '') FROM app.hostels WHERE id = $1 AND college_id = $2
	`, input.HostelID, collegeID).Scan(&hostelName, &hostelCode)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.CreateInchargeAccountResult{}, fmt.Errorf("specified hostel does not exist for this institution")
		}
		return models.CreateInchargeAccountResult{}, fmt.Errorf("failed to verify hostel: %w", err)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return models.CreateInchargeAccountResult{}, fmt.Errorf("failed to hash password: %w", err)
	}

	var result models.CreateInchargeAccountResult
	result.HostelID = input.HostelID
	result.HostelName = hostelName
	result.HostelCode = hostelCode
	result.Email = email
	result.FullName = name

	err = s.db.WithTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
		// 0. Concurrency-Safe Hostel Incharge Quota Enforcement
		var maxIncharges int
		if qErr := tx.QueryRow(txCtx, `
			SELECT COALESCE(max_incharges, 5) FROM platform.colleges WHERE college_id = $1 FOR UPDATE
		`, collegeID).Scan(&maxIncharges); qErr == nil {
			var activeInchargeCount int
			_ = tx.QueryRow(txCtx, `
				SELECT COUNT(DISTINCT ur.user_id)
				FROM platform.user_roles ur
				JOIN platform.roles r ON ur.role_id = r.role_id
				JOIN app.users u ON ur.user_id = u.user_id
				WHERE ur.college_id = $1 
				  AND r.role_code IN ('INCHARGE', 'HOSTEL_INCHARGE', 'WARDEN')
				  AND ur.status = 'ACTIVE' 
				  AND u.status = 'ACTIVE'
			`, collegeID).Scan(&activeInchargeCount)
			if activeInchargeCount >= maxIncharges {
				return fmt.Errorf("hostel incharge account limit reached for this college (limit: %d, currently active: %d). Contact Super Admin to increase quota", maxIncharges, activeInchargeCount)
			}
		}

		// 1. Check or insert into app.users
		var userID uuid.UUID
		var existingUserStatus string
		err := tx.QueryRow(txCtx, `
			SELECT user_id, status FROM app.users WHERE LOWER(email) = LOWER($1)
		`, email).Scan(&userID, &existingUserStatus)

		if err != nil && errors.Is(err, pgx.ErrNoRows) {
			userID = uuid.New()
			_, err = tx.Exec(txCtx, `
				INSERT INTO app.users (user_id, email, phone, password_hash, status)
				VALUES ($1, $2, $3, $4, 'ACTIVE')
			`, userID, email, phone, string(hash))
			if err != nil {
				return fmt.Errorf("failed to create user account: %w", err)
			}
		} else if err != nil {
			return fmt.Errorf("failed to verify existing user: %w", err)
		} else {
			_, err = tx.Exec(txCtx, `
				UPDATE app.users
				SET password_hash = $1, status = 'ACTIVE', phone = COALESCE(NULLIF($2, ''), phone), updated_at = NOW()
				WHERE user_id = $3
			`, string(hash), phone, userID)
			if err != nil {
				return fmt.Errorf("failed to update user credentials: %w", err)
			}
		}
		result.UserID = userID

		// 2. Find role_id for HOSTEL_INCHARGE or INCHARGE
		var roleID uuid.UUID
		var roleCode string
		err = tx.QueryRow(txCtx, `
			SELECT role_id, role_code FROM platform.roles 
			WHERE role_code IN ('HOSTEL_INCHARGE', 'INCHARGE')
			ORDER BY CASE WHEN role_code = 'HOSTEL_INCHARGE' THEN 1 ELSE 2 END
			LIMIT 1
		`).Scan(&roleID, &roleCode)
		if err != nil {
			roleID = uuid.New()
			roleCode = "HOSTEL_INCHARGE"
			_, err = tx.Exec(txCtx, `
				INSERT INTO platform.roles (role_id, role_code, role_name, scope, is_system_role)
				VALUES ($1, 'HOSTEL_INCHARGE', 'Hostel In-Charge', 'COLLEGE', true)
			`, roleID)
			if err != nil {
				return fmt.Errorf("failed to create hostel incharge role: %w", err)
			}
		}
		result.RoleCode = roleCode

		// 3. Upsert user_roles
		_, err = tx.Exec(txCtx, `
			INSERT INTO platform.user_roles (user_id, role_id, college_id, status)
			VALUES ($1, $2, $3, 'ACTIVE')
			ON CONFLICT (user_id, role_id, college_id) DO UPDATE
			SET status = 'ACTIVE'
		`, userID, roleID, collegeID)
		if err != nil {
			return fmt.Errorf("failed to grant incharge role to user: %w", err)
		}

		// 4. Upsert app.staff_profiles
		nameParts := strings.Fields(name)
		firstName := nameParts[0]
		lastName := ""
		if len(nameParts) > 1 {
			lastName = strings.Join(nameParts[1:], " ")
		}

		var staffID uuid.UUID
		err = tx.QueryRow(txCtx, `
			SELECT id FROM app.staff_profiles WHERE college_id = $1 AND user_id = $2
		`, collegeID, userID).Scan(&staffID)

		if err != nil && errors.Is(err, pgx.ErrNoRows) {
			staffID = uuid.New()
			var maxEmpNo int
			_ = tx.QueryRow(txCtx, `
				SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(employee_number, '\D', '', 'g'), '') AS integer)), 1000)
				FROM app.staff_profiles WHERE college_id = $1
			`, collegeID).Scan(&maxEmpNo)
			generatedEmpNo := fmt.Sprintf("INC-%04d", maxEmpNo+1)

			_, err = tx.Exec(txCtx, `
				INSERT INTO app.staff_profiles (
					id, college_id, user_id, employee_number, first_name, last_name,
					designation, department, email, phone, status
				)
				VALUES ($1, $2, $3, $4, $5, $6, $7, 'Hostel Administration', $8, $9, 'ACTIVE')
			`, staffID, collegeID, userID, generatedEmpNo, firstName, lastName, designation, email, phone)
			if err != nil {
				return fmt.Errorf("failed to create staff profile: %w", err)
			}
		} else if err != nil {
			return fmt.Errorf("failed to check staff profile: %w", err)
		} else {
			_, err = tx.Exec(txCtx, `
				UPDATE app.staff_profiles
				SET first_name = $1, last_name = $2, designation = $3, email = $4,
				    phone = COALESCE(NULLIF($5, ''), phone), status = 'ACTIVE', updated_at = NOW()
				WHERE id = $6
			`, firstName, lastName, designation, email, phone, staffID)
			if err != nil {
				return fmt.Errorf("failed to update staff profile: %w", err)
			}
		}
		result.StaffID = staffID

		// 5. Incharge Assignment
		if input.IsPrimary {
			_, err = tx.Exec(txCtx, `
				UPDATE app.incharge_hostels
				SET is_primary = false, updated_at = NOW()
				WHERE college_id = $1 AND hostel_id = $2 AND is_primary = true
			`, collegeID, input.HostelID)
			if err != nil {
				return fmt.Errorf("failed to clear previous primary incharge: %w", err)
			}
		}

		var assignmentID uuid.UUID
		err = tx.QueryRow(txCtx, `
			SELECT id FROM app.incharge_hostels 
			WHERE college_id = $1 AND hostel_id = $2 AND staff_id = $3
		`, collegeID, input.HostelID, staffID).Scan(&assignmentID)

		if err != nil && errors.Is(err, pgx.ErrNoRows) {
			assignmentID = uuid.New()
			_, err = tx.Exec(txCtx, `
				INSERT INTO app.incharge_hostels (
					id, college_id, staff_id, hostel_id, assigned_from, is_primary
				)
				VALUES ($1, $2, $3, $4, CURRENT_DATE, $5)
			`, assignmentID, collegeID, staffID, input.HostelID, input.IsPrimary)
			if err != nil {
				return fmt.Errorf("failed to create hostel assignment: %w", err)
			}
		} else if err != nil {
			return fmt.Errorf("failed to query assignment: %w", err)
		} else {
			_, err = tx.Exec(txCtx, `
				UPDATE app.incharge_hostels
				SET is_primary = $1, assigned_until = NULL, updated_at = NOW()
				WHERE id = $2 AND college_id = $3
			`, input.IsPrimary, assignmentID, collegeID)
			if err != nil {
				return fmt.Errorf("failed to update hostel assignment: %w", err)
			}
		}
		result.AssignmentID = assignmentID
		result.Message = fmt.Sprintf("Account created and assigned to %s successfully.", hostelName)
		return nil
	})

	if err != nil {
		return models.CreateInchargeAccountResult{}, err
	}

	return result, nil
}

// GetMyHostel returns the assigned facility for an authenticated in-charge user.
func (s *InchargeService) GetMyHostel(
	ctx context.Context,
	collegeID uuid.UUID,
	userID uuid.UUID,
) (*models.MyHostelResult, error) {
	if collegeID == uuid.Nil {
		return nil, fmt.Errorf("college ID is required")
	}
	if userID == uuid.Nil {
		return nil, fmt.Errorf("user ID is required")
	}

	var res models.MyHostelResult
	err := s.repo.Executor(ctx).QueryRow(ctx, `
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
			// Check if caller is college admin - return first active hostel as preview
			var isCollegeAdmin bool
			_ = s.repo.Executor(ctx).QueryRow(ctx, `
				SELECT EXISTS (
					SELECT 1 FROM platform.user_roles ur
					JOIN platform.roles r ON r.role_id = ur.role_id
					WHERE ur.user_id = $1 AND ur.college_id = $2 AND r.role_code IN ('COLLEGE_ADMIN', 'SUPER_ADMIN')
				)
			`, userID, collegeID).Scan(&isCollegeAdmin)

			if isCollegeAdmin {
				var adminRes models.MyHostelResult
				errAdmin := s.repo.Executor(ctx).QueryRow(ctx, `
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
			return nil, repository.ErrNotFound
		}
		return nil, err
	}

	return &res, nil
}

// ListHostelResidents returns all students with active bed allocations in the hostel.
func (s *InchargeService) ListHostelResidents(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
) ([]models.HostelResidentResult, error) {
	if collegeID == uuid.Nil {
		return nil, fmt.Errorf("college ID is required")
	}
	if hostelID == uuid.Nil {
		return nil, fmt.Errorf("hostel ID is required")
	}

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

	rows, err := s.repo.Executor(ctx).Query(ctx, query, collegeID, hostelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	residents := make([]models.HostelResidentResult, 0)
	for rows.Next() {
		var item models.HostelResidentResult
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

// ListVacantBeds returns available unoccupied beds in the hostel.
func (s *InchargeService) ListVacantBeds(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
) ([]models.VacantBedResult, error) {
	if collegeID == uuid.Nil {
		return nil, fmt.Errorf("college ID is required")
	}
	if hostelID == uuid.Nil {
		return nil, fmt.Errorf("hostel ID is required")
	}

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

	rows, err := s.repo.Executor(ctx).Query(ctx, query, collegeID, hostelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	beds := make([]models.VacantBedResult, 0)
	for rows.Next() {
		var item models.VacantBedResult
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

// ListUnallocatedStudents returns students pending hostel allocation.
func (s *InchargeService) ListUnallocatedStudents(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]models.UnallocatedStudentResult, error) {
	if collegeID == uuid.Nil {
		return nil, fmt.Errorf("college ID is required")
	}

	query := `
		SELECT 
			s.id,
			s.admission_number,
			COALESCE(s.roll_number, ''),
			s.first_name,
			COALESCE(s.last_name, ''),
			COALESCE(s.email::text, ''),
			COALESCE(s.phone, ''),
			COALESCE(s.gender, '')
		FROM app.students s
		WHERE s.college_id = $1
		  AND s.status = 'ACTIVE'
		  AND NOT EXISTS (
			  SELECT 1 FROM app.bed_allocations ba 
			  WHERE ba.student_id = s.id AND ba.college_id = $1 AND ba.status = 'ACTIVE'
		  )
		ORDER BY s.first_name, s.last_name
		LIMIT 100
	`

	rows, err := s.repo.Executor(ctx).Query(ctx, query, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	students := make([]models.UnallocatedStudentResult, 0)
	for rows.Next() {
		var item models.UnallocatedStudentResult
		if err := rows.Scan(
			&item.StudentID,
			&item.AdmissionNumber,
			&item.RollNumber,
			&item.FirstName,
			&item.LastName,
			&item.Email,
			&item.Phone,
			&item.Gender,
		); err != nil {
			return nil, err
		}
		item.FullName = strings.TrimSpace(item.FirstName + " " + item.LastName)
		students = append(students, item)
	}

	return students, nil
}
