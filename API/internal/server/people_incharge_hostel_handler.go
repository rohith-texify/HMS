package server

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

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
