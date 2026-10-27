package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/yourusername/hostel-management-system/API/internal/database"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

var (
	ErrInvalidComplaintCategory = errors.New("invalid complaint category")
	ErrInvalidComplaintPriority = errors.New("invalid complaint priority")
	ErrInvalidComplaintStatus   = errors.New("invalid complaint status transition")
)

type ComplaintService struct {
	db   *database.Database
	repo *repository.Repository
}

func NewComplaintService(db *database.Database, repo *repository.Repository) *ComplaintService {
	return &ComplaintService{
		db:   db,
		repo: repo,
	}
}

type CreateComplaintRequest struct {
	StudentID   *uuid.UUID `json:"student_id,omitempty"`
	Category    string     `json:"category" binding:"required"`
	Title       string     `json:"title" binding:"required"`
	Description string     `json:"description" binding:"required"`
	Priority    string     `json:"priority" binding:"required"`
}

type UpdateComplaintStatusRequest struct {
	Status  string `json:"status" binding:"required"`
	Message string `json:"message" binding:"required"`
}

type AssignComplaintRequest struct {
	AssignedTo uuid.UUID `json:"assigned_to" binding:"required"`
	Message    string    `json:"message"`
}

type ResolveComplaintRequest struct {
	Resolution string `json:"resolution" binding:"required"`
}

func isValidComplaintCategory(c string) bool {
	valid := []string{"HOSTEL", "ROOM", "FOOD", "WATER", "ELECTRICITY", "CLEANLINESS", "MAINTENANCE", "SECURITY", "ACADEMIC", "TRANSPORT", "FACILITY", "STAFF", "OTHER"}
	for _, v := range valid {
		if v == c {
			return true
		}
	}
	return false
}

func isValidComplaintPriority(p string) bool {
	valid := []string{"LOW", "NORMAL", "HIGH", "URGENT"}
	for _, v := range valid {
		if v == p {
			return true
		}
	}
	return false
}

func (s *ComplaintService) CreateComplaint(ctx context.Context, collegeID, createdBy uuid.UUID, req CreateComplaintRequest) (*repository.Complaint, error) {
	if !isValidComplaintCategory(req.Category) {
		return nil, ErrInvalidComplaintCategory
	}
	if !isValidComplaintPriority(req.Priority) {
		return nil, ErrInvalidComplaintPriority
	}

	comp := &repository.Complaint{
		CollegeID:   collegeID,
		StudentID:   req.StudentID,
		Category:    repository.ComplaintCategory(req.Category),
		Title:       strings.TrimSpace(req.Title),
		Description: strings.TrimSpace(req.Description),
		Priority:    repository.ComplaintPriority(req.Priority),
		Status:      repository.ComplaintStatusOpen,
		CreatedBy:   createdBy,
	}

	if err := s.repo.CreateComplaint(ctx, comp); err != nil {
		return nil, err
	}

	// Create initial update history entry
	_ = s.repo.AddComplaintUpdate(ctx, &repository.ComplaintUpdate{
		CollegeID:      collegeID,
		ComplaintID:    comp.ID,
		UpdateType:     repository.ComplaintUpdateSystem,
		PreviousStatus: nil,
		NewStatus:      &comp.Status,
		Message:        "Complaint created",
		UpdatedBy:      &createdBy,
	})

	return comp, nil
}

func (s *ComplaintService) GetComplaint(ctx context.Context, collegeID, id uuid.UUID) (*repository.Complaint, error) {
	return s.repo.GetComplaint(ctx, collegeID, id)
}

func (s *ComplaintService) ListComplaints(ctx context.Context, collegeID uuid.UUID) ([]repository.Complaint, error) {
	return s.repo.ListComplaints(ctx, collegeID)
}

