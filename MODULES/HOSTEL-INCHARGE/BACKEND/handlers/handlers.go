package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/HOSTEL-INCHARGE/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/HOSTEL-INCHARGE/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/HOSTEL-INCHARGE/BACKEND/services"
)

// InchargeHandler manages endpoints for the Hostel In-Charge workspace.
type InchargeHandler struct {
	svc *services.InchargeService
}

// NewInchargeHandler constructs a new InchargeHandler.
func NewInchargeHandler(svc *services.InchargeService) *InchargeHandler {
	return &InchargeHandler{svc: svc}
}

// GetMyHostel resolves the assigned hostel profile for the authenticated incharge.
func (h *InchargeHandler) GetMyHostel(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	profile, err := h.svc.GetMyHostel(c.Request.Context(), collegeID, userID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "No active hostel assignment found for your staff profile.",
			})
			return
		}
		respondError(c, apierrors.New(apierrors.InternalError, err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    profile,
	})
}

// ListResidents returns resident students enrolled in the assigned hostel.
func (h *InchargeHandler) ListResidents(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
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

	// Auto-resolve assigned hostel if not explicitly provided
	if hostelID == uuid.Nil {
		userID, err := getAuthenticatedUserID(c)
		if err == nil {
			if prof, err := h.svc.GetMyHostel(c.Request.Context(), collegeID, userID); err == nil && prof != nil {
				hostelID = prof.HostelID
			}
		}
	}

	if hostelID == uuid.Nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "hostel_id parameter is required or staff profile has no assigned hostel",
		})
		return
	}

	residents, err := h.svc.ListResidents(c.Request.Context(), collegeID, hostelID)
	if err != nil {
		respondError(c, apierrors.New(apierrors.InternalError, err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    residents,
		"count":   len(residents),
	})
}

// ListVacantBeds returns available beds in the assigned hostel.
func (h *InchargeHandler) ListVacantBeds(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
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
		userID, err := getAuthenticatedUserID(c)
		if err == nil {
			if prof, err := h.svc.GetMyHostel(c.Request.Context(), collegeID, userID); err == nil && prof != nil {
				hostelID = prof.HostelID
			}
		}
	}

	if hostelID == uuid.Nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "hostel_id parameter is required or staff profile has no assigned hostel",
		})
		return
	}

	beds, err := h.svc.ListVacantBeds(c.Request.Context(), collegeID, hostelID)
	if err != nil {
		respondError(c, apierrors.New(apierrors.InternalError, err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    beds,
		"count":   len(beds),
	})
}

// ListUnallocatedStudents returns college students waiting for bed allocation.
func (h *InchargeHandler) ListUnallocatedStudents(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	students, err := h.svc.ListUnallocatedStudents(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, apierrors.New(apierrors.InternalError, err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    students,
		"count":   len(students),
	})
}

// GetDashboardSummary aggregates live hostel metrics for the incharge dashboard.
func (h *InchargeHandler) GetDashboardSummary(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
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
		userID, err := getAuthenticatedUserID(c)
		if err == nil {
			if prof, err := h.svc.GetMyHostel(c.Request.Context(), collegeID, userID); err == nil && prof != nil {
				hostelID = prof.HostelID
			}
		}
	}

	if hostelID == uuid.Nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "hostel_id parameter is required or staff profile has no assigned hostel",
		})
		return
	}

	summary, err := h.svc.GetDashboardSummary(c.Request.Context(), collegeID, hostelID)
	if err != nil {
		respondError(c, apierrors.New(apierrors.InternalError, err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    summary,
	})
}

// CreateAccount provisions a new incharge login and links them to the hostel.
func (h *InchargeHandler) CreateAccount(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var req struct {
		Name            string `json:"name" binding:"required"`
		HostelID        string `json:"hostel_id" binding:"required"`
		Email           string `json:"email" binding:"required"`
		Password        string `json:"password" binding:"required,min=8"`
		ConfirmPassword string `json:"confirm_password" binding:"required"`
		Phone           string `json:"phone"`
		Designation     string `json:"designation"`
		IsPrimary       *bool  `json:"is_primary"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	hostelUUID, err := uuid.Parse(strings.TrimSpace(req.HostelID))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid hostel_id format",
		})
		return
	}

	isPrimary := true
	if req.IsPrimary != nil {
		isPrimary = *req.IsPrimary
	}

	result, err := h.svc.CreateInchargeAccount(c.Request.Context(), collegeID, models.CreateInchargeAccountInput{
		Name:            strings.TrimSpace(req.Name),
		HostelID:        hostelUUID,
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
		"message": "Hostel Incharge account successfully created.",
	})
}

