package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/yourusername/hostel-management-system/API/internal/database"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

var validStaffStatuses = map[string]bool{
	"ACTIVE":     true,
	"INACTIVE":   true,
	"SUSPENDED":  true,
	"RESIGNED":   true,
	"TERMINATED": true,
	"RETIRED":    true,
}

type CreateStaffInput struct {
	UserID           uuid.UUID
	Password         string
	ConfirmPassword  string
	RoleCode         string
	HostelID         *uuid.UUID
	EmployeeNumber   string
	FirstName        string
	MiddleName       string
	LastName         string
	Designation      string
	DepartmentID     *uuid.UUID
	Phone            string
	AlternatePhone   string
	Email            string
	JoiningDate      string
	EmploymentStatus string
}

type UpdateStaffInput struct {
	EmployeeNumber string
	FirstName      string
	MiddleName     string
	LastName       string
	Designation    string
	Phone          string
	AlternatePhone string
	Email          string
	JoiningDate    string
}

type StaffService struct {
	db   *database.Database
	repo *repository.Repository
}

func NewStaffService(db *database.Database, repo *repository.Repository) *StaffService {
	return &StaffService{db: db, repo: repo}
}

func (s *StaffService) List(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]repository.StaffProfile, error) {
	if collegeID == uuid.Nil {
		return nil, fmt.Errorf("college ID is required")
	}

	return s.repo.ListStaffProfiles(ctx, collegeID)
}

func (s *StaffService) Get(
	ctx context.Context,
	collegeID uuid.UUID,
	staffID uuid.UUID,
) (repository.StaffProfile, error) {
	if collegeID == uuid.Nil {
		return repository.StaffProfile{}, fmt.Errorf("college ID is required")
	}

	if staffID == uuid.Nil {
		return repository.StaffProfile{}, fmt.Errorf("staff ID is required")
	}

	return s.repo.GetStaffProfile(ctx, collegeID, staffID)
}

