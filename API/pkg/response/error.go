package response

import (
	"net/http"

	"github.com/gin-gonic/gin"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
)

func Error(c *gin.Context, err *apierrors.APIError) {
	status := apierrors.HTTPStatus(err)
	requestID := c.GetString("request_id")

	// SECURITY: Only expose code and message to clients.
	// Never leak internal details (SQL errors, stack traces, file paths, etc.)
	safeError := map[string]interface{}{
		"code":    err.Code,
		"message": err.Message,
	}

	c.JSON(status, ErrorResponse{
		Success:   false,
		Error:     safeError,
		RequestID: requestID,
	})
}

func InternalError(c *gin.Context) {
	status := http.StatusInternalServerError
	requestID := c.GetString("request_id")

	c.JSON(status, ErrorResponse{
		Success: false,
		Error: map[string]interface{}{
			"code":    apierrors.InternalError,
			"message": "An unexpected error occurred",
		},
		RequestID: requestID,
	})
}
