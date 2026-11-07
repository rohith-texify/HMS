package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/services"
	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/validators"
)

// writeError outputs a uniform JSON error payload.
func writeError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{
		"success": false,
		"error": gin.H{
			"message": message,
		},
	})
}

// respondParentError maps domain errors to appropriate HTTP status codes.
func respondParentError(c *gin.Context, err error) {
	if err == nil {
		writeError(c, http.StatusInternalServerError, "internal server error")
		return
	}

	switch {
	case errors.Is(err, services.ErrInvalidParentID),
		errors.Is(err, services.ErrInvalidParentCollegeID),
		errors.Is(err, services.ErrInvalidParentFirstName),
		errors.Is(err, services.ErrInvalidParentPagination),
		errors.Is(err, validators.ErrPasswordTooShort),
		errors.Is(err, validators.ErrPasswordMismatch),
		errors.Is(err, validators.ErrEmailRequiredForAccount):
		writeError(c, http.StatusBadRequest, err.Error())

	case errors.Is(err, services.ErrParentNotFound):
		writeError(c, http.StatusNotFound, "parent not found")

	case errors.Is(err, services.ErrParentConflict):
		writeError(c, http.StatusConflict, "parent conflict")

	default:
		// If custom error message mentions quota or limit, forward description
		msg := err.Error()
		if len(msg) > 0 && (errors.Is(err, errors.New(msg))) {
			writeError(c, http.StatusBadRequest, msg)
			return
		}
		writeError(c, http.StatusInternalServerError, "internal server error")
	}
}

// respondStudentParentError maps student-parent domain errors to HTTP statuses.
func respondStudentParentError(c *gin.Context, err error) {
	if err == nil {
		writeError(c, http.StatusInternalServerError, "internal server error")
		return
	}

	switch {
	case errors.Is(err, services.ErrInvalidStudentParentID),
		errors.Is(err, services.ErrInvalidStudentParentCollegeID),
		errors.Is(err, services.ErrInvalidStudentParentStudentID),
		errors.Is(err, services.ErrInvalidStudentParentParentID),
		errors.Is(err, services.ErrInvalidStudentParentRelation),
		errors.Is(err, services.ErrInvalidStudentParentPagination):
		writeError(c, http.StatusBadRequest, err.Error())

	case errors.Is(err, services.ErrStudentParentNotFound):
		writeError(c, http.StatusNotFound, "student-parent relationship not found")

	case errors.Is(err, services.ErrStudentParentConflict):
		writeError(c, http.StatusConflict, "student-parent relationship already exists")

	default:
		writeError(c, http.StatusInternalServerError, "internal server error")
	}
}

