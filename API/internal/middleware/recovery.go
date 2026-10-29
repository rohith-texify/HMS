package middleware

import (
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

func Recovery(logger *zap.Logger) gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered interface{}) {
		requestID := getRequestID(c)

		logger.Error(
			"panic recovered",
			zap.String("request_id", requestID),
			zap.Any("panic", recovered),
			zap.String("path", c.Request.URL.Path),
			zap.String("method", c.Request.Method),
		)

		err := apierrors.New(
			apierrors.InternalError,
			"an unexpected internal server error occurred",
		)

		// Safely write controlled JSON error envelope with request_id
		response.Error(c, err)

		// Abort execution without attempting redundant header writes
		c.Abort()
	})
}
