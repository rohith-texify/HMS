package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/yourusername/hostel-management-system/API/internal/database"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

var (
	ErrInvalidLeaveType   = errors.New("invalid leave type")
	ErrInvalidDateRange   = errors.New("invalid date range: start date must be before or equal to end date")
	ErrInvalidTransition  = errors.New("invalid status transition")
	ErrOverlappingLeave   = errors.New("overlapping leave request exists")
	ErrLeaveNotApprovable = errors.New("leave request is not in an approvable state")
)

type LeaveService struct {
	db   *database.Database
	repo *repository.Repository
}

func NewLeaveService(db *database.Database, repo *repository.Repository) *LeaveService {
	return &LeaveService{
		db:   db,
		repo: repo,
	}
}

type CreateLeaveRequest struct {
	StudentID    uuid.UUID  `json:"student_id" binding:"required"`
	LeaveType    string     `json:"leave_type" binding:"required"`
	Reason       string     `json:"reason" binding:"required"`
	FromDate     time.Time  `json:"from_date" binding:"required"`
	ToDate       time.Time  `json:"to_date" binding:"required"`
	FromTime     *time.Time `json:"from_time"`
	ToTime       *time.Time `json:"to_time"`
	Destination  *string    `json:"destination"`
	ContactPhone *string    `json:"contact_phone"`
}

type LeaveDecisionRequest struct {
	Decision string  `json:"decision" binding:"required,oneof=APPROVED REJECTED CANCELLED"`
	Remarks  *string `json:"remarks"`
}

func isValidLeaveType(t string) bool {
	switch repository.LeaveType(t) {
	case repository.LeaveTypeDayLeave, repository.LeaveTypeOvernight,
		repository.LeaveTypeWeekend, repository.LeaveTypeEmergency,
		repository.LeaveTypeMedical, repository.LeaveTypeOther:
		return true
	}
	return false
}

func (s *LeaveService) CreateLeaveRequest(ctx context.Context, collegeID, createdBy uuid.UUID, req CreateLeaveRequest) (*repository.LeaveRequest, error) {
	if !isValidLeaveType(req.LeaveType) {
		return nil, ErrInvalidLeaveType
	}

	if req.ToDate.Before(req.FromDate) {
		return nil, ErrInvalidDateRange
	}

	// Validate overlap
	existingReqs, err := s.repo.ListLeaveRequests(ctx, repository.ListLeaveParams{
		CollegeID: collegeID,
		StudentID: &req.StudentID,
	})
	if err != nil {
		return nil, err
	}
	for _, ext := range existingReqs {
		if ext.Status == repository.LeaveStatusPending || ext.Status == repository.LeaveStatusApproved {
			// Check overlap
			if (req.FromDate.Before(ext.ToDate) || req.FromDate.Equal(ext.ToDate)) &&
				(req.ToDate.After(ext.FromDate) || req.ToDate.Equal(ext.FromDate)) {
				return nil, ErrOverlappingLeave
			}
		}
	}

	lr := &repository.LeaveRequest{
		CollegeID:    collegeID,
		StudentID:    req.StudentID,
		LeaveType:    repository.LeaveType(req.LeaveType),
		Reason:       req.Reason,
		FromDate:     req.FromDate,
		ToDate:       req.ToDate,
		FromTime:     req.FromTime,
		ToTime:       req.ToTime,
		Destination:  req.Destination,
		ContactPhone: req.ContactPhone,
		Status:       repository.LeaveStatusPending,
		CreatedBy:    createdBy,
	}

	if err := s.repo.CreateLeaveRequest(ctx, lr); err != nil {
		return nil, err
	}

	return lr, nil
}

func (s *LeaveService) GetLeaveRequest(ctx context.Context, collegeID, id uuid.UUID) (*repository.LeaveRequest, error) {
	return s.repo.GetLeaveRequest(ctx, collegeID, id)
}

func (s *LeaveService) ListLeaveRequests(ctx context.Context, params repository.ListLeaveParams) ([]repository.LeaveRequest, error) {
	return s.repo.ListLeaveRequests(ctx, params)
}

func (s *LeaveService) ProcessLeaveDecision(ctx context.Context, collegeID, leaveID, approverID uuid.UUID, req LeaveDecisionRequest) error {
	return s.db.WithTransaction(ctx, func(ctx context.Context, tx pgx.Tx) error {
		lr, err := s.repo.GetLeaveRequest(ctx, collegeID, leaveID)
		if err != nil {
			return err
		}

		if lr.Status != repository.LeaveStatusPending {
			return ErrLeaveNotApprovable
		}

		now := time.Now().UTC()
		var newStatus repository.LeaveStatus

		switch repository.LeaveApprovalDecision(req.Decision) {
		case repository.ApprovalDecisionApproved:
			newStatus = repository.LeaveStatusApproved
		case repository.ApprovalDecisionRejected:
			newStatus = repository.LeaveStatusRejected
		case repository.ApprovalDecisionCancelled:
			newStatus = repository.LeaveStatusCancelled
		default:
			return ErrInvalidTransition
		}

		// Create approval log
		approval := &repository.LeaveApproval{
			CollegeID:      collegeID,
			LeaveRequestID: leaveID,
			ApprovalLevel:  1,
			ApproverUserID: approverID,
			Decision:       repository.LeaveApprovalDecision(req.Decision),
			Remarks:        req.Remarks,
			DecidedAt:      &now,
		}

		if err := s.repo.CreateLeaveApproval(ctx, approval); err != nil {
			return err
		}

		// Update leave request
		return s.repo.UpdateLeaveRequestStatus(ctx, leaveID, collegeID, approverID, newStatus)
	})
}

// CancelLeaveRequest allows users or admins to cancel a pending/approved leave before it's completed
func (s *LeaveService) CancelLeaveRequest(ctx context.Context, collegeID, leaveID, cancelledBy uuid.UUID) error {
	return s.db.WithTransaction(ctx, func(ctx context.Context, tx pgx.Tx) error {
		lr, err := s.repo.GetLeaveRequest(ctx, collegeID, leaveID)
		if err != nil {
			return err
		}

		if lr.Status == repository.LeaveStatusRejected || lr.Status == repository.LeaveStatusCancelled || lr.Status == repository.LeaveStatusCompleted {
			return ErrInvalidTransition
		}

		now := time.Now().UTC()

		approval := &repository.LeaveApproval{
			CollegeID:      collegeID,
			LeaveRequestID: leaveID,
			ApprovalLevel:  1,
			ApproverUserID: cancelledBy,
			Decision:       repository.ApprovalDecisionCancelled,
			Remarks:        nil,
			DecidedAt:      &now,
		}

		if err := s.repo.CreateLeaveApproval(ctx, approval); err != nil {
			return err
		}

		return s.repo.UpdateLeaveRequestStatus(ctx, leaveID, collegeID, cancelledBy, repository.LeaveStatusCancelled)
	})
}

func (s *LeaveService) GetLeaveSummary(ctx context.Context, collegeID uuid.UUID) (*repository.LeaveSummary, error) {
	return s.repo.GetLeaveSummary(ctx, collegeID)
}
