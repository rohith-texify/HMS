package handlers

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
)

// CollegeHandler handles HTTP requests for college management.
type CollegeHandler struct {
	service *services.CollegeService
}

// NewCollegeHandler creates a new college handler.
func NewCollegeHandler(service *services.CollegeService) *CollegeHandler {
	return &CollegeHandler{
		service: service,
	}
}

func parseCollegeIDParam(c *gin.Context) (uuid.UUID, error) {
	idStr := c.Param("id")
	if idStr == "" {
		idStr = c.Param("college_id")
	}
	return validators.ValidateCollegeID(idStr)
}

// ListColleges handles GET /colleges - list all colleges with optional filtering and pagination.
// @Summary List colleges
// @Description Retrieve a list of colleges with optional status filter and pagination
// @Tags Colleges
// @Accept json
// @Produce json
// @Param status query string false "Filter by status (ONBOARDING, ACTIVE, SUSPENDED, DEACTIVATED)"
// @Param limit query int false "Limit (default 20, max 100)"
// @Param offset query int false "Offset (default 0)"
// @Success 200 {object} response.Response{data=[]models.College,meta=models.PaginationMeta}
// @Failure 400 {object} response.ErrorResponse
// @Failure 401 {object} response.ErrorResponse
// @Failure 403 {object} response.ErrorResponse
// @Failure 500 {object} response.ErrorResponse
// @Router /colleges [get]
// @Security BearerAuth
func (h *CollegeHandler) ListColleges(c *gin.Context) {
	// Parse query parameters
	var params models.ListCollegesParams
	if err := c.ShouldBindQuery(&params); err != nil {
		respondError(c, validators.NewValidationError("Invalid query parameters"))
		return
	}

	// Validate parameters
	if err := validators.ValidateListCollegesParams(&params); err != nil {
		respondError(c, err)
		return
	}

	// Call service
	colleges, meta, err := h.service.ListColleges(c.Request.Context(), params)
	if err != nil {
		respondError(c, err)
		return
	}

	// Return response with pagination metadata
	response.WithMeta(c, http.StatusOK, map[string]interface{}{
		"colleges": colleges,
	}, meta)
}

// GetCollege handles GET /colleges/:id - retrieve a single college by ID.
// @Summary Get college by ID
// @Description Retrieve a single college by its UUID
// @Tags Colleges
// @Accept json
// @Produce json
// @Param id path string true "College ID (UUID)"
// @Success 200 {object} response.Response{data=models.College}
// @Failure 400 {object} response.ErrorResponse
// @Failure 401 {object} response.ErrorResponse
// @Failure 403 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Failure 500 {object} response.ErrorResponse
// @Router /colleges/{id} [get]
// @Security BearerAuth
func (h *CollegeHandler) GetCollege(c *gin.Context) {
	// Validate and parse college ID
	collegeID, err := parseCollegeIDParam(c)
	if err != nil {
		respondError(c, err)
		return
	}

	// Call service
	college, err := h.service.GetCollege(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, err)
		return
	}

	// Return response
	response.OK(c, map[string]interface{}{
		"college": college,
	})
}

// CreateCollege handles POST /colleges - create a new college.
// @Summary Create college
// @Description Create a new college in ONBOARDING status
// @Tags Colleges
// @Accept json
// @Produce json
// @Param body body models.CreateCollegeRequest true "College creation payload"
// @Success 201 {object} response.Response{data=models.College}
// @Failure 400 {object} response.ErrorResponse
// @Failure 401 {object} response.ErrorResponse
// @Failure 403 {object} response.ErrorResponse
// @Failure 409 {object} response.ErrorResponse
// @Failure 500 {object} response.ErrorResponse
// @Router /colleges [post]
// @Security BearerAuth
func (h *CollegeHandler) CreateCollege(c *gin.Context) {
	// Parse request body
	var req models.CreateCollegeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body"))
		return
	}

	// Validate request
	if err := validators.ValidateCreateCollegeRequest(&req); err != nil {
		respondError(c, err)
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	ctx = context.WithValue(ctx, services.ActorRoleContextKey, actorRole)

	// Call service
	college, err := h.service.CreateCollege(ctx, req)
	if err != nil {
		respondError(c, err)
		return
	}

	// Return created response
	resData := map[string]interface{}{
		"college": college,
	}
	if college.Admin != nil {
		resData["admin"] = college.Admin
	}
	response.Created(c, resData)
}

