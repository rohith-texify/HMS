package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type AttendanceStatus string

const (
	AttendanceStatusPresent AttendanceStatus = "PRESENT"
	AttendanceStatusAbsent  AttendanceStatus = "ABSENT"
	AttendanceStatusLate    AttendanceStatus = "LATE"
	AttendanceStatusOnLeave AttendanceStatus = "ON_LEAVE"
	AttendanceStatusExcused AttendanceStatus = "EXCUSED"
	AttendanceStatusHoliday AttendanceStatus = "HOLIDAY"
)

type ScanMethod string

const (
	ScanMethodQR      ScanMethod = "QR"
	ScanMethodBarcode ScanMethod = "BARCODE"
	ScanMethodManual  ScanMethod = "MANUAL"
	ScanMethodSystem  ScanMethod = "SYSTEM"
)

type AttendanceRecord struct {
	ID             uuid.UUID        `json:"id"`
	CollegeID      uuid.UUID        `json:"college_id"`
	StudentID      uuid.UUID        `json:"student_id"`
	CardID         *uuid.UUID       `json:"card_id,omitempty"`
	AttendanceDate time.Time        `json:"attendance_date"`
	RecordedAt     time.Time        `json:"recorded_at"`
	Status         AttendanceStatus `json:"status"`
	ScanMethod     ScanMethod       `json:"scan_method"`
	RecordedBy     *uuid.UUID       `json:"recorded_by,omitempty"`
	IsCorrected    bool             `json:"is_corrected"`
	Remarks        *string          `json:"remarks,omitempty"`
	CreatedAt      time.Time        `json:"created_at"`
	UpdatedAt      time.Time        `json:"updated_at"`
}

type RecordCorrectionStatus string

const (
	CorrectionStatusPending   RecordCorrectionStatus = "PENDING"
	CorrectionStatusApproved  RecordCorrectionStatus = "APPROVED"
	CorrectionStatusRejected  RecordCorrectionStatus = "REJECTED"
	CorrectionStatusCancelled RecordCorrectionStatus = "CANCELLED"
)

type RecordCorrection struct {
	ID               uuid.UUID              `json:"id"`
	CollegeID        uuid.UUID              `json:"college_id"`
	RecordType       string                 `json:"record_type"` // ATTENDANCE or ENTRY_EXIT
	RecordID         uuid.UUID              `json:"record_id"`
	RequestedBy      uuid.UUID              `json:"requested_by"`
	ApprovedBy       *uuid.UUID             `json:"approved_by,omitempty"`
	CorrectionReason string                 `json:"correction_reason"`
	OldValues        string                 `json:"old_values"` // JSONB
	NewValues        string                 `json:"new_values"` // JSONB
	Status           RecordCorrectionStatus `json:"status"`
	RequestedAt      time.Time              `json:"requested_at"`
	DecidedAt        *time.Time             `json:"decided_at,omitempty"`
	DecisionReason   *string                `json:"decision_reason,omitempty"`
	CreatedAt        time.Time              `json:"created_at"`
	UpdatedAt        time.Time              `json:"updated_at"`
}

var ErrAttendanceNotFound = ErrNotFound
var ErrCorrectionNotFound = ErrNotFound

// Attendance filters
type ListAttendanceParams struct {
	CollegeID uuid.UUID
	StudentID *uuid.UUID
	StartDate *time.Time
	EndDate   *time.Time
	Status    *string
	Limit     int
	Offset    int
}

// Reports
type AttendanceSummary struct {
	Total   int `json:"total"`
	Present int `json:"present"`
	Absent  int `json:"absent"`
	Late    int `json:"late"`
	OnLeave int `json:"on_leave"`
	Excused int `json:"excused"`
	Holiday int `json:"holiday"`
}

// CreateStudentAttendance creates a single attendance record
func (r *Repository) CreateStudentAttendance(ctx context.Context, record *AttendanceRecord) error {
	query := `
		INSERT INTO app.attendance_records (
			college_id, student_id, card_id, attendance_date, recorded_at,
			status, scan_method, recorded_by, is_corrected, remarks
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10
		) RETURNING id, created_at, updated_at
	`
	err := r.Executor(ctx).QueryRow(ctx, query,
		record.CollegeID, record.StudentID, record.CardID, record.AttendanceDate, record.RecordedAt,
		record.Status, record.ScanMethod, record.RecordedBy, record.IsCorrected, record.Remarks,
	).Scan(&record.ID, &record.CreatedAt, &record.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create attendance record: %w", err)
	}
	return nil
}

