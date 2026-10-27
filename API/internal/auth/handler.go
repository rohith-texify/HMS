package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"

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

	result, err := h.service.Login(
		c.Request.Context(),
		LoginRequest{
			Email:     req.Email,
			Password:  req.Password,
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
		},
	)

	if err != nil {
		if apiErr, ok := err.(*apierrors.APIError); ok {
			response.Error(c, apiErr)
			return
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
