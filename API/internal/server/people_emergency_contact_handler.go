package server

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/middleware"
	"github.com/yourusername/hostel-management-system/API/internal/service"
	apiresponse "github.com/yourusername/hostel-management-system/API/pkg/response"
)

type EmergencyContactHandler struct {
	service *service.EmergencyContactService
}

func NewEmergencyContactHandler(
	service *service.EmergencyContactService,
) *EmergencyContactHandler {
	return &EmergencyContactHandler{
		service: service,
	}
}

func (h *EmergencyContactHandler) getTenantID(
	c *gin.Context,
) (uuid.UUID, bool) {
	value, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		writeEmergencyContactError(
			c,
			http.StatusUnauthorized,
			"tenant context is missing",
		)
		return uuid.Nil, false
	}

	tenantID, ok := value.(uuid.UUID)
	if !ok || tenantID == uuid.Nil {
		writeEmergencyContactError(
			c,
			http.StatusUnauthorized,
			"invalid tenant context",
		)
		return uuid.Nil, false
	}

	return tenantID, true
}

func parseEmergencyStudentID(
	c *gin.Context,
) (uuid.UUID, bool) {
	studentID, err := uuid.Parse(c.Param("student_id"))
	if err != nil {
		writeEmergencyContactError(
			c,
			http.StatusBadRequest,
			"invalid student id",
		)
		return uuid.Nil, false
	}

	return studentID, true
}

func parseEmergencyContactID(
	c *gin.Context,
) (uuid.UUID, bool) {
	contactID, err := uuid.Parse(c.Param("contact_id"))
	if err != nil {
		writeEmergencyContactError(
			c,
			http.StatusBadRequest,
			"invalid emergency contact id",
		)
		return uuid.Nil, false
	}

	return contactID, true
}

func (h *EmergencyContactHandler) ListEmergencyContacts(
	c *gin.Context,
) {
	collegeID, ok := h.getTenantID(c)
	if !ok {
		return
	}

	studentID, ok := parseEmergencyStudentID(c)
	if !ok {
		return
	}

	contacts, err := h.service.ListEmergencyContacts(
		c.Request.Context(),
		collegeID,
		studentID,
	)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidEmergencyCollegeID),
			errors.Is(err, service.ErrInvalidEmergencyStudentID):
			writeEmergencyContactError(c, http.StatusBadRequest, err.Error())

		default:
			writeEmergencyContactError(
				c,
				http.StatusInternalServerError,
				"failed to list emergency contacts",
			)
		}

		return
	}

	apiresponse.OK(c, contacts)
}

func (h *EmergencyContactHandler) GetEmergencyContact(
	c *gin.Context,
) {
	collegeID, ok := h.getTenantID(c)
	if !ok {
		return
	}

	studentID, ok := parseEmergencyStudentID(c)
	if !ok {
		return
	}

	contactID, ok := parseEmergencyContactID(c)
	if !ok {
		return
	}

	contact, err := h.service.GetEmergencyContact(
		c.Request.Context(),
		collegeID,
		studentID,
		contactID,
	)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrEmergencyContactNotFound):
			writeEmergencyContactError(
				c,
				http.StatusNotFound,
				err.Error(),
			)

		case errors.Is(err, service.ErrInvalidEmergencyCollegeID),
			errors.Is(err, service.ErrInvalidEmergencyStudentID),
			errors.Is(err, service.ErrInvalidEmergencyContactID):
			writeEmergencyContactError(
				c,
				http.StatusBadRequest,
				err.Error(),
			)

		default:
			writeEmergencyContactError(
				c,
				http.StatusInternalServerError,
				"failed to get emergency contact",
			)
		}

		return
	}

	apiresponse.OK(c, contact)
}

