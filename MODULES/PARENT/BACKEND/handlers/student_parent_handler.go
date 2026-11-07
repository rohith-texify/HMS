package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	apiresponse "github.com/yourusername/hostel-management-system/API/pkg/response"
	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/services"
)

// StudentParentHandler handles HTTP endpoints linking parents with students.
type StudentParentHandler struct {
	service *services.StudentParentService
}

// NewStudentParentHandler constructs a StudentParentHandler.
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

// ListStudentParents handles GET /students/:student_id/parents.
func (h *StudentParentHandler) ListStudentParents(c *gin.Context) {
	collegeID, err := getTenantCollegeID(c)
	if err != nil {
		writeError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	studentID, err := uuid.Parse(strings.TrimSpace(c.Param("student_id")))
	if err != nil {
		writeError(c, http.StatusBadRequest, "invalid student id")
		return
	}

	limit := 50
	offset := 0

	if value := c.Query("limit"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			writeError(c, http.StatusBadRequest, "invalid limit")
			return
		}
		limit = parsed
	}

	if value := c.Query("offset"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			writeError(c, http.StatusBadRequest, "invalid offset")
			return
		}
		offset = parsed
	}

	items, err := h.service.ListStudentParents(
		c.Request.Context(),
		collegeID,
		studentID,
		limit,
		offset,
	)
	if err != nil {
		respondStudentParentError(c, err)
		return
	}

	apiresponse.OK(c, items)
}

// GetStudentParent handles GET /students/:student_id/parents/:relationship_id.
func (h *StudentParentHandler) GetStudentParent(c *gin.Context) {
	collegeID, err := getTenantCollegeID(c)
	if err != nil {
		writeError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	studentID, err := uuid.Parse(strings.TrimSpace(c.Param("student_id")))
	if err != nil {
		writeError(c, http.StatusBadRequest, "invalid student id")
		return
	}

	relationshipID, err := uuid.Parse(strings.TrimSpace(c.Param("relationship_id")))
	if err != nil {
		writeError(c, http.StatusBadRequest, "invalid relationship id")
		return
	}

	item, err := h.service.GetStudentParent(
		c.Request.Context(),
		collegeID,
		studentID,
		relationshipID,
	)
	if err != nil {
		respondStudentParentError(c, err)
		return
	}

	apiresponse.OK(c, item)
}

// CreateStudentParent handles POST /students/:student_id/parents.
func (h *StudentParentHandler) CreateStudentParent(c *gin.Context) {
	collegeID, err := getTenantCollegeID(c)
	if err != nil {
		writeError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	studentID, err := uuid.Parse(strings.TrimSpace(c.Param("student_id")))
	if err != nil {
		writeError(c, http.StatusBadRequest, "invalid student id")
		return
	}

	var request studentParentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		writeError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	if request.ParentID == uuid.Nil {
		writeError(c, http.StatusBadRequest, "parent_id is required")
		return
	}

	item, err := h.service.CreateStudentParent(
		c.Request.Context(),
		models.CreateStudentParentParams{
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
		respondStudentParentError(c, err)
		return
	}

	apiresponse.Created(c, item)
}

// UpdateStudentParent handles PUT /students/:student_id/parents/:relationship_id.
func (h *StudentParentHandler) UpdateStudentParent(c *gin.Context) {
	collegeID, err := getTenantCollegeID(c)
	if err != nil {
		writeError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	studentID, err := uuid.Parse(strings.TrimSpace(c.Param("student_id")))
	if err != nil {
		writeError(c, http.StatusBadRequest, "invalid student id")
		return
	}

	relationshipID, err := uuid.Parse(strings.TrimSpace(c.Param("relationship_id")))
	if err != nil {
		writeError(c, http.StatusBadRequest, "invalid relationship id")
		return
	}

	var request studentParentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		writeError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	item, err := h.service.UpdateStudentParent(
		c.Request.Context(),
		models.UpdateStudentParentParams{
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
		respondStudentParentError(c, err)
		return
	}

	apiresponse.OK(c, item)
}

// DeleteStudentParent handles DELETE /students/:student_id/parents/:relationship_id.
func (h *StudentParentHandler) DeleteStudentParent(c *gin.Context) {
	collegeID, err := getTenantCollegeID(c)
	if err != nil {
		writeError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	studentID, err := uuid.Parse(strings.TrimSpace(c.Param("student_id")))
	if err != nil {
		writeError(c, http.StatusBadRequest, "invalid student id")
		return
	}

	relationshipID, err := uuid.Parse(strings.TrimSpace(c.Param("relationship_id")))
	if err != nil {
		writeError(c, http.StatusBadRequest, "invalid relationship id")
		return
	}

	err = h.service.DeleteStudentParent(
		c.Request.Context(),
		collegeID,
		studentID,
		relationshipID,
	)
	if err != nil {
		respondStudentParentError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

