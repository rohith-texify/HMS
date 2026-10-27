package repository

import (
	"context"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/google/uuid"
)

// LoginEvent represents a security event recorded during authentication.
type LoginEvent struct {
	UserID    *uuid.UUID
	CollegeID *uuid.UUID
	Result    string
	IPAddress string
	Device    string
	UserAgent string
	EventAt   time.Time
}

// RecordLoginEvent stores an authentication event in the existing
// platform.login_events table. It does not modify the database schema.
func (r *Repository) RecordLoginEvent(
	ctx context.Context,
	event LoginEvent,
) error {
	switch event.Result {
	case "SUCCESS", "FAILED", "LOCKED", "BLOCKED", "LOGOUT", "MFA_FAILED":
		// These values match the database CHECK constraint.
	default:
		return fmt.Errorf("unsupported login event result")
	}

	if event.UserID != nil && *event.UserID == uuid.Nil {
		return fmt.Errorf("invalid login event user ID")
	}

	if event.CollegeID != nil && *event.CollegeID == uuid.Nil {
		return fmt.Errorf("invalid login event college ID")
	}

	var ipAddress interface{}
	if value := strings.TrimSpace(event.IPAddress); value != "" {
		parsed := net.ParseIP(value)
		if parsed == nil {
			return fmt.Errorf("invalid login event IP address")
		}
		ipAddress = parsed.String()
	}

	var userAgent interface{}
	if value := strings.TrimSpace(event.UserAgent); value != "" {
		userAgent = value
	}

	var device interface{}
	if value := strings.TrimSpace(event.Device); value != "" {
		device = value
	}

	eventID := uuid.New()

	eventAt := event.EventAt
	if eventAt.IsZero() {
		eventAt = time.Now().UTC()
	}

	const query = `
		INSERT INTO platform.login_events (
			login_event_id,
			user_id,
			college_id,
			result,
			ip_address,
			device,
			user_agent,
			event_at,
			created_at
		)
		VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, NOW()
		)
	`

	_, err := r.Executor(ctx).Exec(
		ctx,
		query,
		eventID,
		event.UserID,
		event.CollegeID,
		event.Result,
		ipAddress,
		device,
		userAgent,
		eventAt,
	)

	if err != nil {
		return fmt.Errorf("failed to record login event")
	}

	return nil
}