// BulkCreateStudentAttendance inserts multiple attendance records atomically
func (r *Repository) BulkCreateStudentAttendance(ctx context.Context, records []AttendanceRecord) error {
	if len(records) == 0 {
		return nil
	}

	query := `
		INSERT INTO app.attendance_records (
			id, college_id, student_id, card_id, attendance_date, recorded_at,
			status, scan_method, recorded_by, is_corrected, remarks, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now()
		)
	`

	for _, rec := range records {
		id := rec.ID
		if id == uuid.Nil {
			id = uuid.New()
		}

		_, err := r.Executor(ctx).Exec(ctx, query,
			id, rec.CollegeID, rec.StudentID, rec.CardID, rec.AttendanceDate, rec.RecordedAt,
			rec.Status, rec.ScanMethod, rec.RecordedBy, rec.IsCorrected, rec.Remarks,
		)
		if err != nil {
			return fmt.Errorf("failed to bulk insert attendance record: %w", err)
		}
	}

	return nil
}

func (r *Repository) GetStudentAttendance(ctx context.Context, collegeID uuid.UUID, id uuid.UUID) (*AttendanceRecord, error) {
	query := `
		SELECT id, college_id, student_id, card_id, attendance_date, recorded_at,
			status, scan_method, recorded_by, is_corrected, remarks, created_at, updated_at
		FROM app.attendance_records
		WHERE college_id = $1 AND id = $2
	`
	var rec AttendanceRecord
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID, id).Scan(
		&rec.ID, &rec.CollegeID, &rec.StudentID, &rec.CardID, &rec.AttendanceDate, &rec.RecordedAt,
		&rec.Status, &rec.ScanMethod, &rec.RecordedBy, &rec.IsCorrected, &rec.Remarks, &rec.CreatedAt, &rec.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAttendanceNotFound
		}
		return nil, err
	}
	return &rec, nil
}

func (r *Repository) GetAttendanceByStudentAndDate(ctx context.Context, collegeID uuid.UUID, studentID uuid.UUID, date time.Time) (*AttendanceRecord, error) {
	query := `
		SELECT id, college_id, student_id, card_id, attendance_date, recorded_at,
			status, scan_method, recorded_by, is_corrected, remarks, created_at, updated_at
		FROM app.attendance_records
		WHERE college_id = $1 AND student_id = $2 AND attendance_date = $3
	`
	var rec AttendanceRecord
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID, studentID, date).Scan(
		&rec.ID, &rec.CollegeID, &rec.StudentID, &rec.CardID, &rec.AttendanceDate, &rec.RecordedAt,
		&rec.Status, &rec.ScanMethod, &rec.RecordedBy, &rec.IsCorrected, &rec.Remarks, &rec.CreatedAt, &rec.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAttendanceNotFound
		}
		return nil, err
	}
	return &rec, nil
}

func (r *Repository) UpdateStudentAttendance(ctx context.Context, record *AttendanceRecord) error {
	query := `
		UPDATE app.attendance_records
		SET status = $1, is_corrected = $2, remarks = $3, updated_at = now()
		WHERE id = $4 AND college_id = $5
		RETURNING updated_at
	`
	err := r.Executor(ctx).QueryRow(ctx, query, record.Status, record.IsCorrected, record.Remarks, record.ID, record.CollegeID).Scan(&record.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrAttendanceNotFound
		}
		return err
	}
	return nil
}

func (r *Repository) ListStudentAttendance(ctx context.Context, p ListAttendanceParams) ([]AttendanceRecord, error) {
	query := `
		SELECT id, college_id, student_id, card_id, attendance_date, recorded_at,
			status, scan_method, recorded_by, is_corrected, remarks, created_at, updated_at
		FROM app.attendance_records
		WHERE college_id = $1
	`
	args := []interface{}{p.CollegeID}
	argIdx := 2

	if p.StudentID != nil {
		query += fmt.Sprintf(" AND student_id = $%d", argIdx)
		args = append(args, *p.StudentID)
		argIdx++
	}

	if p.StartDate != nil {
		query += fmt.Sprintf(" AND attendance_date >= $%d", argIdx)
		args = append(args, *p.StartDate)
		argIdx++
	}

	if p.EndDate != nil {
		query += fmt.Sprintf(" AND attendance_date <= $%d", argIdx)
		args = append(args, *p.EndDate)
		argIdx++
	}

	if p.Status != nil {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *p.Status)
		argIdx++
	}

	query += " ORDER BY attendance_date DESC"

	if p.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIdx)
		args = append(args, p.Limit)
		argIdx++
	}

	if p.Offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argIdx)
		args = append(args, p.Offset)
		argIdx++
	}

	rows, err := r.Executor(ctx).Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []AttendanceRecord
	for rows.Next() {
		var rec AttendanceRecord
		err := rows.Scan(
			&rec.ID, &rec.CollegeID, &rec.StudentID, &rec.CardID, &rec.AttendanceDate, &rec.RecordedAt,
			&rec.Status, &rec.ScanMethod, &rec.RecordedBy, &rec.IsCorrected, &rec.Remarks, &rec.CreatedAt, &rec.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		records = append(records, rec)
	}

	return records, nil
}

