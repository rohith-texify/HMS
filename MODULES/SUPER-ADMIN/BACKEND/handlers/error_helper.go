package handlers

import (
	stderrors "errors"

	"github.com/gin-gonic/gin"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

// respondError preserves known API errors and hides unexpected internal errors.
func respondError(c *gin.Context, err error) {
	if err == nil {
		response.InternalError(c)
		return
	}

	var apiErr *apierrors.APIError
	if stderrors.As(err, &apiErr) {
		response.Error(c, apiErr)
		return
	}

	response.InternalError(c)
}
