package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type NotificationType string
type NotificationPriority string
type NotificationChannel string
type NotificationStatus string
type NotificationDeliveryStatus string

const (
	NotificationTypeSystem       NotificationType = "SYSTEM"
	NotificationTypeAnnouncement NotificationType = "ANNOUNCEMENT"
	NotificationTypeLeave        NotificationType = "LEAVE"
	NotificationTypeComplaint    NotificationType = "COMPLAINT"
	NotificationTypeGeneral      NotificationType = "GENERAL"

	NotificationPriorityLow    NotificationPriority = "LOW"
	NotificationPriorityNormal NotificationPriority = "NORMAL"
	NotificationPriorityHigh   NotificationPriority = "HIGH"
	NotificationPriorityUrgent NotificationPriority = "URGENT"

	NotificationChannelInApp NotificationChannel = "IN_APP"

	NotificationStatusSent NotificationStatus = "SENT"

	NotificationDeliveryStatusDelivered NotificationDeliveryStatus = "DELIVERED"
	NotificationDeliveryStatusRead      NotificationDeliveryStatus = "READ"
)

type Notification struct {
	ID               uuid.UUID            `json:"id"`
	CollegeID        uuid.UUID            `json:"college_id"`
	NotificationType NotificationType     `json:"notification_type"`
	Priority         NotificationPriority `json:"priority"`
	Channel          NotificationChannel  `json:"channel"`
	Title            string               `json:"title"`
	Message          string               `json:"message"`
	Status           NotificationStatus   `json:"status"`
	ScheduledAt      *time.Time           `json:"scheduled_at,omitempty"`
	ExpiresAt        *time.Time           `json:"expires_at,omitempty"`
	CreatedBy        uuid.UUID            `json:"created_by"`
	CreatedAt        time.Time            `json:"created_at"`
	UpdatedAt        time.Time            `json:"updated_at"`
}

type NotificationRecipient struct {
	ID             uuid.UUID                  `json:"id"`
	NotificationID uuid.UUID                  `json:"notification_id"`
	UserID         uuid.UUID                  `json:"user_id"`
	DeliveryStatus NotificationDeliveryStatus `json:"delivery_status"`
	SentAt         *time.Time                 `json:"sent_at,omitempty"`
	ReadAt         *time.Time                 `json:"read_at,omitempty"`
	ErrorMessage   *string                    `json:"error_message,omitempty"`
}

type UserNotification struct {
	Notification
	RecipientID    uuid.UUID                  `json:"recipient_id"`
	DeliveryStatus NotificationDeliveryStatus `json:"delivery_status"`
	ReadAt         *time.Time                 `json:"read_at,omitempty"`
}

var ErrNotificationNotFound = ErrNotFound

func (r *Repository) CreateNotification(ctx context.Context, tx pgx.Tx, n *Notification) error {
	query := `
		INSERT INTO app.notifications (college_id, notification_type, priority, channel, title, message, status, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
		RETURNING id, created_at, updated_at
	`
	executor := r.Executor(ctx)
	if tx != nil {
		executor = tx
	}

	err := executor.QueryRow(ctx, query,
		n.CollegeID, n.NotificationType, n.Priority, n.Channel, n.Title, n.Message, n.Status, n.CreatedBy,
	).Scan(&n.ID, &n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create notification: %w", err)
	}
	return nil
}

