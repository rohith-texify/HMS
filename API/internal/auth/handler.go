package auth

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

type loginRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (h *Handler) Login(c *gin.Context) {
	var req loginRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(
			c,
			apierrors.New(
				apierrors.ValidationError,
				"invalid login request",
			),
		)
		return
	}

	loginStart := time.Now()
	result, err := h.service.Login(
		c.Request.Context(),
		LoginRequest{
			Email:     req.Email,
			Password:  req.Password,
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
		},
	)
	loginDuration := time.Since(loginStart)

	// Log timing by storing in context (will be picked up by timing middleware)
	if dbTimes, exists := c.Get("db_query_times"); exists {
		dbTimesSlice, ok := dbTimes.([]map[string]interface{})
		if ok {
			dbTimesSlice = append(dbTimesSlice, map[string]interface{}{
				"query":       "auth.login",
				"duration":    loginDuration,
				"duration_ms": loginDuration.Milliseconds(),
				"rows":        int64(0),
			})
			c.Set("db_query_times", dbTimesSlice)
		}
	}

	if err != nil {
		if apiErr, ok := err.(*apierrors.APIError); ok {
			response.Error(c, apiErr)
			return
		}

		if h.service.logger != nil {
			h.service.logger.Error("authentication request failed", zap.Error(err))
		}

		response.Error(
			c,
			apierrors.New(
				apierrors.InternalError,
				"failed to authenticate user",
			),
		)
		return
	}

	response.JSON(
		c,
		http.StatusOK,
		gin.H{
			"user_id":      result.UserID,
			"email":        result.Email,
			"mfa_enabled":  result.MFAEnabled,
			"access_token": result.AccessToken,
			"expires_at":   result.ExpiresAt,
			"membership":   result.Membership,
		},
		nil,
	)
}
