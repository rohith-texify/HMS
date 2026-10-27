package validators

import (
	"strings"
	"time"

	"github.com/google/uuid"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

// ParseDashboardDate attempts to parse a date query param in RFC3339 or ISO 8601 YYYY-MM-DD format.
func ParseDashboardDate(paramName, raw string, isEndOfDay bool) (*time.Time, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}

	// Try RFC3339 first (e.g. 2026-10-19T15:04:05Z)
	if t, err := time.Parse(time.RFC3339, trimmed); err == nil {
		utc := t.UTC()
		return &utc, nil
	}

	// Try YYYY-MM-DD
	if t, err := time.Parse("2006-01-02", trimmed); err == nil {
		var utc time.Time
		if isEndOfDay {
			// End of the day: 23:59:59.999999999 UTC
			utc = time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 59, 999999999, time.UTC)
		} else {
			// Start of the day: 00:00:00 UTC
			utc = time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
		}
		return &utc, nil
	}

	return nil, apierrors.New(
		apierrors.ValidationError,
		paramName+" must be a valid date format (RFC3339 or YYYY-MM-DD)",
	)
}

// ValidateDashboardFilterParams parses and validates the dashboard query parameters.
func ValidateDashboardFilterParams(rawStartDate, rawEndDate, rawCollegeID string) (*models.DashboardFilterParams, error) {
	startDate, err := ParseDashboardDate("start_date", rawStartDate, false)
	if err != nil {
		return nil, err
	}

	endDate, err := ParseDashboardDate("end_date", rawEndDate, true)
	if err != nil {
		return nil, err
	}

	if startDate != nil && endDate != nil && startDate.After(*endDate) {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"start_date cannot be after end_date",
		)
	}

	var collegeID *uuid.UUID
	trimmedCollege := strings.TrimSpace(rawCollegeID)
	if trimmedCollege != "" {
		parsed, err := uuid.Parse(trimmedCollege)
		if err != nil {
			return nil, apierrors.New(
				apierrors.ValidationError,
				"Invalid college_id format: must be a valid UUID",
			)
		}
		collegeID = &parsed
	}

	return &models.DashboardFilterParams{
		StartDate: startDate,
		EndDate:   endDate,
		CollegeID: collegeID,
	}, nil
}
