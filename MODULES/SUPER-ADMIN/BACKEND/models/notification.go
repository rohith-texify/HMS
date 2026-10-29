package models

import (
	"time"

	"github.com/google/uuid"
)

// PlatformNotification represents an announcement or alert targeted to colleges from the platform control-plane.
type PlatformNotification struct {
	ID               uuid.UUID  `json:"id"`
	NotificationType string     `json:"notification_type"` // SYSTEM, MAINTENANCE, SECURITY, BILLING, FEATURE, ANNOUNCEMENT, GENERAL
	Title            string     `json:"title"`
	Message          string     `json:"message"`
	Priority         string     `json:"priority"`    // LOW, NORMAL, HIGH, URGENT
	Status           string     `json:"status"`      // DRAFT, SCHEDULED, PUBLISHED, EXPIRED, CANCELLED
	TargetType       string     `json:"target_type"` // ALL_COLLEGES, SELECTED_COLLEGES, PLATFORM_USERS, CUSTOM
	TargetValue      JSONB      `json:"target_value,omitempty"`
	PublishAt        *time.Time `json:"publish_at,omitempty"`
	ExpiresAt        *time.Time `json:"expires_at,omitempty"`
	CreatedBy        uuid.UUID  `json:"created_by"`
	CreatedByName    string     `json:"created_by_name,omitempty"`
	PublishedBy      *uuid.UUID `json:"published_by,omitempty"`
	PublishedByName  string     `json:"published_by_name,omitempty"`
	PublishedAt      *time.Time `json:"published_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`

	// Target summary computed for auditing & display
	TargetCollegeCount int      `json:"target_college_count,omitempty"`
	TargetColleges     []string `json:"target_colleges,omitempty"`
}

// CreatePlatformNotificationRequest defines the input payload for composing a new company announcement.
type CreatePlatformNotificationRequest struct {
	NotificationType string     `json:"notification_type" binding:"required"`
	Title            string     `json:"title" binding:"required"`
	Message          string     `json:"message" binding:"required"`
	Priority         string     `json:"priority"`
	TargetType       string     `json:"target_type" binding:"required"` // ALL_COLLEGES, SELECTED_COLLEGES
	CollegeIDs       []string   `json:"college_ids,omitempty"`
	ExpiresAt        *time.Time `json:"expires_at,omitempty"`
}

// NotificationFilterParams provides search and filtering parameters for company announcements.
type NotificationFilterParams struct {
	Status           string `form:"status"`
	NotificationType string `form:"notification_type"`
	TargetType       string `form:"target_type"`
	Search           string `form:"search"`
	Limit            int    `form:"limit"`
	Offset           int    `form:"offset"`
}

// NotificationAudiencePreview provides server-validated audience calculation before publishing.
type NotificationAudiencePreview struct {
	TargetType     string                 `json:"target_type"`
	TotalColleges  int                    `json:"total_colleges"`
	EligibleCount  int                    `json:"eligible_count"`
	TargetColleges []CollegeAudienceItem  `json:"target_colleges"`
	RequiresReview bool                   `json:"requires_review"`
	ApprovalNote   string                 `json:"approval_note,omitempty"`
}

// CollegeAudienceItem is a preview entity of a target college.
type CollegeAudienceItem struct {
	CollegeID   uuid.UUID `json:"college_id"`
	CollegeCode string    `json:"college_code"`
	Name        string    `json:"name"`
	Status      string    `json:"status"`
}