// UpdateCollege handles PATCH /colleges/:id - update college details.
// @Summary Update college
// @Description Update permitted fields of a college
// @Tags Colleges
// @Accept json
// @Produce json
// @Param id path string true "College ID (UUID)"
// @Param body body models.UpdateCollegeRequest true "College update payload"
// @Success 200 {object} response.Response{data=models.College}
// @Failure 400 {object} response.ErrorResponse
// @Failure 401 {object} response.ErrorResponse
// @Failure 403 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Failure 500 {object} response.ErrorResponse
// @Router /colleges/{id} [patch]
// @Security BearerAuth
func (h *CollegeHandler) UpdateCollege(c *gin.Context) {
	// Validate and parse college ID
	collegeID, err := parseCollegeIDParam(c)
	if err != nil {
		respondError(c, err)
		return
	}

	// Parse request body
	var req models.UpdateCollegeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body"))
		return
	}

	// Validate request
	if err := validators.ValidateUpdateCollegeRequest(&req); err != nil {
		respondError(c, err)
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	ctx = context.WithValue(ctx, services.ActorRoleContextKey, actorRole)

	// Call service
	college, err := h.service.UpdateCollege(ctx, collegeID, req)
	if err != nil {
		respondError(c, err)
		return
	}

	// Return response
	response.OK(c, map[string]interface{}{
		"college": college,
	})
}

// UpdateCollegeStatus handles PUT/PATCH /colleges/:id/status - update college status.
// @Summary Update college status
// @Description Update the lifecycle status of a college with reason tracking
// @Tags Colleges
// @Accept json
// @Produce json
// @Param id path string true "College ID (UUID)"
// @Param body body models.UpdateCollegeStatusRequest true "Status update payload"
// @Success 200 {object} response.Response{data=models.College}
// @Failure 400 {object} response.ErrorResponse
// @Failure 401 {object} response.ErrorResponse
// @Failure 403 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Failure 500 {object} response.ErrorResponse
// @Router /colleges/{id}/status [put]
// @Security BearerAuth
func (h *CollegeHandler) UpdateCollegeStatus(c *gin.Context) {
	// Validate and parse college ID
	collegeID, err := parseCollegeIDParam(c)
	if err != nil {
		respondError(c, err)
		return
	}

	// Parse request body
	var req models.UpdateCollegeStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body"))
		return
	}

	// Validate request
	if err := validators.ValidateUpdateCollegeStatusRequest(&req); err != nil {
		respondError(c, err)
		return
	}

	// Derive actor identity and role from trusted authenticated context
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	ctx = context.WithValue(ctx, services.ActorRoleContextKey, actorRole)

	// Call service
	college, err := h.service.UpdateCollegeStatus(ctx, collegeID, req, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	// Return response
	response.OK(c, map[string]interface{}{
		"college": college,
	})
}

// GetCollegeOnboarding handles GET /colleges/:id/onboarding - retrieve onboarding steps.
// @Summary Get college onboarding steps
// @Description Retrieve the onboarding checklist for a college
// @Tags Colleges
// @Accept json
// @Produce json
// @Param id path string true "College ID (UUID)"
// @Success 200 {object} response.Response{data=map[string]interface{}}
// @Failure 400 {object} response.ErrorResponse
// @Failure 401 {object} response.ErrorResponse
// @Failure 403 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Failure 500 {object} response.ErrorResponse
// @Router /colleges/{id}/onboarding [get]
// @Security BearerAuth
func (h *CollegeHandler) GetCollegeOnboarding(c *gin.Context) {
	collegeID, err := parseCollegeIDParam(c)
	if err != nil {
		respondError(c, err)
		return
	}

	steps, err := h.service.GetCollegeOnboarding(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"college_id": collegeID,
		"steps":      steps,
	})
}