func (r *Repository) CreateNotificationRecipients(ctx context.Context, tx pgx.Tx, recipients []NotificationRecipient) error {
	if len(recipients) == 0 {
		return nil
	}

	executor := r.Executor(ctx)
	if tx != nil {
		executor = tx
	}

	if tx != nil {
		_, err := tx.CopyFrom(
			ctx,
			pgx.Identifier{"app", "notification_recipients"},
			[]string{"notification_id", "user_id", "delivery_status", "sent_at"},
			pgx.CopyFromSlice(len(recipients), func(i int) ([]any, error) {
				return []any{
					recipients[i].NotificationID,
					recipients[i].UserID,
					recipients[i].DeliveryStatus,
					recipients[i].SentAt,
				}, nil
			}),
		)
		return err
	}

	for _, r := range recipients {
		query := `INSERT INTO app.notification_recipients (notification_id, user_id, delivery_status, sent_at) VALUES ($1, $2, $3, $4)`
		_, err := executor.Exec(ctx, query, r.NotificationID, r.UserID, r.DeliveryStatus, r.SentAt)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) GetUserNotification(ctx context.Context, collegeID, userID, notificationID uuid.UUID) (*UserNotification, error) {
	query := `
		SELECT n.id, n.college_id, n.notification_type, n.priority, n.channel, n.title, n.message, n.status, n.created_by, n.created_at, n.updated_at,
		       r.id as recipient_id, r.delivery_status, r.read_at
		FROM app.notifications n
		JOIN app.notification_recipients r ON n.id = r.notification_id
		WHERE n.college_id = $1 AND r.user_id = $2 AND n.id = $3
	`
	var un UserNotification
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID, userID, notificationID).Scan(
		&un.ID, &un.CollegeID, &un.NotificationType, &un.Priority, &un.Channel, &un.Title, &un.Message, &un.Status, &un.CreatedBy, &un.CreatedAt, &un.UpdatedAt,
		&un.RecipientID, &un.DeliveryStatus, &un.ReadAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotificationNotFound
		}
		return nil, err
	}
	return &un, nil
}

func (r *Repository) ListUserNotifications(ctx context.Context, collegeID, userID uuid.UUID, unreadOnly bool) ([]UserNotification, error) {
	query := `
		SELECT n.id, n.college_id, n.notification_type, n.priority, n.channel, n.title, n.message, n.status, n.created_by, n.created_at, n.updated_at,
		       r.id as recipient_id, r.delivery_status, r.read_at
		FROM app.notifications n
		JOIN app.notification_recipients r ON n.id = r.notification_id
		WHERE n.college_id = $1 AND r.user_id = $2
	`
	if unreadOnly {
		query += ` AND r.delivery_status != 'READ' `
	}
	query += ` ORDER BY n.created_at DESC `

	rows, err := r.Executor(ctx).Query(ctx, query, collegeID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []UserNotification
	for rows.Next() {
		var un UserNotification
		if err := rows.Scan(
			&un.ID, &un.CollegeID, &un.NotificationType, &un.Priority, &un.Channel, &un.Title, &un.Message, &un.Status, &un.CreatedBy, &un.CreatedAt, &un.UpdatedAt,
			&un.RecipientID, &un.DeliveryStatus, &un.ReadAt,
		); err != nil {
			return nil, err
		}
		list = append(list, un)
	}
	return list, nil
}

func (r *Repository) MarkNotificationRead(ctx context.Context, collegeID, userID, notificationID uuid.UUID) error {
	query := `
		UPDATE app.notification_recipients r
		SET delivery_status = 'READ', read_at = now()
		FROM app.notifications n
		WHERE r.notification_id = n.id
		  AND n.college_id = $1
		  AND r.user_id = $2
		  AND n.id = $3
		  AND r.delivery_status != 'READ'
	`
	_, err := r.Executor(ctx).Exec(ctx, query, collegeID, userID, notificationID)
	return err
}

func (r *Repository) MarkAllNotificationsRead(ctx context.Context, collegeID, userID uuid.UUID) error {
	query := `
		UPDATE app.notification_recipients r
		SET delivery_status = 'READ', read_at = now()
		FROM app.notifications n
		WHERE r.notification_id = n.id
		  AND n.college_id = $1
		  AND r.user_id = $2
		  AND r.delivery_status != 'READ'
	`
	_, err := r.Executor(ctx).Exec(ctx, query, collegeID, userID)
	return err
}

func (r *Repository) GetUnreadNotificationCount(ctx context.Context, collegeID, userID uuid.UUID) (int64, error) {
	query := `
		SELECT COUNT(*)
		FROM app.notifications n
		JOIN app.notification_recipients r ON n.id = r.notification_id
		WHERE n.college_id = $1 AND r.user_id = $2 AND r.delivery_status != 'READ'
	`
	var count int64
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID, userID).Scan(&count)
	return count, err
}

// UserExistsInCollege checks if a user belongs to a college to prevent cross-tenant recipient injection
func (r *Repository) UserExistsInCollege(ctx context.Context, collegeID, userID uuid.UUID) (bool, error) {
	var exists bool
	query := `
		SELECT EXISTS (
			SELECT 1 FROM app.users WHERE user_id = $1
		)
	`
	err := r.Executor(ctx).QueryRow(ctx, query, userID).Scan(&exists)
	return exists, err
}
