package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	apiresponse "github.com/yourusername/hostel-management-system/API/pkg/response"
	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/services"
)

type StudentParentHandler struct {
	service *services.StudentParentService
}

func NewStudentParentHandler(
	studentParentService *services.StudentParentService,
) *StudentParentHandler {
	return &StudentParentHandler{
		service: studentParentService,
	}
}

type studentParentRequest struct {
	ParentID                uuid.UUID `json:"parent_id"`
	Relationship            string    `json:"relationship"`
	IsPrimary               bool      `json:"is_primary"`
	CanReceiveNotifications bool      `json:"can_receive_notifications"`
	CanPickupStudent        bool      `json:"can_pickup_student"`
}

func (h *StudentParentHandler) ListStudentParents(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		writeStudentParentError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	studentID, err := uuid.Parse(strings.TrimSpace(c.Param("student_id")))
	if err != nil {
		writeStudentParentError(c, http.StatusBadRequest, "invalid student id")
		return
	}

	limit := 50
	offset := 0

	if value := c.Query("limit"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			writeStudentParentError(c, http.StatusBadRequest, "invalid limit")
			return
		}
		limit = parsed
	}

	if value := c.Query("offset"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			writeStudentParentError(c, http.StatusBadRequest, "invalid offset")
			return
		}
		offset = parsed
	}

	items, err := h.service.ListStudentParents(c.Request.Context(), collegeID, studentID, limit, offset)
	if err != nil {
		h.writeError(c, err)
		return
	}

	apiresponse.OK(c, items)
}

func (h *StudentParentHandler) GetStudentParent(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		writeStudentParentError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	studentID, err := uuid.Parse(strings.TrimSpace(c.Param("student_id")))
	if err != nil {
		writeStudentParentError(c, http.StatusBadRequest, "invalid student id")
		return
	}

	relationshipID, err := uuid.Parse(strings.TrimSpace(c.Param("relationship_id")))
	if err != nil {
		writeStudentParentError(c, http.StatusBadRequest, "invalid relationship id")
		return
	}

	item, err := h.service.GetStudentParent(c.Request.Context(), collegeID, studentID, relationshipID)
	if err != nil {
		h.writeError(c, err)
		return
	}

	apiresponse.OK(c, item)
}

func (h *StudentParentHandler) CreateStudentParent(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		writeStudentParentError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	studentID, err := uuid.Parse(strings.TrimSpace(c.Param("student_id")))
	if err != nil {
		writeStudentParentError(c, http.StatusBadRequest, "invalid student id")
		return
	}

	var request studentParentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		writeStudentParentError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	if request.ParentID == uuid.Nil {
		writeStudentParentError(c, http.StatusBadRequest, "parent_id is required")
		return
	}

	item, err := h.service.CreateStudentParent(
		c.Request.Context(),
		repository.CreateStudentParentParams{
			CollegeID:               collegeID,
			StudentID:               studentID,
			ParentID:                request.ParentID,
			Relationship:            request.Relationship,
			IsPrimary:               request.IsPrimary,
			CanReceiveNotifications: request.CanReceiveNotifications,
			CanPickupStudent:        request.CanPickupStudent,
		},
	)
	if err != nil {
		h.writeError(c, err)
		return
	}

	apiresponse.Created(c, item)
}

func (h *StudentParentHandler) UpdateStudentParent(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		writeStudentParentError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	studentID, err := uuid.Parse(strings.TrimSpace(c.Param("student_id")))
	if err != nil {
		writeStudentParentError(c, http.StatusBadRequest, "invalid student id")
		return
	}

	relationshipID, err := uuid.Parse(strings.TrimSpace(c.Param("relationship_id")))
	if err != nil {
		writeStudentParentError(c, http.StatusBadRequest, "invalid relationship id")
		return
	}

	var request studentParentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		writeStudentParentError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	item, err := h.service.UpdateStudentParent(
		c.Request.Context(),
		repository.UpdateStudentParentParams{
			CollegeID:               collegeID,
			StudentID:               studentID,
			ID:                      relationshipID,
			Relationship:            request.Relationship,
			IsPrimary:               request.IsPrimary,
			CanReceiveNotifications: request.CanReceiveNotifications,
			CanPickupStudent:        request.CanPickupStudent,
		},
	)
	if err != nil {
		h.writeError(c, err)
		return
	}

	apiresponse.OK(c, item)
}

func (h *StudentParentHandler) DeleteStudentParent(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		writeStudentParentError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	studentID, err := uuid.Parse(strings.TrimSpace(c.Param("student_id")))
	if err != nil {
		writeStudentParentError(c, http.StatusBadRequest, "invalid student id")
		return
	}

	relationshipID, err := uuid.Parse(strings.TrimSpace(c.Param("relationship_id")))
	if err != nil {
		writeStudentParentError(c, http.StatusBadRequest, "invalid relationship id")
		return
	}

	err = h.service.DeleteStudentParent(c.Request.Context(), collegeID, studentID, relationshipID)
	if err != nil {
		h.writeError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *StudentParentHandler) writeError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, services.ErrInvalidStudentParentID),
		errors.Is(err, services.ErrInvalidStudentParentCollegeID),
		errors.Is(err, services.ErrInvalidStudentParentStudentID),
		errors.Is(err, services.ErrInvalidStudentParentParentID),
		errors.Is(err, services.ErrInvalidStudentParentRelation),
		errors.Is(err, services.ErrInvalidStudentParentPagination):

		writeStudentParentError(c, http.StatusBadRequest, err.Error())

	case errors.Is(err, services.ErrStudentParentNotFound):
		writeStudentParentError(c, http.StatusNotFound, "student-parent relationship not found")

	case errors.Is(err, services.ErrStudentParentConflict):
		writeStudentParentError(c, http.StatusConflict, "student-parent relationship already exists")

	default:
		writeStudentParentError(c, http.StatusInternalServerError, "internal server error")
	}
}

func writeStudentParentError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"success": false, "error": gin.H{"message": message}})
}