// UpdateCollegeOnboarding handles PATCH/PUT /colleges/:id/onboarding/:step_code - update an onboarding step.
// @Summary Update college onboarding step
// @Description Update the status and notes of a college onboarding step
// @Tags Colleges
// @Accept json
// @Produce json
// @Param id path string true "College ID (UUID)"
// @Param step_code path string true "Step Code"
// @Param body body models.UpdateCollegeOnboardingRequest true "Onboarding step update payload"
// @Success 200 {object} response.Response{data=map[string]interface{}}
// @Failure 400 {object} response.ErrorResponse
// @Failure 401 {object} response.ErrorResponse
// @Failure 403 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Failure 500 {object} response.ErrorResponse
// @Router /colleges/{id}/onboarding/{step_code} [patch]
// @Security BearerAuth
func (h *CollegeHandler) UpdateCollegeOnboarding(c *gin.Context) {
	collegeID, err := parseCollegeIDParam(c)
	if err != nil {
		respondError(c, err)
		return
	}

	stepCode := c.Param("step_code")

	var req models.UpdateCollegeOnboardingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body"))
		return
	}

	if err := validators.ValidateUpdateCollegeOnboardingRequest(stepCode, &req); err != nil {
		respondError(c, err)
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	ctx = context.WithValue(ctx, services.ActorRoleContextKey, actorRole)

	step, err := h.service.UpdateCollegeOnboarding(ctx, collegeID, stepCode, req, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"step": step,
	})
}

// GetCollegeAdmin handles GET /colleges/:id/admin - get college administrator account.
func (h *CollegeHandler) GetCollegeAdmin(c *gin.Context) {
	collegeID, err := parseCollegeIDParam(c)
	if err != nil {
		respondError(c, err)
		return
	}

	admin, err := h.service.GetCollegeAdmin(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"admin": admin,
	})
}

// UpdateCollegeAdminPassword handles PUT /colleges/:id/admin/password - update or reset college administrator password.
func (h *CollegeHandler) UpdateCollegeAdminPassword(c *gin.Context) {
	collegeID, err := parseCollegeIDParam(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var req models.UpdateCollegeAdminPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body"))
		return
	}

	if err := validators.ValidateUpdateCollegeAdminPasswordRequest(&req); err != nil {
		respondError(c, err)
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	ctx = context.WithValue(ctx, services.ActorRoleContextKey, actorRole)

	admin, err := h.service.UpdateCollegeAdminPassword(ctx, collegeID, req)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"admin":   admin,
		"message": "College administrator password updated successfully",
	})
}

// GetCollegeReadiness handles GET /colleges/:id/readiness - get college onboarding readiness verification.
func (h *CollegeHandler) GetCollegeReadiness(c *gin.Context) {
	collegeID, err := parseCollegeIDParam(c)
	if err != nil {
		respondError(c, err)
		return
	}

	readiness, err := h.service.GetCollegeReadiness(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, readiness)
}

// ListOnboardingPipeline handles GET /colleges/onboarding/pipeline or GET /super-admin/onboarding.
func (h *CollegeHandler) ListOnboardingPipeline(c *gin.Context) {
	pipeline, err := h.service.ListOnboardingPipeline(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}

	search := strings.TrimSpace(c.Query("search"))
	if search != "" {
		filtered := make([]models.CollegeOnboardingSummary, 0)
		for _, s := range pipeline {
			if strings.Contains(strings.ToLower(s.Name), strings.ToLower(search)) ||
				strings.Contains(strings.ToLower(s.CollegeCode), strings.ToLower(search)) {
				filtered = append(filtered, s)
			}
		}
		pipeline = filtered
	}

	total := len(pipeline)

	// Optional pagination
	limitStr := c.Query("limit")
	offsetStr := c.Query("offset")
	if limitStr != "" || offsetStr != "" {
		limit := 50
		offset := 0
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
		if offset > len(pipeline) {
			pipeline = []models.CollegeOnboardingSummary{}
		} else {
			end := offset + limit
			if end > len(pipeline) {
				end = len(pipeline)
			}
			pipeline = pipeline[offset:end]
		}
	}

	response.OK(c, map[string]interface{}{
		"colleges": pipeline,
		"total":    total,
	})
}

// TestCollegeNotification handles POST /super-admin/colleges/:id/test-notification.
func (h *CollegeHandler) TestCollegeNotification(c *gin.Context) {
	collegeIDStr := c.Param("id")
	collegeID, err := validators.ValidateCollegeID(collegeIDStr)
	if err != nil {
		respondError(c, err)
		return
	}

	result, err := h.service.TestCollegeNotification(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, result)
}

// ListCollegeAdmins handles GET /super-admin/colleges/:id/admins - list all admins for a college.
func (h *CollegeHandler) ListCollegeAdmins(c *gin.Context) {
	collegeID, err := parseCollegeIDParam(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var params models.ListCollegeAdminsParams
	if err := c.ShouldBindQuery(&params); err != nil {
		respondError(c, validators.NewValidationError("Invalid query parameters"))
		return
	}

	res, err := h.service.ListCollegeAdmins(c.Request.Context(), collegeID, params)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, res)
}

