package service

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/yourusername/hostel-management-system/API/internal/database"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

var (
	ErrDuplicateAttendance = errors.New("attendance record already exists for this student on this date")
	ErrInvalidStatus       = errors.New("invalid attendance status")
	ErrInvalidScanMethod   = errors.New("invalid scan method")
)

type AttendanceService struct {
	db   *database.Database
	repo *repository.Repository
}

func NewAttendanceService(db *database.Database, repo *repository.Repository) *AttendanceService {
	return &AttendanceService{
		db:   db,
		repo: repo,
	}
}

type MarkAttendanceRequest struct {
	StudentID      uuid.UUID  `json:"student_id" binding:"required"`
	CardID         *uuid.UUID `json:"card_id"`
	AttendanceDate time.Time  `json:"attendance_date" binding:"required"`
	Status         string     `json:"status" binding:"required"`
	ScanMethod     string     `json:"scan_method" binding:"required"`
	Remarks        *string    `json:"remarks"`
}

type BulkMarkAttendanceRequest struct {
	Records []MarkAttendanceRequest `json:"records" binding:"required,dive"`
}

type CorrectionRequest struct {
	RecordID         uuid.UUID `json:"record_id" binding:"required"`
	CorrectionReason string    `json:"correction_reason" binding:"required"`
	NewStatus        string    `json:"new_status" binding:"required"`
	Remarks          *string   `json:"remarks"`
}

type CorrectionDecisionRequest struct {
	Decision       string  `json:"decision" binding:"required,oneof=APPROVED REJECTED"`
	DecisionReason *string `json:"decision_reason"`
}

func isValidStatus(s string) bool {
	switch repository.AttendanceStatus(s) {
	case repository.AttendanceStatusPresent, repository.AttendanceStatusAbsent,
		repository.AttendanceStatusLate, repository.AttendanceStatusOnLeave,
		repository.AttendanceStatusExcused, repository.AttendanceStatusHoliday:
		return true
	}
	return false
}

func isValidScanMethod(s string) bool {
	switch repository.ScanMethod(s) {
	case repository.ScanMethodQR, repository.ScanMethodBarcode,
		repository.ScanMethodManual, repository.ScanMethodSystem:
		return true
	}
	return false
}

func (s *AttendanceService) MarkStudentAttendance(ctx context.Context, collegeID, recordedBy uuid.UUID, req MarkAttendanceRequest) (*repository.AttendanceRecord, error) {
	if !isValidStatus(req.Status) {
		return nil, ErrInvalidStatus
	}
	if !isValidScanMethod(req.ScanMethod) {
		return nil, ErrInvalidScanMethod
	}

	// Check duplicate
	existing, err := s.repo.GetAttendanceByStudentAndDate(ctx, collegeID, req.StudentID, req.AttendanceDate)
	if err == nil && existing != nil {
		return nil, ErrDuplicateAttendance
	}

	record := &repository.AttendanceRecord{
		CollegeID:      collegeID,
		StudentID:      req.StudentID,
		CardID:         req.CardID,
		AttendanceDate: req.AttendanceDate,
		RecordedAt:     time.Now().UTC(),
		Status:         repository.AttendanceStatus(req.Status),
		ScanMethod:     repository.ScanMethod(req.ScanMethod),
		RecordedBy:     &recordedBy,
		IsCorrected:    false,
		Remarks:        req.Remarks,
	}

	if err := s.repo.CreateStudentAttendance(ctx, record); err != nil {
		return nil, err
	}

	return record, nil
}

func (s *AttendanceService) BulkMarkStudentAttendance(ctx context.Context, collegeID, recordedBy uuid.UUID, req BulkMarkAttendanceRequest) error {
	return s.db.WithTransaction(ctx, func(ctx context.Context, tx pgx.Tx) error {
		var records []repository.AttendanceRecord
		now := time.Now().UTC()

		for _, item := range req.Records {
			if !isValidStatus(item.Status) {
				return ErrInvalidStatus
			}
			if !isValidScanMethod(item.ScanMethod) {
				return ErrInvalidScanMethod
			}
			records = append(records, repository.AttendanceRecord{
				CollegeID:      collegeID,
				StudentID:      item.StudentID,
				CardID:         item.CardID,
				AttendanceDate: item.AttendanceDate,
				RecordedAt:     now,
				Status:         repository.AttendanceStatus(item.Status),
				ScanMethod:     repository.ScanMethod(item.ScanMethod),
				RecordedBy:     &recordedBy,
				IsCorrected:    false,
				Remarks:        item.Remarks,
			})
		}

		return s.repo.BulkCreateStudentAttendance(ctx, records)
	})
}

