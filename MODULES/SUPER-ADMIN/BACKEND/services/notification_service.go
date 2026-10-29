package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/database"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
)

// NotificationService manages platform notifications, announcements, previews, and approval integrations.
type NotificationService struct {
	db              *database.Database
	repo            *repository.Repository
	approvalService *ApprovalService
}

// NewNotificationService creates a new NotificationService instance.
func NewNotificationService(
	db *database.Database,
	repo *repository.Repository,
	approvalService *ApprovalService,
) *NotificationService {
	return &NotificationService{
		db:              db,
		repo:            repo,
		approvalService: approvalService,
	}
}

// ListNotifications retrieves paginated platform notifications with filtering.
func (s *NotificationService) ListNotifications(
	ctx context.Context,
	params models.NotificationFilterParams,
) ([]models.PlatformNotification, int, error) {
	if s == nil || s.repo == nil {
		return nil, 0, apierrors.New(apierrors.InternalError, "Notification service is not configured")
	}

	limit := params.Limit
	if limit <= 0 {
		limit = 20
	}
	offset := params.Offset
	if offset < 0 {
		offset = 0
	}

	query := `
		SELECT 
			n.id, n.notification_type, n.title, n.message, n.priority, n.status,
			n.target_type, COALESCE(n.target_value, '{}'::jsonb), n.publish_at, n.expires_at,
			n.created_by, COALESCE(u1.email, 'Platform Admin') as created_by_name,
			n.published_by, COALESCE(u2.email, '') as published_by_name,
			n.published_at, n.created_at, n.updated_at
		FROM app.platform_notifications n
		LEFT JOIN app.users u1 ON n.created_by = u1.user_id
		LEFT JOIN app.users u2 ON n.published_by = u2.user_id
		WHERE 1=1
	`
	countQuery := `SELECT COUNT(*) FROM app.platform_notifications n WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if params.Status != "" {
		query += fmt.Sprintf(` AND n.status = $%d`, argIdx)
		countQuery += fmt.Sprintf(` AND n.status = $%d`, argIdx)
		args = append(args, strings.ToUpper(params.Status))
		argIdx++
	}

	if params.NotificationType != "" {
		query += fmt.Sprintf(` AND n.notification_type = $%d`, argIdx)
		countQuery += fmt.Sprintf(` AND n.notification_type = $%d`, argIdx)
		args = append(args, strings.ToUpper(params.NotificationType))
		argIdx++
	}

	if params.TargetType != "" {
		query += fmt.Sprintf(` AND n.target_type = $%d`, argIdx)
		countQuery += fmt.Sprintf(` AND n.target_type = $%d`, argIdx)
		args = append(args, strings.ToUpper(params.TargetType))
		argIdx++
	}

	if params.Search != "" {
		pattern := "%" + params.Search + "%"
		query += fmt.Sprintf(` AND (n.title ILIKE $%d OR n.message ILIKE $%d)`, argIdx, argIdx)
		countQuery += fmt.Sprintf(` AND (n.title ILIKE $%d OR n.message ILIKE $%d)`, argIdx, argIdx)
		args = append(args, pattern)
		argIdx++
	}

	var total int
	err := s.db.GetPlatformPool().QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to count notifications: %v", err))
	}

	query += fmt.Sprintf(` ORDER BY n.created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := s.db.GetPlatformPool().Query(ctx, query, args...)
	if err != nil {
		return nil, 0, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to list notifications: %v", err))
	}
	defer rows.Close()

	items := make([]models.PlatformNotification, 0)
	for rows.Next() {
		var item models.PlatformNotification
		var targetValueRaw []byte
		err := rows.Scan(
			&item.ID,
			&item.NotificationType,
			&item.Title,
			&item.Message,
			&item.Priority,
			&item.Status,
			&item.TargetType,
			&targetValueRaw,
			&item.PublishAt,
			&item.ExpiresAt,
			&item.CreatedBy,
			&item.CreatedByName,
			&item.PublishedBy,
			&item.PublishedByName,
			&item.PublishedAt,
			&item.CreatedAt,
			&item.UpdatedAt,
		)
		if err != nil {
			return nil, 0, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to scan notification: %v", err))
		}
		if len(targetValueRaw) > 0 {
			_ = json.Unmarshal(targetValueRaw, &item.TargetValue)
		}
		items = append(items, item)
	}

	return items, total, nil
}

