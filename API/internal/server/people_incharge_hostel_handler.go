package server

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/auth"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
	"github.com/yourusername/hostel-management-system/API/internal/service"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

type PeopleInchargeHostelHandler struct {
	service *service.InchargeHostelService
}

func NewPeopleInchargeHostelHandler(
	s *service.InchargeHostelService,
) *PeopleInchargeHostelHandler {
	return &PeopleInchargeHostelHandler{service: s}
}

type inchargeRequest struct {
	StaffID       string  `json:"staff_id" binding:"required"`
	AssignedFrom  string  `json:"assigned_from"`
	AssignedUntil *string `json:"assigned_until"`
	IsPrimary     bool    `json:"is_primary"`
}

type createInchargeAccountRequest struct {
	Name            string `json:"name" binding:"required"`
	HostelID        string `json:"hostel_id" binding:"required"`
	Email           string `json:"email" binding:"required"`
	Password        string `json:"password" binding:"required,min=8"`
	ConfirmPassword string `json:"confirm_password" binding:"required"`
	Phone           string `json:"phone"`
	Designation     string `json:"designation"`
	IsPrimary       *bool  `json:"is_primary"`
}

func parseDate(value string) (time.Time, error) {
	if value == "" {
		return time.Time{}, nil
	}

	return time.Parse("2006-01-02", value)
}

func parseNullableDate(value *string) (*time.Time, error) {
	if value == nil || *value == "" {
		return nil, nil
	}

	result, err := time.Parse("2006-01-02", *value)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

func (h *PeopleInchargeHostelHandler) List(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	hostelID, err := uuid.Parse(c.Param("hostel_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid hostel_id",
		})
		return
	}

	items, err := h.service.List(
		c.Request.Context(),
		collegeID,
		hostelID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	response.OK(c, items)
}

func (h *PeopleInchargeHostelHandler) Get(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	hostelID, err := uuid.Parse(c.Param("hostel_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid hostel_id",
		})
		return
	}

	assignmentID, err := uuid.Parse(c.Param("assignment_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid assignment_id",
		})
		return
	}

	item, err := h.service.Get(
		c.Request.Context(),
		collegeID,
		hostelID,
		assignmentID,
	)
	if err != nil {
		if err == repository.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "incharge assignment not found",
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

func (h *PeopleInchargeHostelHandler) Create(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	hostelID, err := uuid.Parse(c.Param("hostel_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid hostel_id",
		})
		return
	}

	var req inchargeRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	staffID, err := uuid.Parse(req.StaffID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid staff_id",
		})
		return
	}

	assignedFrom := time.Now().UTC()

	if req.AssignedFrom != "" {
		assignedFrom, err = parseDate(req.AssignedFrom)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "invalid assigned_from",
			})
			return
		}
	}

	assignedUntil, err := parseNullableDate(req.AssignedUntil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid assigned_until",
		})
		return
	}

	item, err := h.service.Create(
		c.Request.Context(),
		collegeID,
		hostelID,
		staffID,
		assignedFrom,
		assignedUntil,
		req.IsPrimary,
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

func (h *PeopleInchargeHostelHandler) CreateAccount(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	var req createInchargeAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	hostelID, err := uuid.Parse(strings.TrimSpace(req.HostelID))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid hostel_id",
		})
		return
	}

	isPrimary := true
	if req.IsPrimary != nil {
		isPrimary = *req.IsPrimary
	}

	result, err := h.service.CreateInchargeAccount(c.Request.Context(), collegeID, service.CreateInchargeAccountInput{
		Name:            strings.TrimSpace(req.Name),
		HostelID:        hostelID,
		Email:           strings.TrimSpace(req.Email),
		Password:        req.Password,
		ConfirmPassword: req.ConfirmPassword,
		Phone:           strings.TrimSpace(req.Phone),
		Designation:     strings.TrimSpace(req.Designation),
		IsPrimary:       isPrimary,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    result,
		"message": result.Message,
	})
}

func (h *PeopleInchargeHostelHandler) GetMyHostel(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "user context is missing",
		})
		return
	}
	userID := userIDValue.(uuid.UUID)

	item, err := h.service.GetMyHostel(c.Request.Context(), collegeID, userID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "No active hostel assignment found for your staff profile.",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    item,
	})
}

func (h *PeopleInchargeHostelHandler) ListResidents(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	var hostelID uuid.UUID
	hostelIDStr := strings.TrimSpace(c.Query("hostel_id"))
	if hostelIDStr != "" {
		parsed, err := uuid.Parse(hostelIDStr)
		if err == nil {
			hostelID = parsed
		}
	}

	if hostelID == uuid.Nil {
		userIDValue, exists := c.Get(auth.ContextUserIDKey)
		if exists {
			userID := userIDValue.(uuid.UUID)
			myHostel, err := h.service.GetMyHostel(c.Request.Context(), collegeID, userID)
			if err == nil && myHostel != nil {
				hostelID = myHostel.HostelID
			}
		}
	}

	if hostelID == uuid.Nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "hostel_id is required or no assigned hostel found for user",
		})
		return
	}

	residents, err := h.service.ListHostelResidents(c.Request.Context(), collegeID, hostelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    residents,
		"total":   len(residents),
	})
}

func (h *PeopleInchargeHostelHandler) ListVacantBeds(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	var hostelID uuid.UUID
	hostelIDStr := strings.TrimSpace(c.Query("hostel_id"))
	if hostelIDStr != "" {
		parsed, err := uuid.Parse(hostelIDStr)
		if err == nil {
			hostelID = parsed
		}
	}

	if hostelID == uuid.Nil {
		userIDValue, exists := c.Get(auth.ContextUserIDKey)
		if exists {
			userID := userIDValue.(uuid.UUID)
			myHostel, err := h.service.GetMyHostel(c.Request.Context(), collegeID, userID)
			if err == nil && myHostel != nil {
				hostelID = myHostel.HostelID
			}
		}
	}

	if hostelID == uuid.Nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "hostel_id is required or no assigned hostel found for user",
		})
		return
	}

	beds, err := h.service.ListVacantBeds(c.Request.Context(), collegeID, hostelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    beds,
		"total":   len(beds),
	})
}

func (h *PeopleInchargeHostelHandler) ListUnallocatedStudents(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	students, err := h.service.ListUnallocatedStudents(c.Request.Context(), collegeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    students,
		"total":   len(students),
	})
}

func (h *PeopleInchargeHostelHandler) Update(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	hostelID, err := uuid.Parse(c.Param("hostel_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid hostel_id",
		})
		return
	}

	assignmentID, err := uuid.Parse(c.Param("assignment_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid assignment_id",
		})
		return
	}

	var req inchargeRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	assignedFrom, err := parseDate(req.AssignedFrom)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid assigned_from",
		})
		return
	}

	assignedUntil, err := parseNullableDate(req.AssignedUntil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid assigned_until",
		})
		return
	}

	item, err := h.service.Update(
		c.Request.Context(),
		collegeID,
		hostelID,
		assignmentID,
		assignedFrom,
		assignedUntil,
		req.IsPrimary,
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

func (h *PeopleInchargeHostelHandler) Delete(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	hostelID, err := uuid.Parse(c.Param("hostel_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid hostel_id",
		})
		return
	}

	assignmentID, err := uuid.Parse(c.Param("assignment_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid assignment_id",
		})
		return
	}

	if err := h.service.Delete(
		c.Request.Context(),
		collegeID,
		hostelID,
		assignmentID,
	); err != nil {
		if err == repository.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "incharge assignment not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "incharge assignment deleted",
	})
}