func (s *AttendanceService) GetStudentAttendance(ctx context.Context, collegeID, id uuid.UUID) (*repository.AttendanceRecord, error) {
	return s.repo.GetStudentAttendance(ctx, collegeID, id)
}

func (s *AttendanceService) ListStudentAttendance(ctx context.Context, params repository.ListAttendanceParams) ([]repository.AttendanceRecord, error) {
	return s.repo.ListStudentAttendance(ctx, params)
}

func (s *AttendanceService) GetAttendanceSummary(ctx context.Context, collegeID uuid.UUID, startDate, endDate time.Time) (*repository.AttendanceSummary, error) {
	return s.repo.GetAttendanceSummary(ctx, collegeID, startDate, endDate)
}

// Correction
func (s *AttendanceService) SubmitAttendanceCorrection(ctx context.Context, collegeID, requestedBy uuid.UUID, req CorrectionRequest) (*repository.RecordCorrection, error) {
	if !isValidStatus(req.NewStatus) {
		return nil, ErrInvalidStatus
	}

	// Verify attendance exists
	record, err := s.repo.GetStudentAttendance(ctx, collegeID, req.RecordID)
	if err != nil {
		return nil, err
	}

	oldValues, _ := json.Marshal(map[string]interface{}{
		"status":  record.Status,
		"remarks": record.Remarks,
	})

	newValues, _ := json.Marshal(map[string]interface{}{
		"status":  req.NewStatus,
		"remarks": req.Remarks,
	})

	corr := &repository.RecordCorrection{
		CollegeID:        collegeID,
		RecordType:       "ATTENDANCE",
		RecordID:         record.ID,
		RequestedBy:      requestedBy,
		CorrectionReason: req.CorrectionReason,
		OldValues:        string(oldValues),
		NewValues:        string(newValues),
		Status:           repository.CorrectionStatusPending,
		RequestedAt:      time.Now().UTC(),
	}

	if err := s.repo.CreateRecordCorrection(ctx, corr); err != nil {
		return nil, err
	}

	return corr, nil
}

func (s *AttendanceService) ApproveAttendanceCorrection(ctx context.Context, collegeID, correctionID, approvedBy uuid.UUID, req CorrectionDecisionRequest) (*repository.RecordCorrection, error) {
	var finalCorr *repository.RecordCorrection

	err := s.db.WithTransaction(ctx, func(ctx context.Context, tx pgx.Tx) error {
		corr, err := s.repo.GetRecordCorrection(ctx, collegeID, correctionID)
		if err != nil {
			return err
		}

		if corr.Status != repository.CorrectionStatusPending {
			return errors.New("correction is not pending")
		}

		now := time.Now().UTC()
		corr.Status = repository.RecordCorrectionStatus(req.Decision)
		corr.ApprovedBy = &approvedBy
		corr.DecidedAt = &now
		corr.DecisionReason = req.DecisionReason

		if err := s.repo.UpdateRecordCorrection(ctx, corr); err != nil {
			return err
		}

		if corr.Status == repository.CorrectionStatusApproved {
			// Apply the correction to the original record
			record, err := s.repo.GetStudentAttendance(ctx, collegeID, corr.RecordID)
			if err != nil {
				return err
			}

			var newVals map[string]interface{}
			if err := json.Unmarshal([]byte(corr.NewValues), &newVals); err != nil {
				return err
			}

			if st, ok := newVals["status"].(string); ok {
				record.Status = repository.AttendanceStatus(st)
			}
			if rm, ok := newVals["remarks"].(string); ok {
				record.Remarks = &rm
			}

			record.IsCorrected = true

			if err := s.repo.UpdateStudentAttendance(ctx, record); err != nil {
				return err
			}
		}

		finalCorr = corr
		return nil
	})

	return finalCorr, err
}