// PreviewAudience computes and validates the target audience before composing or publishing.
func (s *NotificationService) PreviewAudience(
	ctx context.Context,
	targetType string,
	collegeIDs []string,
) (*models.NotificationAudiencePreview, error) {
	normTarget := strings.ToUpper(strings.TrimSpace(targetType))
	if normTarget != "ALL_COLLEGES" && normTarget != "SELECTED_COLLEGES" {
		return nil, apierrors.New(apierrors.ValidationError, "Target type must be ALL_COLLEGES or SELECTED_COLLEGES")
	}

	var query string
	var args []interface{}

	if normTarget == "ALL_COLLEGES" {
		query = `SELECT college_id, college_code, name, status FROM platform.colleges WHERE status != 'DEACTIVATED' ORDER BY name ASC`
	} else {
		if len(collegeIDs) == 0 {
			return &models.NotificationAudiencePreview{
				TargetType:     normTarget,
				TotalColleges:  0,
				EligibleCount:  0,
				TargetColleges: []models.CollegeAudienceItem{},
				RequiresReview: false,
			}, nil
		}
		parsedIDs := make([]uuid.UUID, 0, len(collegeIDs))
		for _, cidStr := range collegeIDs {
			id, err := uuid.Parse(cidStr)
			if err == nil {
				parsedIDs = append(parsedIDs, id)
			}
		}
		query = `SELECT college_id, college_code, name, status FROM platform.colleges WHERE college_id = ANY($1) ORDER BY name ASC`
		args = append(args, parsedIDs)
	}

	rows, err := s.db.GetPlatformPool().Query(ctx, query, args...)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to query target audience: %v", err))
	}
	defer rows.Close()

	colleges := make([]models.CollegeAudienceItem, 0)
	for rows.Next() {
		var c models.CollegeAudienceItem
		if err := rows.Scan(&c.CollegeID, &c.CollegeCode, &c.Name, &c.Status); err == nil {
			colleges = append(colleges, c)
		}
	}

	requiresReview := normTarget == "ALL_COLLEGES" && len(colleges) > 0
	approvalNote := ""
	if requiresReview {
		approvalNote = "Company-wide broadcasts target all active college tenants and require peer approval under Module 16 policy before release."
	}

	return &models.NotificationAudiencePreview{
		TargetType:     normTarget,
		TotalColleges:  len(colleges),
		EligibleCount:  len(colleges),
		TargetColleges: colleges,
		RequiresReview: requiresReview,
		ApprovalNote:   approvalNote,
	}, nil
}

