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
		// Fallback check on header or route param if provided
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

// getAuthenticatedActor extracts actor user ID and role from context.
func getAuthenticatedActor(c *gin.Context) (uuid.UUID, string, error) {
	userIDValue, exists := c.Get("auth_user_id")
	if !exists {
		userIDValue, exists = c.Get("user_id")
	}
	if !exists {
		return uuid.Nil, "", apierrors.New(
			apierrors.Unauthorized,
			"Authenticated user context is missing",
		)
	}

	var actorID uuid.UUID
	switch v := userIDValue.(type) {
	case uuid.UUID:
		actorID = v
	case string:
		var err error
		actorID, err = uuid.Parse(strings.TrimSpace(v))
		if err != nil {
			return uuid.Nil, "", apierrors.New(
				apierrors.Unauthorized,
				"Invalid user ID in context",
			)
		}
	default:
		return uuid.Nil, "", apierrors.New(
			apierrors.Unauthorized,
			"Invalid user ID format in context",
		)
	}

	roleValue, exists := c.Get("auth_role")
	if !exists {
		roleValue, exists = c.Get("role")
	}
	role, _ := roleValue.(string)

	return actorID, role, nil
}

