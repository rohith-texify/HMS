package handlers

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
)

// StaffHandler handles HTTP requests for company / platform staff management.
type StaffHandler struct {
	service *services.StaffService
}

// NewStaffHandler creates a new StaffHandler.
func NewStaffHandler(service *services.StaffService) *StaffHandler {
	return &StaffHandler{
		service: service,
	}
}

// ListPlatformStaff handles GET /super-admin/staff - list company / platform staff.
func (h *StaffHandler) ListPlatformStaff(c *gin.Context) {
	var params models.ListPlatformStaffParams
	if err := c.ShouldBindQuery(&params); err != nil {
		respondError(c, validators.NewValidationError("Invalid query parameters"))
		return
	}

	res, err := h.service.ListPlatformStaff(c.Request.Context(), params)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, res)
}

// GetPlatformStaff handles GET /super-admin/staff/:user_id - get single staff member.
func (h *StaffHandler) GetPlatformStaff(c *gin.Context) {
	userIDStr := c.Param("user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid staff user ID"))
		return
	}

	staff, err := h.service.GetPlatformStaff(c.Request.Context(), userID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"staff": staff,
	})
}

// UpdatePlatformStaffProfile handles PATCH /super-admin/staff/:user_id - edit permitted profile fields.
func (h *StaffHandler) UpdatePlatformStaffProfile(c *gin.Context) {
	userIDStr := c.Param("user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid staff user ID"))
		return
	}

	var req models.UpdatePlatformStaffProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body"))
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	ctx = context.WithValue(ctx, services.ActorRoleContextKey, actorRole)

	staff, err := h.service.UpdatePlatformStaffProfile(ctx, userID, req)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"staff": staff,
	})
}

// UpdatePlatformStaffStatus handles PUT /super-admin/staff/:user_id/status - activate or deactivate staff member.
func (h *StaffHandler) UpdatePlatformStaffStatus(c *gin.Context) {
	userIDStr := c.Param("user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid staff user ID"))
		return
	}

	var req models.UpdatePlatformStaffStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body: status (ACTIVE, SUSPENDED, DEACTIVATED) and reason are required"))
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	ctx = context.WithValue(ctx, services.ActorRoleContextKey, actorRole)

	staff, err := h.service.UpdatePlatformStaffStatus(ctx, userID, req)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"staff": staff,
	})
}

// GetPlatformStaffPendingApprovals handles GET /super-admin/staff/:user_id/pending-approvals - inspect pending approvals for staff.
func (h *StaffHandler) GetPlatformStaffPendingApprovals(c *gin.Context) {
	userIDStr := c.Param("user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid staff user ID"))
		return
	}

	res, err := h.service.GetPlatformStaffPendingApprovals(c.Request.Context(), userID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, res)
}
