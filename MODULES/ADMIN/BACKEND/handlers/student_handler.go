package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/models"
)

// ListStudents handles GET /admin/students.
func (h *StudentHandler) ListStudents(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var params models.PaginationParams
	if err := c.ShouldBindQuery(&params); err != nil {
		respondError(c, apierrors.New(apierrors.InvalidInput, "Invalid query parameters"))
		return
	}

	students, total, err := h.svc.ListStudents(c.Request.Context(), collegeID, params)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, gin.H{
		"students": students,
		"total":    total,
		"page":     params.Page,
		"limit":    params.Limit,
	})
}

// GetStudentByID handles GET /admin/students/:id.
func (h *StudentHandler) GetStudentByID(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	idStr := c.Param("id")
	studentID, err := uuid.Parse(idStr)
	if err != nil {
		respondError(c, apierrors.New(apierrors.InvalidInput, "Invalid student ID parameter"))
		return
	}

	student, err := h.svc.GetStudentByID(c.Request.Context(), collegeID, studentID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, student)
}

// UpdateStudentStatus handles PATCH /admin/students/:id/status.
func (h *StudentHandler) UpdateStudentStatus(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	idStr := c.Param("id")
	studentID, err := uuid.Parse(idStr)
	if err != nil {
		respondError(c, apierrors.New(apierrors.InvalidInput, "Invalid student ID parameter"))
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierrors.New(apierrors.InvalidInput, "Status payload required"))
		return
	}

	if err := h.svc.UpdateStudentStatus(c.Request.Context(), collegeID, studentID, req.Status); err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, gin.H{"status": "updated", "student_id": studentID})
}

// ListStudentParents handles GET /admin/students/:id/parents.
func (h *StudentHandler) ListStudentParents(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	idStr := c.Param("id")
	studentID, err := uuid.Parse(idStr)
	if err != nil {
		respondError(c, apierrors.New(apierrors.InvalidInput, "Invalid student ID parameter"))
		return
	}

	parents, err := h.svc.ListStudentParents(c.Request.Context(), collegeID, studentID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, gin.H{"parents": parents})
}