func (r *Repository) GetAttendanceSummary(ctx context.Context, collegeID uuid.UUID, startDate, endDate time.Time) (*AttendanceSummary, error) {
	query := `
		SELECT 
			COUNT(*) as total,
			COUNT(*) FILTER (WHERE status = 'PRESENT') as present,
			COUNT(*) FILTER (WHERE status = 'ABSENT') as absent,
			COUNT(*) FILTER (WHERE status = 'LATE') as late,
			COUNT(*) FILTER (WHERE status = 'ON_LEAVE') as on_leave,
			COUNT(*) FILTER (WHERE status = 'EXCUSED') as excused,
			COUNT(*) FILTER (WHERE status = 'HOLIDAY') as holiday
		FROM app.attendance_records
		WHERE college_id = $1 AND attendance_date >= $2 AND attendance_date <= $3
	`
	var summary AttendanceSummary
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID, startDate, endDate).Scan(
		&summary.Total, &summary.Present, &summary.Absent, &summary.Late,
		&summary.OnLeave, &summary.Excused, &summary.Holiday,
	)
	if err != nil {
		return nil, err
	}
	return &summary, nil
}

func (r *Repository) CreateRecordCorrection(ctx context.Context, corr *RecordCorrection) error {
	query := `
		INSERT INTO app.record_corrections (
			college_id, record_type, record_id, requested_by, approved_by,
			correction_reason, old_values, new_values, status, requested_at,
			decided_at, decision_reason
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10,
			$11, $12
		) RETURNING id, created_at, updated_at
	`
	err := r.Executor(ctx).QueryRow(ctx, query,
		corr.CollegeID, corr.RecordType, corr.RecordID, corr.RequestedBy, corr.ApprovedBy,
		corr.CorrectionReason, corr.OldValues, corr.NewValues, corr.Status, corr.RequestedAt,
		corr.DecidedAt, corr.DecisionReason,
	).Scan(&corr.ID, &corr.CreatedAt, &corr.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create record correction: %w", err)
	}
	return nil
}

func (r *Repository) UpdateRecordCorrection(ctx context.Context, corr *RecordCorrection) error {
	query := `
		UPDATE app.record_corrections
		SET status = $1, approved_by = $2, decided_at = $3, decision_reason = $4, updated_at = now()
		WHERE id = $5 AND college_id = $6
		RETURNING updated_at
	`
	err := r.Executor(ctx).QueryRow(ctx, query,
		corr.Status, corr.ApprovedBy, corr.DecidedAt, corr.DecisionReason,
		corr.ID, corr.CollegeID,
	).Scan(&corr.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrCorrectionNotFound
		}
		return err
	}
	return nil
}

func (r *Repository) GetRecordCorrection(ctx context.Context, collegeID uuid.UUID, id uuid.UUID) (*RecordCorrection, error) {
	query := `
		SELECT id, college_id, record_type, record_id, requested_by, approved_by,
			correction_reason, old_values, new_values, status, requested_at,
			decided_at, decision_reason, created_at, updated_at
		FROM app.record_corrections
		WHERE college_id = $1 AND id = $2
	`
	var corr RecordCorrection
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID, id).Scan(
		&corr.ID, &corr.CollegeID, &corr.RecordType, &corr.RecordID, &corr.RequestedBy, &corr.ApprovedBy,
		&corr.CorrectionReason, &corr.OldValues, &corr.NewValues, &corr.Status, &corr.RequestedAt,
		&corr.DecidedAt, &corr.DecisionReason, &corr.CreatedAt, &corr.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCorrectionNotFound
		}
		return nil, err
	}
	return &corr, nil
}
