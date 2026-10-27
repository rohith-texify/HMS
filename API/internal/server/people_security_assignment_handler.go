package server

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
	"github.com/yourusername/hostel-management-system/API/internal/service"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

type PeopleSecurityAssignmentHandler struct {
	service *service.SecurityAssignmentService
}

func NewPeopleSecurityAssignmentHandler(
	s *service.SecurityAssignmentService,
) *PeopleSecurityAssignmentHandler {
	return &PeopleSecurityAssignmentHandler{
		service: s,
	}
}

type securityAssignmentRequest struct {
	StaffID       string  `json:"staff_id" binding:"required"`
	GateID        string  `json:"gate_id" binding:"required"`
	ShiftName     string  `json:"shift_name"`
	ShiftStart    *string `json:"shift_start"`
	ShiftEnd      *string `json:"shift_end"`
	AssignedFrom  string  `json:"assigned_from"`
	AssignedUntil *string `json:"assigned_until"`
	IsActive      bool    `json:"is_active"`
}

func (h *PeopleSecurityAssignmentHandler) List(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	items, err := h.service.List(
		c.Request.Context(),
		collegeID,
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

func (h *PeopleSecurityAssignmentHandler) Get(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
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
		assignmentID,
	)
	if err != nil {
		if err == repository.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "security assignment not found",
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

func (h *PeopleSecurityAssignmentHandler) Create(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	var req securityAssignmentRequest

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

	gateID, err := uuid.Parse(req.GateID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid gate_id",
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
		staffID,
		gateID,
		strings.TrimSpace(req.ShiftName),
		req.ShiftStart,
		req.ShiftEnd,
		assignedFrom,
		assignedUntil,
		req.IsActive,
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

func (h *PeopleSecurityAssignmentHandler) Update(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
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

	var req securityAssignmentRequest

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
		assignmentID,
		strings.TrimSpace(req.ShiftName),
		req.ShiftStart,
		req.ShiftEnd,
		assignedFrom,
		assignedUntil,
		req.IsActive,
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

func (h *PeopleSecurityAssignmentHandler) Delete(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
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
		assignmentID,
	); err != nil {
		if err == repository.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "security assignment not found",
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
		"message": "security assignment deleted",
	})
}