// ProvisionFirstCollegeAdmin handles POST /super-admin/colleges/:id/admins/first - provisions the first admin.
func (h *CollegeHandler) ProvisionFirstCollegeAdmin(c *gin.Context) {
	collegeID, err := parseCollegeIDParam(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var req models.ProvisionFirstCollegeAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body: email and password (min 8 chars) are required"))
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	ctx = context.WithValue(ctx, services.ActorRoleContextKey, actorRole)

	admin, err := h.service.ProvisionFirstCollegeAdmin(ctx, collegeID, req)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"admin": admin,
	})
}

// UpdateCollegeAdminProfile handles PATCH /super-admin/colleges/:id/admins/:admin_id - update permitted profile fields.
func (h *CollegeHandler) UpdateCollegeAdminProfile(c *gin.Context) {
	collegeID, err := parseCollegeIDParam(c)
	if err != nil {
		respondError(c, err)
		return
	}

	adminIDStr := c.Param("admin_id")
	adminID, err := uuid.Parse(adminIDStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid administrator ID"))
		return
	}

	var req models.UpdateCollegeAdminProfileRequest
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

	admin, err := h.service.UpdateCollegeAdminProfile(ctx, collegeID, adminID, req)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"admin": admin,
	})
}

// UpdateCollegeAdminStatus handles PUT /super-admin/colleges/:id/admins/:admin_id/status - activate or deactivate administrator.
func (h *CollegeHandler) UpdateCollegeAdminStatus(c *gin.Context) {
	collegeID, err := parseCollegeIDParam(c)
	if err != nil {
		respondError(c, err)
		return
	}

	adminIDStr := c.Param("admin_id")
	adminID, err := uuid.Parse(adminIDStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid administrator ID"))
		return
	}

	var req models.UpdateCollegeAdminStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid status or reason"))
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	ctx = context.WithValue(ctx, services.ActorRoleContextKey, actorRole)

	admin, err := h.service.UpdateCollegeAdminStatus(ctx, collegeID, adminID, req)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"admin": admin,
	})
}

// UnlockCollegeAdminAccount handles POST /super-admin/colleges/:id/admins/:admin_id/unlock - unlock a locked admin.
func (h *CollegeHandler) UnlockCollegeAdminAccount(c *gin.Context) {
	collegeID, err := parseCollegeIDParam(c)
	if err != nil {
		respondError(c, err)
		return
	}

	adminIDStr := c.Param("admin_id")
	adminID, err := uuid.Parse(adminIDStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid administrator ID"))
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	ctx = context.WithValue(ctx, services.ActorRoleContextKey, actorRole)

	admin, err := h.service.UnlockCollegeAdminAccount(ctx, collegeID, adminID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"admin": admin,
	})
}

// RevokeCollegeAdminSessions handles POST /super-admin/colleges/:id/admins/:admin_id/revoke-sessions.
func (h *CollegeHandler) RevokeCollegeAdminSessions(c *gin.Context) {
	collegeID, err := parseCollegeIDParam(c)
	if err != nil {
		respondError(c, err)
		return
	}

	adminIDStr := c.Param("admin_id")
	adminID, err := uuid.Parse(adminIDStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid administrator ID"))
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	ctx = context.WithValue(ctx, services.ActorRoleContextKey, actorRole)

	res, err := h.service.RevokeCollegeAdminSessions(ctx, collegeID, adminID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, res)
}

// GetCollegeAdminLoginHistory handles GET /super-admin/colleges/:id/admins/:admin_id/login-history.
func (h *CollegeHandler) GetCollegeAdminLoginHistory(c *gin.Context) {
	collegeID, err := parseCollegeIDParam(c)
	if err != nil {
		respondError(c, err)
		return
	}

	adminIDStr := c.Param("admin_id")
	adminID, err := uuid.Parse(adminIDStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid administrator ID"))
		return
	}

	limit := 20
	if l := c.Query("limit"); l != "" {
		if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	events, err := h.service.GetCollegeAdminLoginHistory(c.Request.Context(), collegeID, adminID, limit)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"college_id": collegeID,
		"admin_id":   adminID,
		"events":     events,
		"total":      len(events),
	})
}

