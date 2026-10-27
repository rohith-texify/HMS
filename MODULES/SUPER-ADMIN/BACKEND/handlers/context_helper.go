package handlers

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
)

// getAuthenticatedActor extracts actor user ID and role from trusted request context.
func getAuthenticatedActor(c *gin.Context) (uuid.UUID, string, error) {
	userIDValue, exists := c.Get("auth_user_id")
	if !exists {
		userIDValue, exists = c.Get("user_id")
	}
	if !exists {
		return uuid.Nil, "", apierrors.New(
			apierrors.Unauthorized,
			"authenticated user context is missing",
		)
	}

	var actorID uuid.UUID
	switch v := userIDValue.(type) {
	case uuid.UUID:
		actorID = v
	case string:
		var err error
		actorID, err = uuid.Parse(v)
		if err != nil {
			return uuid.Nil, "", apierrors.New(
				apierrors.Unauthorized,
				"invalid user ID in context",
			)
		}
	default:
		return uuid.Nil, "", apierrors.New(
			apierrors.Unauthorized,
			"invalid user ID format in context",
		)
	}

	if actorID == uuid.Nil {
		return uuid.Nil, "", apierrors.New(
			apierrors.Unauthorized,
			"authenticated user ID is required",
		)
	}

	roleValue, exists := c.Get("auth_role")
	if !exists {
		roleValue, exists = c.Get("role")
	}
	if !exists {
		return uuid.Nil, "", apierrors.New(
			apierrors.Unauthorized,
			"authenticated role context is missing",
		)
	}

	actorRole, ok := roleValue.(string)
	if !ok || strings.TrimSpace(actorRole) == "" {
		return uuid.Nil, "", apierrors.New(
			apierrors.Unauthorized,
			"authenticated role context is missing",
		)
	}

	return actorID, actorRole, nil
}

// getApproverIDFromContext extracts actor user ID from context.
func getApproverIDFromContext(c *gin.Context) (uuid.UUID, error) {
	actorID, _, err := getAuthenticatedActor(c)
	return actorID, err
}
