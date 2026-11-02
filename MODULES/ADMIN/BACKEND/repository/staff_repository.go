package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/models"
)

// ListStaff returns all staff members for a college.
func (r *Repository) ListStaff(ctx context.Context, collegeID uuid.UUID) ([]models.Staff, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, college_id, user_id, first_name || ' ' || COALESCE(last_name, '') as full_name,
		       role, designation, COALESCE(email, ''), COALESCE(phone, ''), status, created_at, updated_at
		FROM app.staff
		WHERE college_id = $1
		ORDER BY first_name ASC
	`

	rows, err := db.Query(ctx, query, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var staffList []models.Staff
	for rows.Next() {
		var s models.Staff
		if err := rows.Scan(
			&s.ID, &s.CollegeID, &s.UserID, &s.FullName,
			&s.Role, &s.Designation, &s.Email, &s.PhoneNumber,
			&s.Status, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, err
		}
		staffList = append(staffList, s)
	}
	return staffList, nil
}

// ListGates returns physical gates for a college.
func (r *Repository) ListGates(ctx context.Context, collegeID uuid.UUID) ([]models.Gate, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, college_id, name, code, location, status, created_at
		FROM app.gates
		WHERE college_id = $1
		ORDER BY name ASC
	`

	rows, err := db.Query(ctx, query, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var gates []models.Gate
	for rows.Next() {
		var g models.Gate
		if err := rows.Scan(
			&g.ID, &g.CollegeID, &g.Name, &g.Code, &g.Location, &g.Status, &g.CreatedAt,
		); err != nil {
			return nil, err
		}
		gates = append(gates, g)
	}
	return gates, nil
}

// ListSecurityAssignments returns active security guard gate postings.
func (r *Repository) ListSecurityAssignments(ctx context.Context, collegeID uuid.UUID) ([]models.SecurityAssignment, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, college_id, staff_id, gate_id, shift, start_date, created_at
		FROM app.security_assignments
		WHERE college_id = $1
		ORDER BY created_at DESC
	`

	rows, err := db.Query(ctx, query, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var assignments []models.SecurityAssignment
	for rows.Next() {
		var sa models.SecurityAssignment
		if err := rows.Scan(
			&sa.ID, &sa.CollegeID, &sa.StaffID, &sa.GateID,
			&sa.Shift, &sa.StartDate, &sa.CreatedAt,
		); err != nil {
			return nil, err
		}
		assignments = append(assignments, sa)
	}
	return assignments, nil
}