func (s *StaffService) Create(
	ctx context.Context,
	collegeID uuid.UUID,
	input CreateStaffInput,
) (repository.StaffProfile, error) {
	if collegeID == uuid.Nil {
		return repository.StaffProfile{}, fmt.Errorf("college ID is required")
	}

	input.FirstName = strings.TrimSpace(input.FirstName)
	if input.FirstName == "" {
		return repository.StaffProfile{}, fmt.Errorf("first name is required")
	}

	input.Email = strings.TrimSpace(input.Email)
	input.EmploymentStatus = strings.ToUpper(strings.TrimSpace(input.EmploymentStatus))
	if input.EmploymentStatus == "" {
		input.EmploymentStatus = "ACTIVE"
	}
	if !validStaffStatuses[input.EmploymentStatus] {
		return repository.StaffProfile{}, fmt.Errorf("invalid employment_status")
	}

	// If password is provided (or if user_id is nil), execute full account creation workflow
	if input.Password != "" || input.UserID == uuid.Nil {
		if input.Email == "" {
			return repository.StaffProfile{}, fmt.Errorf("institutional email is required to create a staff account")
		}
		if len(input.Password) < 8 {
			return repository.StaffProfile{}, fmt.Errorf("password must be at least 8 characters long")
		}
		if input.ConfirmPassword != "" && input.Password != input.ConfirmPassword {
			return repository.StaffProfile{}, fmt.Errorf("password and confirm password do not match")
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
		if err != nil {
			return repository.StaffProfile{}, fmt.Errorf("failed to hash password: %w", err)
		}

		if strings.TrimSpace(input.EmployeeNumber) == "" {
			input.EmployeeNumber = fmt.Sprintf("EMP-%d", (time.Now().UnixNano()/1000000)%90000+10000)
		}

		var createdProfile repository.StaffProfile
		txErr := s.db.WithTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
			// 1. Check or insert into app.users
			var userID uuid.UUID
			err := tx.QueryRow(txCtx, `
				SELECT user_id FROM app.users WHERE LOWER(email) = LOWER($1)
			`, input.Email).Scan(&userID)

			if err != nil && errors.Is(err, pgx.ErrNoRows) {
				userID = uuid.New()
				_, err = tx.Exec(txCtx, `
					INSERT INTO app.users (user_id, email, phone, password_hash, status)
					VALUES ($1, $2, $3, $4, 'ACTIVE')
				`, userID, input.Email, input.Phone, string(hash))
				if err != nil {
					return fmt.Errorf("failed to create staff user account: %w", err)
				}
			} else if err != nil {
				return fmt.Errorf("failed to check existing user: %w", err)
			} else {
				_, err = tx.Exec(txCtx, `
					UPDATE app.users
					SET password_hash = $1, status = 'ACTIVE', phone = COALESCE(NULLIF($2, ''), phone), updated_at = NOW()
					WHERE user_id = $3
				`, string(hash), input.Phone, userID)
				if err != nil {
					return fmt.Errorf("failed to update user credentials: %w", err)
				}
			}

			// 2. Determine and assign Role
			roleCode := strings.ToUpper(strings.TrimSpace(input.RoleCode))
			if roleCode == "" {
				desigLower := strings.ToLower(input.Designation)
				if strings.Contains(desigLower, "warden") || strings.Contains(desigLower, "incharge") {
					roleCode = "HOSTEL_INCHARGE"
				} else if strings.Contains(desigLower, "security") || strings.Contains(desigLower, "guard") {
					roleCode = "SECURITY"
				} else {
					roleCode = "HOSTEL_STAFF"
				}
			} else if roleCode == "SECURITY_GUARD" {
				roleCode = "SECURITY"
			}

			var roleID uuid.UUID
			err = tx.QueryRow(txCtx, `
				SELECT role_id FROM platform.roles WHERE role_code = $1
			`, roleCode).Scan(&roleID)
			if err != nil {
				roleID = uuid.New()
				_, err = tx.Exec(txCtx, `
					INSERT INTO platform.roles (role_id, role_code, role_name, scope, is_system_role)
					VALUES ($1, $2, $3, 'COLLEGE', true)
					ON CONFLICT (role_code) DO NOTHING
				`, roleID, roleCode, input.Designation)
				if err != nil {
					return fmt.Errorf("failed to ensure role: %w", err)
				}
				_ = tx.QueryRow(txCtx, `SELECT role_id FROM platform.roles WHERE role_code = $1`, roleCode).Scan(&roleID)
			}

			_, err = tx.Exec(txCtx, `
				INSERT INTO platform.user_roles (user_role_id, user_id, role_id, college_id, status)
				VALUES (gen_random_uuid(), $1, $2, $3, 'ACTIVE')
				ON CONFLICT DO NOTHING
			`, userID, roleID, collegeID)
			if err != nil {
				return fmt.Errorf("failed to grant staff role: %w", err)
			}

			// 3. Staff Profile
			var staffID uuid.UUID
			err = tx.QueryRow(txCtx, `
				SELECT id FROM app.staff_profiles WHERE college_id = $1 AND user_id = $2
			`, collegeID, userID).Scan(&staffID)

			if err != nil && errors.Is(err, pgx.ErrNoRows) {
				staffID = uuid.New()
				err = tx.QueryRow(txCtx, `
					INSERT INTO app.staff_profiles (
						id, college_id, user_id, employee_number, first_name, middle_name, last_name,
						designation, department_id, phone, alternate_phone, email,
						joining_date, employment_status
					)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE(NULLIF($13, '')::date, CURRENT_DATE), $14)
					RETURNING id, college_id, user_id, employee_number, first_name, middle_name, last_name,
					          designation, department_id, phone, alternate_phone, email::text, joining_date, employment_status, metadata, created_at, updated_at
				`, staffID, collegeID, userID, input.EmployeeNumber, input.FirstName, input.MiddleName, input.LastName,
					input.Designation, input.DepartmentID, input.Phone, input.AlternatePhone, input.Email,
					input.JoiningDate, input.EmploymentStatus).Scan(
					&createdProfile.ID, &createdProfile.CollegeID, &createdProfile.UserID, &createdProfile.EmployeeNumber,
					&createdProfile.FirstName, &createdProfile.MiddleName, &createdProfile.LastName,
					&createdProfile.Designation, &createdProfile.DepartmentID, &createdProfile.Phone,
					&createdProfile.AlternatePhone, &createdProfile.Email, &createdProfile.JoiningDate,
					&createdProfile.EmploymentStatus, &createdProfile.Metadata, &createdProfile.CreatedAt, &createdProfile.UpdatedAt,
				)
				if err != nil {
					return fmt.Errorf("failed to create staff profile: %w", err)
				}
			} else if err != nil {
				return fmt.Errorf("failed to check existing staff profile: %w", err)
			} else {
				err = tx.QueryRow(txCtx, `
					UPDATE app.staff_profiles
					SET first_name = $1, middle_name = $2, last_name = $3, designation = $4,
					    phone = COALESCE(NULLIF($5, ''), phone), alternate_phone = COALESCE(NULLIF($6, ''), alternate_phone),
					    email = $7, employment_status = $8, updated_at = NOW()
					WHERE id = $9 AND college_id = $10
					RETURNING id, college_id, user_id, employee_number, first_name, middle_name, last_name,
					          designation, department_id, phone, alternate_phone, email::text, joining_date, employment_status, metadata, created_at, updated_at
				`, input.FirstName, input.MiddleName, input.LastName, input.Designation,
					input.Phone, input.AlternatePhone, input.Email, input.EmploymentStatus, staffID, collegeID).Scan(
					&createdProfile.ID, &createdProfile.CollegeID, &createdProfile.UserID, &createdProfile.EmployeeNumber,
					&createdProfile.FirstName, &createdProfile.MiddleName, &createdProfile.LastName,
					&createdProfile.Designation, &createdProfile.DepartmentID, &createdProfile.Phone,
					&createdProfile.AlternatePhone, &createdProfile.Email, &createdProfile.JoiningDate,
					&createdProfile.EmploymentStatus, &createdProfile.Metadata, &createdProfile.CreatedAt, &createdProfile.UpdatedAt,
				)
				if err != nil {
					return fmt.Errorf("failed to update staff profile: %w", err)
				}
			}

			// 4. Incharge Hostel assignment if provided
			if input.HostelID != nil && *input.HostelID != uuid.Nil {
				var existingAssignmentID uuid.UUID
				errAss := tx.QueryRow(txCtx, `
					SELECT id FROM app.incharge_hostels WHERE college_id = $1 AND staff_id = $2 AND hostel_id = $3
				`, collegeID, staffID, *input.HostelID).Scan(&existingAssignmentID)
				if errAss != nil && errors.Is(errAss, pgx.ErrNoRows) {
					_, err = tx.Exec(txCtx, `
						INSERT INTO app.incharge_hostels (id, college_id, staff_id, hostel_id, assigned_from, is_primary)
						VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_DATE, true)
					`, collegeID, staffID, *input.HostelID)
					if err != nil {
						return fmt.Errorf("failed to assign staff to hostel: %w", err)
					}
				}
			}

			return nil
		})

		if txErr != nil {
			return repository.StaffProfile{}, txErr
		}
		return createdProfile, nil
	}

	if input.UserID == uuid.Nil {
		return repository.StaffProfile{}, fmt.Errorf("user ID or password is required")
	}

	var parsedJoiningDate *string
	if input.JoiningDate != "" {
		parsedJoiningDate = &input.JoiningDate
	}
	_ = parsedJoiningDate

	return s.repo.CreateStaffProfile(
		ctx,
		collegeID,
		input.UserID,
		input.EmployeeNumber,
		input.FirstName,
		input.MiddleName,
		input.LastName,
		input.Designation,
		input.DepartmentID,
		input.Phone,
		input.AlternatePhone,
		input.Email,
		nil,
		input.EmploymentStatus,
		map[string]interface{}{},
	)
}

