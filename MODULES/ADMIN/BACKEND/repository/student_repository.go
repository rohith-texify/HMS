package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/models"
)

// ListStudents retrieves a list of students for the given college tenant.
func (r *Repository) ListStudents(ctx context.Context, collegeID uuid.UUID, params models.PaginationParams) ([]models.Student, int, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id, college_id, user_id, first_name || ' ' || COALESCE(last_name, '') as full_name,
		       roll_number, COALESCE(department_id::text, '') as department, 1 as year_of_study,
		       COALESCE(gender, '') as gender, COALESCE(email, '') as email, COALESCE(phone, '') as phone_number,
		       status, created_at, updated_at
		FROM app.students
		WHERE college_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := db.Query(ctx, query, collegeID, params.Limit, params.Offset())
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var students []models.Student
	for rows.Next() {
		var s models.Student
		var rollNo *string
		if err := rows.Scan(
			&s.ID, &s.CollegeID, &s.UserID, &s.FullName,
			&rollNo, &s.Department, &s.YearOfStudy,
			&s.Gender, &s.Email, &s.PhoneNumber,
			&s.Status, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		if rollNo != nil {
			s.RollNumber = *rollNo
		}
		students = append(students, s)
	}

	var total int
	countQuery := `SELECT COUNT(*) FROM app.students WHERE college_id = $1`
	_ = db.QueryRow(ctx, countQuery, collegeID).Scan(&total)

	return students, total, nil
}

// GetStudentByID retrieves a single student by ID.
func (r *Repository) GetStudentByID(ctx context.Context, collegeID, studentID uuid.UUID) (*models.Student, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, college_id, user_id, first_name || ' ' || COALESCE(last_name, '') as full_name,
		       COALESCE(roll_number, ''), COALESCE(department_id::text, ''), 1,
		       COALESCE(gender, ''), COALESCE(email, ''), COALESCE(phone, ''),
		       status, created_at, updated_at
		FROM app.students
		WHERE college_id = $1 AND id = $2
	`

	var s models.Student
	err = db.QueryRow(ctx, query, collegeID, studentID).Scan(
		&s.ID, &s.CollegeID, &s.UserID, &s.FullName,
		&s.RollNumber, &s.Department, &s.YearOfStudy,
		&s.Gender, &s.Email, &s.PhoneNumber,
		&s.Status, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// UpdateStudentStatus updates the enrollment status of a student.
func (r *Repository) UpdateStudentStatus(ctx context.Context, collegeID, studentID uuid.UUID, status string) error {
	db, err := r.GetDB(ctx)
	if err != nil {
		return err
	}

	query := `UPDATE app.students SET status = $1, updated_at = $2 WHERE college_id = $3 AND id = $4`
	_, err = db.Exec(ctx, query, status, time.Now().UTC(), collegeID, studentID)
	return err
}

// ListStudentParents retrieves parents linked to a student.
func (r *Repository) ListStudentParents(ctx context.Context, collegeID, studentID uuid.UUID) ([]models.Parent, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT p.id, p.college_id, p.first_name || ' ' || COALESCE(p.last_name, '') as full_name,
		       COALESCE(p.phone, '') as phone_number, p.email, p.address_line1 as address,
		       p.occupation, p.created_at, p.updated_at
		FROM app.parents p
		INNER JOIN app.student_parents sp ON sp.parent_id = p.id
		WHERE p.college_id = $1 AND sp.student_id = $2
	`

	rows, err := db.Query(ctx, query, collegeID, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var parents []models.Parent
	for rows.Next() {
		var p models.Parent
		if err := rows.Scan(
			&p.ID, &p.CollegeID, &p.FullName,
			&p.PhoneNumber, &p.Email, &p.Address,
			&p.Occupation, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		parents = append(parents, p)
	}
	return parents, nil
}
