package handlers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/pkg/response"
	"github.com/yourusername/hostel-management-system/MODULES/HOSTEL-INCHARGE/BACKEND/models"
	inchargerepo "github.com/yourusername/hostel-management-system/MODULES/HOSTEL-INCHARGE/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/HOSTEL-INCHARGE/BACKEND/services"
)

// InchargeHandler handles HTTP endpoints for hostel in-charge management.
type InchargeHandler struct {
	service *services.InchargeService
}

// NewInchargeHandler instantiates a new InchargeHandler.
func NewInchargeHandler(service *services.InchargeService) *InchargeHandler {
	return &InchargeHandler{service: service}
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

func getTenantID(c *gin.Context) (uuid.UUID, bool) {
	keys := []string{"auth_tenant_id", "tenant_id", "college_id"}
	for _, k := range keys {
		if val, exists := c.Get(k); exists {
			switch v := val.(type) {
			case uuid.UUID:
				if v != uuid.Nil {
					return v, true
				}
			case string:
				if parsed, err := uuid.Parse(v); err == nil && parsed != uuid.Nil {
					return parsed, true
				}
			}
		}
	}
	if hdr := c.GetHeader("X-College-ID"); hdr != "" {
		if parsed, err := uuid.Parse(hdr); err == nil && parsed != uuid.Nil {
			return parsed, true
		}
	}
	return uuid.Nil, false
}

func getUserID(c *gin.Context) (uuid.UUID, bool) {
	keys := []string{"auth_user_id", "user_id", "auth_user", "userId"}
	for _, k := range keys {
		if val, exists := c.Get(k); exists {
			switch v := val.(type) {
			case uuid.UUID:
				if v != uuid.Nil {
					return v, true
				}
			case string:
				if parsed, err := uuid.Parse(v); err == nil && parsed != uuid.Nil {
					return parsed, true
				}
			}
		}
	}
	return uuid.Nil, false
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

// List returns in-charges for a specific hostel.
func (h *InchargeHandler) List(c *gin.Context) {
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

	items, err := h.service.List(c.Request.Context(), collegeID, hostelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	response.OK(c, items)
}

// Get returns a specific in-charge assignment.
func (h *InchargeHandler) Get(c *gin.Context) {
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

	item, err := h.service.Get(c.Request.Context(), collegeID, hostelID, assignmentID)
	if err != nil {
		if errors.Is(err, inchargerepo.ErrNotFound) {
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

// Create assigns existing staff as an in-charge.
func (h *InchargeHandler) Create(c *gin.Context) {
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

// CreateAccount provisions an in-charge user, staff record, and hostel assignment transactionally.
func (h *InchargeHandler) CreateAccount(c *gin.Context) {
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

	result, err := h.service.CreateInchargeAccount(c.Request.Context(), collegeID, models.CreateInchargeAccountInput{
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

// GetMyHostel returns the hostel assigned to the logged-in user.
func (h *InchargeHandler) GetMyHostel(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "user context is missing",
		})
		return
	}

	item, err := h.service.GetMyHostel(c.Request.Context(), collegeID, userID)
	if err != nil {
		if errors.Is(err, inchargerepo.ErrNotFound) {
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

// ListResidents returns residents in the in-charge's hostel.
func (h *InchargeHandler) ListResidents(c *gin.Context) {
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
		if parsed, err := uuid.Parse(hostelIDStr); err == nil {
			hostelID = parsed
		}
	}

	if hostelID == uuid.Nil {
		if userID, ok := getUserID(c); ok {
			if myHostel, err := h.service.GetMyHostel(c.Request.Context(), collegeID, userID); err == nil && myHostel != nil {
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

// ListVacantBeds returns vacant beds in the in-charge's hostel.
func (h *InchargeHandler) ListVacantBeds(c *gin.Context) {
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
		if parsed, err := uuid.Parse(hostelIDStr); err == nil {
			hostelID = parsed
		}
	}

	if hostelID == uuid.Nil {
		if userID, ok := getUserID(c); ok {
			if myHostel, err := h.service.GetMyHostel(c.Request.Context(), collegeID, userID); err == nil && myHostel != nil {
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

// ListUnallocatedStudents returns students who have not yet been assigned a room/bed.
func (h *InchargeHandler) ListUnallocatedStudents(c *gin.Context) {
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

// Update modifies an in-charge assignment.
func (h *InchargeHandler) Update(c *gin.Context) {
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

// Delete removes an in-charge assignment.
func (h *InchargeHandler) Delete(c *gin.Context) {
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

	if err := h.service.Delete(c.Request.Context(), collegeID, hostelID, assignmentID); err != nil {
		if errors.Is(err, inchargerepo.ErrNotFound) {
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


// GetDashboardSummary returns live operational counts and summary for the incharge's hostel.
func (h *InchargeHandler) GetDashboardSummary(c *gin.Context) {
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
		if parsed, err := uuid.Parse(hostelIDStr); err == nil {
			hostelID = parsed
		}
	}

	if hostelID == uuid.Nil {
		if userID, ok := getUserID(c); ok {
			if myHostel, err := h.service.GetMyHostel(c.Request.Context(), collegeID, userID); err == nil && myHostel != nil {
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

	summary, err := h.service.GetDashboardSummary(c.Request.Context(), collegeID, hostelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    summary,
	})
}
