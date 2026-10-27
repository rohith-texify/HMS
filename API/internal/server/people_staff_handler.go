package server

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/middleware"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
	"github.com/yourusername/hostel-management-system/API/internal/service"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

type PeopleStaffHandler struct {
	service *service.StaffService
}

func NewPeopleStaffHandler(
	staffService *service.StaffService,
) *PeopleStaffHandler {
	return &PeopleStaffHandler{
		service: staffService,
	}
}

type createStaffRequest struct {
	UserID           string `json:"user_id" binding:"required"`
	EmployeeNumber   string `json:"employee_number"`
	FirstName        string `json:"first_name" binding:"required"`
	MiddleName       string `json:"middle_name"`
	LastName         string `json:"last_name"`
	Designation      string `json:"designation"`
	DepartmentID     string `json:"department_id"`
	Phone            string `json:"phone"`
	AlternatePhone   string `json:"alternate_phone"`
	Email            string `json:"email"`
	JoiningDate      string `json:"joining_date"`
	EmploymentStatus string `json:"employment_status"`
}

type updateStaffRequest struct {
	EmployeeNumber string `json:"employee_number"`
	FirstName      string `json:"first_name" binding:"required"`
	MiddleName     string `json:"middle_name"`
	LastName       string `json:"last_name"`
	Designation    string `json:"designation"`
	DepartmentID   string `json:"department_id"`
	Phone          string `json:"phone"`
	AlternatePhone string `json:"alternate_phone"`
	Email          string `json:"email"`
	JoiningDate    string `json:"joining_date"`
}

type updateStaffStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

func (h *PeopleStaffHandler) tenantID(c *gin.Context) (uuid.UUID, bool) {
	value, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		return uuid.Nil, false
	}

	id, ok := value.(uuid.UUID)
	return id, ok && id != uuid.Nil
}

func parseOptionalUUID(value string) (*uuid.UUID, error) {
	value = strings.TrimSpace(value)

	if value == "" {
		return nil, nil
	}

	id, err := uuid.Parse(value)
	if err != nil {
		return nil, err
	}

	return &id, nil
}

func parseOptionalDate(value string) (*string, error) {
	value = strings.TrimSpace(value)

	if value == "" {
		return nil, nil
	}

	if len(value) != 10 {
		return nil, gin.Error{}
	}

	return &value, nil
}

func (h *PeopleStaffHandler) List(c *gin.Context) {
	collegeID, ok := h.tenantID(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	items, err := h.service.List(c.Request.Context(), collegeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	response.OK(c, items)
}

func (h *PeopleStaffHandler) Get(c *gin.Context) {
	collegeID, ok := h.tenantID(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	staffID, err := uuid.Parse(c.Param("staff_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid staff_id",
		})
		return
	}

	item, err := h.service.Get(
		c.Request.Context(),
		collegeID,
		staffID,
	)
	if err != nil {
		if err == repository.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "staff profile not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	response.OK(c, item)
}

func (h *PeopleStaffHandler) Create(c *gin.Context) {
	collegeID, ok := h.tenantID(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	var req createStaffRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid user_id",
		})
		return
	}

	var departmentID *uuid.UUID

	if strings.TrimSpace(req.DepartmentID) != "" {
		departmentID, err = parseOptionalUUID(req.DepartmentID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "invalid department_id",
			})
			return
		}
	}

	item, err := h.service.Create(
		c.Request.Context(),
		collegeID,
		service.CreateStaffInput{
			UserID:           userID,
			EmployeeNumber:   strings.TrimSpace(req.EmployeeNumber),
			FirstName:        strings.TrimSpace(req.FirstName),
			MiddleName:       strings.TrimSpace(req.MiddleName),
			LastName:         strings.TrimSpace(req.LastName),
			Designation:      strings.TrimSpace(req.Designation),
			DepartmentID:     departmentID,
			Phone:            strings.TrimSpace(req.Phone),
			AlternatePhone:   strings.TrimSpace(req.AlternatePhone),
			Email:            strings.TrimSpace(req.Email),
			JoiningDate:      strings.TrimSpace(req.JoiningDate),
			EmploymentStatus: strings.TrimSpace(req.EmploymentStatus),
		},
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	response.Created(c, item)
}

func (h *PeopleStaffHandler) Update(c *gin.Context) {
	collegeID, ok := h.tenantID(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	staffID, err := uuid.Parse(c.Param("staff_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid staff_id",
		})
		return
	}

	var req updateStaffRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	item, err := h.service.Update(
		c.Request.Context(),
		collegeID,
		staffID,
		service.UpdateStaffInput{
			EmployeeNumber: strings.TrimSpace(req.EmployeeNumber),
			FirstName:      strings.TrimSpace(req.FirstName),
			MiddleName:     strings.TrimSpace(req.MiddleName),
			LastName:       strings.TrimSpace(req.LastName),
			Designation:    strings.TrimSpace(req.Designation),
			Phone:          strings.TrimSpace(req.Phone),
			AlternatePhone: strings.TrimSpace(req.AlternatePhone),
			Email:          strings.TrimSpace(req.Email),
			JoiningDate:    strings.TrimSpace(req.JoiningDate),
		},
	)
	if err != nil {
		if err == repository.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "staff profile not found",
			})
			return
		}

		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	response.OK(c, item)
}

func (h *PeopleStaffHandler) UpdateStatus(c *gin.Context) {
	collegeID, ok := h.tenantID(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	staffID, err := uuid.Parse(c.Param("staff_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid staff_id",
		})
		return
	}

	var req updateStaffStatusRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	item, err := h.service.UpdateStatus(
		c.Request.Context(),
		collegeID,
		staffID,
		strings.TrimSpace(req.Status),
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	response.OK(c, item)
}