func (s *StaffService) Update(
	ctx context.Context,
	collegeID uuid.UUID,
	staffID uuid.UUID,
	input UpdateStaffInput,
) (repository.StaffProfile, error) {
	if collegeID == uuid.Nil {
		return repository.StaffProfile{}, fmt.Errorf("college ID is required")
	}

	if staffID == uuid.Nil {
		return repository.StaffProfile{}, fmt.Errorf("staff ID is required")
	}

	input.FirstName = strings.TrimSpace(input.FirstName)

	if input.FirstName == "" {
		return repository.StaffProfile{}, fmt.Errorf("first name is required")
	}

	return s.repo.UpdateStaffProfile(
		ctx,
		collegeID,
		staffID,
		input.FirstName,
		input.MiddleName,
		input.LastName,
		input.Designation,
		input.Phone,
		input.AlternatePhone,
		input.Email,
	)
}

func (s *StaffService) UpdateStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	staffID uuid.UUID,
	status string,
) (repository.StaffProfile, error) {
	if collegeID == uuid.Nil {
		return repository.StaffProfile{}, fmt.Errorf("college ID is required")
	}

	if staffID == uuid.Nil {
		return repository.StaffProfile{}, fmt.Errorf("staff ID is required")
	}

	status = strings.ToUpper(strings.TrimSpace(status))

	if !validStaffStatuses[status] {
		return repository.StaffProfile{}, fmt.Errorf(
			"invalid employment_status",
		)
	}

	return s.repo.UpdateStaffStatus(
		ctx,
		collegeID,
		staffID,
		status,
	)
}

func (s *StaffService) ResetPassword(
	ctx context.Context,
	collegeID uuid.UUID,
	staffID uuid.UUID,
	newPassword string,
) error {
	if collegeID == uuid.Nil {
		return fmt.Errorf("college ID is required")
	}

	if staffID == uuid.Nil {
		return fmt.Errorf("staff ID is required")
	}

	if len(newPassword) < 8 {
		return fmt.Errorf("password must be at least 8 characters")
	}

	profile, err := s.repo.GetStaffProfile(ctx, collegeID, staffID)
	if err != nil {
		return err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	query := `UPDATE app.users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2`
	commandTag, err := s.repo.Executor(ctx).Exec(ctx, query, string(hash), profile.UserID)
	if err != nil {
		return fmt.Errorf("failed to update user password: %w", err)
	}

	if commandTag.RowsAffected() == 0 {
		return fmt.Errorf("user account not found")
	}

	return nil
}
