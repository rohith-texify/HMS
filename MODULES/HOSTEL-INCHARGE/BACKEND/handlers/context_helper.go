package handlers

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
)

// getAuthenticatedCollegeID extracts the tenant college ID from the gin context.
func getAuthenticatedCollegeID(c *gin.Context) (uuid.UUID, error) {
	val, exists := c.Get("college_id")
	if !exists {
		val, exists = c.Get("auth_college_id")
	}
	if !exists {
		if paramID := c.Param("college_id"); paramID != "" {
			return uuid.Parse(paramID)
		}
		return uuid.Nil, apierrors.New(
			apierrors.Unauthorized,
			"College tenant context is missing from request",
		)
	}

	switch v := val.(type) {
	case uuid.UUID:
		return v, nil
	case string:
		return uuid.Parse(strings.TrimSpace(v))
	default:
		return uuid.Nil, apierrors.New(
			apierrors.Unauthorized,
			"Invalid college ID format in context",
		)
	}
}

// getAuthenticatedUserID extracts the user ID from the gin context.
func getAuthenticatedUserID(c *gin.Context) (uuid.UUID, error) {
	val, exists := c.Get("user_id")
	if !exists {
		val, exists = c.Get("auth_user_id")
	}
	if !exists {
		return uuid.Nil, apierrors.New(
			apierrors.Unauthorized,
			"User context is missing from request",
		)
	}

	switch v := val.(type) {
	case uuid.UUID:
		return v, nil
	case string:
		return uuid.Parse(strings.TrimSpace(v))
	default:
		return uuid.Nil, apierrors.New(
			apierrors.Unauthorized,
			"Invalid user ID format in context",
		)
	}
}

