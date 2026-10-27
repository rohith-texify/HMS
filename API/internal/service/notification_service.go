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
	ErrInvalidNotificationType     = errors.New("invalid notification type")
	ErrInvalidNotificationPriority = errors.New("invalid notification priority")
	ErrUserNotInCollege            = errors.New("one or more recipients do not belong to the college")
)

type NotificationService struct {
	db   *database.Database
	repo *repository.Repository
}

func NewNotificationService(db *database.Database, repo *repository.Repository) *NotificationService {
	return &NotificationService{
		db:   db,
		repo: repo,
	}
}

type CreateNotificationRequest struct {
	Title        string      `json:"title" binding:"required"`
	Message      string      `json:"message" binding:"required"`
	Type         string      `json:"type" binding:"required"`
	Priority     string      `json:"priority" binding:"required"`
	RecipientIDs []uuid.UUID `json:"recipient_ids" binding:"required,min=1"`
}

func isValidNotificationType(t string) bool {
	valid := []string{"SYSTEM", "ANNOUNCEMENT", "LEAVE", "COMPLAINT", "GENERAL"}
	for _, v := range valid {
		if v == t {
			return true
		}
	}
	return false
}

func isValidNotificationPriority(p string) bool {
	valid := []string{"LOW", "NORMAL", "HIGH", "URGENT"}
	for _, v := range valid {
		if v == p {
			return true
		}
	}
	return false
}

func (s *NotificationService) CreateNotification(ctx context.Context, collegeID, createdBy uuid.UUID, req CreateNotificationRequest) (*repository.Notification, error) {
	if !isValidNotificationType(req.Type) {
		return nil, ErrInvalidNotificationType
	}
	if !isValidNotificationPriority(req.Priority) {
		return nil, ErrInvalidNotificationPriority
	}

	// Validate all recipients belong to college
	for _, rid := range req.RecipientIDs {
		exists, err := s.repo.UserExistsInCollege(ctx, collegeID, rid)
		if err != nil {
			return nil, err
		}
		if !exists {
			return nil, ErrUserNotInCollege
		}
	}

	var createdNotif *repository.Notification
	err := s.db.WithTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
		n := &repository.Notification{
			CollegeID:        collegeID,
			NotificationType: repository.NotificationType(req.Type),
			Priority:         repository.NotificationPriority(req.Priority),
			Channel:          repository.NotificationChannelInApp,
			Title:            strings.TrimSpace(req.Title),
			Message:          strings.TrimSpace(req.Message),
			Status:           repository.NotificationStatusSent,
			CreatedBy:        createdBy,
		}

		if err := s.repo.CreateNotification(txCtx, tx, n); err != nil {
			return err
		}

		now := time.Now()
		var recipients []repository.NotificationRecipient
		for _, rid := range req.RecipientIDs {
			recipients = append(recipients, repository.NotificationRecipient{
				NotificationID: n.ID,
				UserID:         rid,
				DeliveryStatus: repository.NotificationDeliveryStatusDelivered,
				SentAt:         &now,
			})
		}

		if err := s.repo.CreateNotificationRecipients(txCtx, tx, recipients); err != nil {
			return err
		}

		createdNotif = n
		return nil
	})

	if err != nil {
		return nil, err
	}
	return createdNotif, nil
}

func (s *NotificationService) GetNotification(ctx context.Context, collegeID, userID, notificationID uuid.UUID) (*repository.UserNotification, error) {
	return s.repo.GetUserNotification(ctx, collegeID, userID, notificationID)
}

func (s *NotificationService) ListNotifications(ctx context.Context, collegeID, userID uuid.UUID, unreadOnly bool) ([]repository.UserNotification, error) {
	return s.repo.ListUserNotifications(ctx, collegeID, userID, unreadOnly)
}

func (s *NotificationService) MarkAsRead(ctx context.Context, collegeID, userID, notificationID uuid.UUID) error {
	return s.repo.MarkNotificationRead(ctx, collegeID, userID, notificationID)
}

func (s *NotificationService) MarkAllAsRead(ctx context.Context, collegeID, userID uuid.UUID) error {
	return s.repo.MarkAllNotificationsRead(ctx, collegeID, userID)
}

func (s *NotificationService) GetUnreadCount(ctx context.Context, collegeID, userID uuid.UUID) (int64, error) {
	return s.repo.GetUnreadNotificationCount(ctx, collegeID, userID)
}
