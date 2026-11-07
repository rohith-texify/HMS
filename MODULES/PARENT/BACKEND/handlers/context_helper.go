package handlers

import (
	"errors"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// getTenantCollegeID extracts the tenant college UUID from the Gin context.
func getTenantCollegeID(c *gin.Context) (uuid.UUID, error) {
	keys := []string{"tenant_id", "college_id", "auth_college_id"}

	for _, key := range keys {
		if val, exists := c.Get(key); exists && val != nil {
			switch v := val.(type) {
			case uuid.UUID:
				if v != uuid.Nil {
					return v, nil
				}
			case string:
				if parsed, err := uuid.Parse(strings.TrimSpace(v)); err == nil && parsed != uuid.Nil {
					return parsed, nil
				}
			}
		}
	}

	return uuid.Nil, errors.New("tenant context is missing")
}

// getAuthenticatedUserID extracts the authenticated user UUID from the context.
func getAuthenticatedUserID(c *gin.Context) (uuid.UUID, error) {
	keys := []string{"user_id", "auth_user_id"}

	for _, key := range keys {
		if val, exists := c.Get(key); exists && val != nil {
			switch v := val.(type) {
			case uuid.UUID:
				if v != uuid.Nil {
					return v, nil
				}
			case string:
				if parsed, err := uuid.Parse(strings.TrimSpace(v)); err == nil && parsed != uuid.Nil {
					return parsed, nil
				}
			}
		}
	}

	return uuid.Nil, errors.New("authenticated user context is missing")
}