func (s *ComplaintService) UpdateComplaintStatus(ctx context.Context, collegeID, compID, updatedBy uuid.UUID, req UpdateComplaintStatusRequest) error {
	var newStatus repository.ComplaintStatus
	switch req.Status {
	case string(repository.ComplaintStatusInProgress), string(repository.ComplaintStatusRejected), string(repository.ComplaintStatusCancelled), string(repository.ComplaintStatusClosed), string(repository.ComplaintStatusReopened):
		newStatus = repository.ComplaintStatus(req.Status)
	default:
		return ErrInvalidComplaintStatus
	}

	return s.db.WithTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
		comp, err := s.repo.GetComplaint(txCtx, collegeID, compID)
		if err != nil {
			return err
		}

		prevStatus := comp.Status
		comp.Status = newStatus
		comp.UpdatedBy = &updatedBy

		if newStatus == repository.ComplaintStatusClosed || newStatus == repository.ComplaintStatusRejected || newStatus == repository.ComplaintStatusCancelled {
			now := time.Now()
			comp.ClosedAt = &now
		} else if newStatus == repository.ComplaintStatusReopened {
			comp.ClosedAt = nil
		}

		if err := s.repo.UpdateComplaintState(txCtx, comp); err != nil {
			return err
		}

		return s.repo.AddComplaintUpdate(txCtx, &repository.ComplaintUpdate{
			CollegeID:      collegeID,
			ComplaintID:    comp.ID,
			UpdateType:     repository.ComplaintUpdateStatusChange,
			PreviousStatus: &prevStatus,
			NewStatus:      &newStatus,
			Message:        req.Message,
			UpdatedBy:      &updatedBy,
		})
	})
}

func (s *ComplaintService) AssignComplaint(ctx context.Context, collegeID, compID, assignedBy uuid.UUID, req AssignComplaintRequest) error {
	return s.db.WithTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
		comp, err := s.repo.GetComplaint(txCtx, collegeID, compID)
		if err != nil {
			return err
		}

		prevStatus := comp.Status
		comp.AssignedTo = &req.AssignedTo
		comp.Status = repository.ComplaintStatusAssigned
		comp.UpdatedBy = &assignedBy

		if err := s.repo.UpdateComplaintState(txCtx, comp); err != nil {
			return err
		}

		return s.repo.AddComplaintUpdate(txCtx, &repository.ComplaintUpdate{
			CollegeID:      collegeID,
			ComplaintID:    comp.ID,
			UpdateType:     repository.ComplaintUpdateAssignment,
			PreviousStatus: &prevStatus,
			NewStatus:      &comp.Status,
			Message:        req.Message,
			UpdatedBy:      &assignedBy,
		})
	})
}

func (s *ComplaintService) ResolveComplaint(ctx context.Context, collegeID, compID, resolvedBy uuid.UUID, req ResolveComplaintRequest) error {
	return s.db.WithTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
		comp, err := s.repo.GetComplaint(txCtx, collegeID, compID)
		if err != nil {
			return err
		}

		prevStatus := comp.Status
		comp.Status = repository.ComplaintStatusResolved
		comp.Resolution = &req.Resolution
		now := time.Now()
		comp.ResolvedAt = &now
		comp.UpdatedBy = &resolvedBy

		if err := s.repo.UpdateComplaintState(txCtx, comp); err != nil {
			return err
		}

		return s.repo.AddComplaintUpdate(txCtx, &repository.ComplaintUpdate{
			CollegeID:      collegeID,
			ComplaintID:    comp.ID,
			UpdateType:     repository.ComplaintUpdateResolution,
			PreviousStatus: &prevStatus,
			NewStatus:      &comp.Status,
			Message:        req.Resolution,
			UpdatedBy:      &resolvedBy,
		})
	})
}

func (s *ComplaintService) GetComplaintSummary(ctx context.Context, collegeID uuid.UUID) ([]repository.OpenComplaintSummary, error) {
	return s.repo.GetComplaintSummary(ctx, collegeID)
}

func (s *ComplaintService) ListComplaintUpdates(ctx context.Context, collegeID, compID uuid.UUID) ([]repository.ComplaintUpdate, error) {
	return s.repo.ListComplaintUpdates(ctx, collegeID, compID)
}
