package services

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/MODULES/HOSTEL-INCHARGE/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/HOSTEL-INCHARGE/BACKEND/repository"
)

// InchargeService coordinates domain operations for Hostel In-Charge personnel.
type InchargeService struct {
	db   *database.Database
	repo *repository.Repository
}

// NewInchargeService instantiates a new InchargeService.
func NewInchargeService(db *database.Database, repo *repository.Repository) *InchargeService {
	return &InchargeService{
		db:   db,
		repo: repo,
	}
}

// GetMyHostel resolves the verified active hostel assignment for the incharge.
func (s *InchargeService) GetMyHostel(
	ctx context.Context,
	collegeID, userID uuid.UUID,
) (*models.MyHostelProfile, error) {
	if collegeID == uuid.Nil {
		return nil, errors.New("college ID is required")
	}
	if userID == uuid.Nil {
		return nil, errors.New("user ID is required")
	}
	return s.repo.GetMyHostel(ctx, collegeID, userID)
}

// ListResidents returns active residents in the assigned hostel.
func (s *InchargeService) ListResidents(
	ctx context.Context,
	collegeID, hostelID uuid.UUID,
) ([]models.ResidentStudent, error) {
	if collegeID == uuid.Nil || hostelID == uuid.Nil {
		return nil, errors.New("valid college and hostel IDs are required")
	}
	return s.repo.ListHostelResidents(ctx, collegeID, hostelID)
}

// ListVacantBeds returns all unoccupied beds in the assigned hostel.
func (s *InchargeService) ListVacantBeds(
	ctx context.Context,
	collegeID, hostelID uuid.UUID,
) ([]models.VacantBed, error) {
	if collegeID == uuid.Nil || hostelID == uuid.Nil {
		return nil, errors.New("valid college and hostel IDs are required")
	}
	return s.repo.ListVacantBeds(ctx, collegeID, hostelID)
}

// ListUnallocatedStudents returns enrolled college students awaiting hostel placement.
func (s *InchargeService) ListUnallocatedStudents(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]models.UnallocatedStudent, error) {
	if collegeID == uuid.Nil {
		return nil, errors.New("valid college ID is required")
	}
	return s.repo.ListUnallocatedStudents(ctx, collegeID)
}

// GetDashboardSummary retrieves live occupancy and operations KPIs for the hostel.
func (s *InchargeService) GetDashboardSummary(
	ctx context.Context,
	collegeID, hostelID uuid.UUID,
) (*models.InchargeDashboardSummary, error) {
	if collegeID == uuid.Nil || hostelID == uuid.Nil {
		return nil, errors.New("valid college and hostel IDs are required")
	}
	return s.repo.GetDashboardSummary(ctx, collegeID, hostelID)
}

// ListHostelIncharges lists all staff assigned to a given hostel.
func (s *InchargeService) ListHostelIncharges(
	ctx context.Context,
	collegeID, hostelID uuid.UUID,
) ([]models.InchargeHostelAssignment, error) {
	if collegeID == uuid.Nil || hostelID == uuid.Nil {
		return nil, errors.New("valid college and hostel IDs are required")
	}
	return s.repo.ListInchargeHostels(ctx, collegeID, hostelID)
}

// CreateInchargeAccount handles atomic staff creation, user provisioning, and hostel assignment.
func (s *InchargeService) CreateInchargeAccount(
	ctx context.Context,
	collegeID uuid.UUID,
	input models.CreateInchargeAccountInput,
) (map[string]interface{}, error) {
	if input.Email == "" || !strings.Contains(input.Email, "@") {
		return nil, errors.New("a valid institutional email address is required")
	}
	if len(input.Password) < 8 {
		return nil, errors.New("password must be at least 8 characters")
	}
	if input.Password != input.ConfirmPassword {
		return nil, errors.New("passwords do not match")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	tx, err := s.repo.CollegePool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	txCtx := repository.WithTx(ctx, tx)

	// 1. Create or resolve user
	var userID uuid.UUID
	err = s.repo.Executor(txCtx).QueryRow(txCtx, `
		INSERT INTO app.users (user_id, email, password_hash, status, created_at, updated_at)
		VALUES (gen_random_uuid(), LOWER($1), $2, 'ACTIVE', NOW(), NOW())
		ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
		RETURNING user_id
	`, input.Email, string(hash)).Scan(&userID)
	if err != nil {
		return nil, fmt.Errorf("failed to create user account: %w", err)
	}

	// 2. Assign INCHARGE role in platform.user_roles
	_, err = s.repo.Executor(txCtx).Exec(txCtx, `
		INSERT INTO platform.user_roles (user_role_id, user_id, role_id, college_id, status, created_at, updated_at)
		SELECT gen_random_uuid(), $1, r.role_id, $2, 'ACTIVE', NOW(), NOW()
		FROM platform.roles r
		WHERE r.role_code IN ('HOSTEL_INCHARGE', 'INCHARGE')
		LIMIT 1
		ON CONFLICT DO NOTHING
	`, userID, collegeID)
	if err != nil {
		return nil, fmt.Errorf("failed to assign incharge role: %w", err)
	}

	// 3. Create staff profile
	var staffID uuid.UUID
	designation := input.Designation
	if designation == "" {
		designation = "Hostel Incharge"
	}
	err = s.repo.Executor(txCtx).QueryRow(txCtx, `
		INSERT INTO app.staff_profiles (id, college_id, user_id, first_name, designation, phone, employment_status, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'ACTIVE', NOW(), NOW())
		RETURNING id
	`, collegeID, userID, input.Name, designation, input.Phone).Scan(&staffID)
	if err != nil {
		return nil, fmt.Errorf("failed to create staff profile: %w", err)
	}

	// 4. Create incharge hostel assignment
	var assignmentID uuid.UUID
	err = s.repo.Executor(txCtx).QueryRow(txCtx, `
		INSERT INTO app.incharge_hostels (id, college_id, staff_id, hostel_id, assigned_from, is_primary, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_DATE, $4, NOW(), NOW())
		RETURNING id
	`, collegeID, staffID, input.HostelID, input.IsPrimary).Scan(&assignmentID)
	if err != nil {
		return nil, fmt.Errorf("failed to link hostel assignment: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return map[string]interface{}{
		"assignment_id": assignmentID,
		"staff_id":      staffID,
		"user_id":       userID,
		"email":         input.Email,
		"message":       "Hostel In-Charge account successfully created and assigned.",
	}, nil
}