func (h *EmergencyContactHandler) CreateEmergencyContact(
	c *gin.Context,
) {
	collegeID, ok := h.getTenantID(c)
	if !ok {
		return
	}

	studentID, ok := parseEmergencyStudentID(c)
	if !ok {
		return
	}

	var input service.EmergencyContactInput

	if err := c.ShouldBindJSON(&input); err != nil {
		writeEmergencyContactError(
			c,
			http.StatusBadRequest,
			"invalid emergency contact payload",
		)
		return
	}

	contact, err := h.service.CreateEmergencyContact(
		c.Request.Context(),
		collegeID,
		studentID,
		input,
	)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidEmergencyContactName),
			errors.Is(err, service.ErrInvalidEmergencyPhone),
			errors.Is(err, service.ErrInvalidEmergencyCollegeID),
			errors.Is(err, service.ErrInvalidEmergencyStudentID),
			errors.Is(err, service.ErrInvalidEmergencyContactPayload):
			writeEmergencyContactError(
				c,
				http.StatusBadRequest,
				err.Error(),
			)

		case errors.Is(err, service.ErrEmergencyContactConflict):
			writeEmergencyContactError(
				c,
				http.StatusConflict,
				err.Error(),
			)

		default:
			writeEmergencyContactError(
				c,
				http.StatusInternalServerError,
				"failed to create emergency contact",
			)
		}

		return
	}

	apiresponse.Created(c, contact)
}

func (h *EmergencyContactHandler) UpdateEmergencyContact(
	c *gin.Context,
) {
	collegeID, ok := h.getTenantID(c)
	if !ok {
		return
	}

	studentID, ok := parseEmergencyStudentID(c)
	if !ok {
		return
	}

	contactID, ok := parseEmergencyContactID(c)
	if !ok {
		return
	}

	var input service.EmergencyContactInput

	if err := c.ShouldBindJSON(&input); err != nil {
		writeEmergencyContactError(
			c,
			http.StatusBadRequest,
			"invalid emergency contact payload",
		)
		return
	}

	contact, err := h.service.UpdateEmergencyContact(
		c.Request.Context(),
		collegeID,
		studentID,
		contactID,
		input,
	)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidEmergencyContactName),
			errors.Is(err, service.ErrInvalidEmergencyPhone),
			errors.Is(err, service.ErrInvalidEmergencyCollegeID),
			errors.Is(err, service.ErrInvalidEmergencyStudentID),
			errors.Is(err, service.ErrInvalidEmergencyContactID):
			writeEmergencyContactError(
				c,
				http.StatusBadRequest,
				err.Error(),
			)

		case errors.Is(err, service.ErrEmergencyContactNotFound):
			writeEmergencyContactError(
				c,
				http.StatusNotFound,
				err.Error(),
			)

		case errors.Is(err, service.ErrEmergencyContactConflict):
			writeEmergencyContactError(
				c,
				http.StatusConflict,
				err.Error(),
			)

		default:
			writeEmergencyContactError(
				c,
				http.StatusInternalServerError,
				"failed to update emergency contact",
			)
		}

		return
	}

	apiresponse.OK(c, contact)
}

func (h *EmergencyContactHandler) DeleteEmergencyContact(
	c *gin.Context,
) {
	collegeID, ok := h.getTenantID(c)
	if !ok {
		return
	}

	studentID, ok := parseEmergencyStudentID(c)
	if !ok {
		return
	}

	contactID, ok := parseEmergencyContactID(c)
	if !ok {
		return
	}

	err := h.service.DeleteEmergencyContact(
		c.Request.Context(),
		collegeID,
		studentID,
		contactID,
	)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidEmergencyCollegeID),
			errors.Is(err, service.ErrInvalidEmergencyStudentID),
			errors.Is(err, service.ErrInvalidEmergencyContactID):
			writeEmergencyContactError(
				c,
				http.StatusBadRequest,
				err.Error(),
			)

		case errors.Is(err, service.ErrEmergencyContactNotFound):
			writeEmergencyContactError(
				c,
				http.StatusNotFound,
				err.Error(),
			)

		default:
			writeEmergencyContactError(
				c,
				http.StatusInternalServerError,
				"failed to delete emergency contact",
			)
		}

		return
	}

	c.Status(http.StatusNoContent)
}

func writeEmergencyContactError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"success": false, "error": gin.H{"message": message}})
}
