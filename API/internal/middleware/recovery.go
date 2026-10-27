package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

func Recovery(logger *zap.Logger) gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered interface{}) {
		logger.Error("panic recovered", zap.Any("panic", recovered), zap.String("path", c.Request.URL.Path))

		err := apierrors.New(
			apierrors.InternalError,
			"an unexpected internal server error occurred",
		)

		response.Error(c, err)

		c.AbortWithStatus(http.StatusInternalServerError)
	})
}