// CreateNotification drafts a new notification or routes system-wide broadcasts to Approval Workflow.
func (s *NotificationService) CreateNotification(
	ctx context.Context,
	req models.CreatePlatformNotificationRequest,
	actorUserID uuid.UUID,
	actorRole string,
) (*models.PlatformNotification, *models.ApprovalRequest, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, nil, apierrors.New(apierrors.InternalError, "Notification service is not configured")
	}

	req.Title = strings.TrimSpace(req.Title)
	req.Message = strings.TrimSpace(req.Message)
	if req.Title == "" || req.Message == "" {
		return nil, nil, apierrors.New(apierrors.ValidationError, "Title and message are required")
	}

	targetType := strings.ToUpper(strings.TrimSpace(req.TargetType))
	if targetType != "ALL_COLLEGES" && targetType != "SELECTED_COLLEGES" {
		return nil, nil, apierrors.New(apierrors.ValidationError, "Target type must be ALL_COLLEGES or SELECTED_COLLEGES")
	}

	notifType := strings.ToUpper(strings.TrimSpace(req.NotificationType))
	if notifType == "" {
		notifType = "GENERAL"
	}
	priority := strings.ToUpper(strings.TrimSpace(req.Priority))
	if priority == "" {
		priority = "NORMAL"
	}

	targetValue := models.JSONB{}
	if targetType == "SELECTED_COLLEGES" {
		targetValue["college_ids"] = req.CollegeIDs
	}

	notifID := uuid.New()
	targetValBytes, _ := json.Marshal(targetValue)
	initialStatus := "DRAFT"

	requiresApproval := targetType == "ALL_COLLEGES"

	var notif models.PlatformNotification
	var createdApproval *models.ApprovalRequest

	err := s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		now := time.Now().UTC()
		_, err := s.repo.Executor(txCtx).Exec(txCtx, `
			INSERT INTO app.platform_notifications (
				id, notification_type, title, message, priority, status,
				target_type, target_value, expires_at, created_by, created_at, updated_at
			) VALUES (
				$1, $2, $3, $4, $5, $6,
				$7, $8, $9, $10, $11, $11
			)
		`, notifID, notifType, req.Title, req.Message, priority, initialStatus, targetType, targetValBytes, req.ExpiresAt, actorUserID, now)
		if err != nil {
			return fmt.Errorf("insert platform notification: %w", err)
		}

		notif = models.PlatformNotification{
			ID:               notifID,
			NotificationType: notifType,
			Title:            req.Title,
			Message:          req.Message,
			Priority:         priority,
			Status:           initialStatus,
			TargetType:       targetType,
			TargetValue:      targetValue,
			ExpiresAt:        req.ExpiresAt,
			CreatedBy:        actorUserID,
			CreatedAt:        now,
			UpdatedAt:        now,
		}

		// If broadcasting to ALL_COLLEGES, trigger Maker-Checker approval workflow
		if requiresApproval {
			approvalPayload := models.JSONB{
				"notification_id":   notifID.String(),
				"title":             req.Title,
				"notification_type": notifType,
				"target_type":       targetType,
			}
			reason := fmt.Sprintf("System-wide broadcast approval: %s", req.Title)

			appReqWithSteps, err := s.approvalService.CreateApprovalRequest(txCtx, models.CreateApprovalRequestInput{
				OperationType: "PLATFORM_NOTIFICATION_PUBLISH",
				Payload:       approvalPayload,
				Reason:        &reason,
			}, actorUserID, actorRole)
			if err != nil {
				return fmt.Errorf("create approval request for broadcast: %w", err)
			}
			createdApproval = &appReqWithSteps.ApprovalRequest
		} else {
			// For single/selected colleges, author can publish directly if authorized
			publishedNow := time.Now().UTC()
			_, err := s.repo.Executor(txCtx).Exec(txCtx, `
				UPDATE app.platform_notifications
				SET status = 'PUBLISHED', published_by = $1, published_at = $2, updated_at = $2
				WHERE id = $3
			`, actorUserID, publishedNow, notifID)
			if err != nil {
				return fmt.Errorf("publish notification: %w", err)
			}
			notif.Status = "PUBLISHED"
			notif.PublishedBy = &actorUserID
			notif.PublishedAt = &publishedNow
		}

		// Record audit log
		return s.repo.RecordApprovalAudit(txCtx, models.ApprovalAuditParams{
			ActorUserID: actorUserID,
			ActorRole:   actorRole,
			Module:      "platform_notifications",
			Action:      "NOTIFICATION_CREATED",
			EntityType:  "NOTIFICATION",
			EntityID:    notifID,
			NewData: models.JSONB{
				"title":             req.Title,
				"target_type":       targetType,
				"requires_approval": requiresApproval,
			},
			Severity: "INFO",
		})
	})

	if err != nil {
		return nil, nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to compose notification: %v", err))
	}

	return &notif, createdApproval, nil
}

// CancelNotification cancels a drafted or pending platform notification.
func (s *NotificationService) CancelNotification(
	ctx context.Context,
	notificationID uuid.UUID,
	actorUserID uuid.UUID,
	actorRole string,
	reason string,
) error {
	if s == nil || s.repo == nil || s.db == nil {
		return apierrors.New(apierrors.InternalError, "Notification service is not configured")
	}

	err := s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var status string
		var createdBy uuid.UUID
		err := s.repo.Executor(txCtx).QueryRow(txCtx, `
			SELECT status, created_by FROM app.platform_notifications WHERE id = $1 FOR UPDATE
		`, notificationID).Scan(&status, &createdBy)
		if err != nil {
			if err == pgx.ErrNoRows {
				return apierrors.New(apierrors.NotFound, "Notification not found")
			}
			return fmt.Errorf("query notification: %w", err)
		}

		if status == "CANCELLED" || status == "EXPIRED" {
			return apierrors.New(apierrors.Conflict, fmt.Sprintf("Notification is already in terminal state %s", status))
		}

		now := time.Now().UTC()
		_, err = s.repo.Executor(txCtx).Exec(txCtx, `
			UPDATE app.platform_notifications
			SET status = 'CANCELLED', updated_at = $1
			WHERE id = $2
		`, now, notificationID)
		if err != nil {
			return fmt.Errorf("cancel notification: %w", err)
		}

		return s.repo.RecordApprovalAudit(txCtx, models.ApprovalAuditParams{
			ActorUserID: actorUserID,
			ActorRole:   actorRole,
			Module:      "platform_notifications",
			Action:      "NOTIFICATION_CANCELLED",
			EntityType:  "NOTIFICATION",
			EntityID:    notificationID,
			Reason:      &reason,
			Severity:    "INFO",
		})
	})

	if err != nil {
		if apiErr, ok := err.(*apierrors.APIError); ok {
			return apiErr
		}
		return apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to cancel notification: %v", err))
	}

	return nil
}
