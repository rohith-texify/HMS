package handlers

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/pkg/response"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
)

// AccessControlHandler handles HTTP requests for tenant feature access matrices,
// granular action mode restrictions, and "Why is this denied?" diagnostic tracing.
type AccessControlHandler struct {
	service *services.AccessControlService
}

// NewAccessControlHandler creates a new AccessControlHandler instance.
func NewAccessControlHandler(service *services.AccessControlService) *AccessControlHandler {
	return &AccessControlHandler{
		service: service,
	}
}

// GetTenantAccessHierarchy handles GET /super-admin/colleges/:id/access-control/matrix.
func (h *AccessControlHandler) GetTenantAccessHierarchy(c *gin.Context) {
	collegeIDStr := c.Param("id")
	collegeID, err := uuid.Parse(collegeIDStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid college ID format"))
		return
	}

	res, err := h.service.GetTenantAccessHierarchy(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, res)
}

// UpdateCollegeFeature handles PUT /super-admin/colleges/:id/access-control/features/:module_id.
func (h *AccessControlHandler) UpdateCollegeFeature(c *gin.Context) {
	collegeIDStr := c.Param("id")
	collegeID, err := uuid.Parse(collegeIDStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid college ID format"))
		return
	}

	moduleIDStr := c.Param("module_id")
	moduleID, err := uuid.Parse(moduleIDStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid module ID format"))
		return
	}

	var req models.UpdateFeatureAccessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body: status (ACTIVE/DISABLED/SCHEDULED), mode (FULL/READ_ONLY), and reason are required"))
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		actorRole = "SUPER_ADMIN"
	}

	err = h.service.UpdateFeatureAccess(c.Request.Context(), collegeID, moduleID, req, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"success": true,
		"message": "Feature access entitlement updated successfully",
	})
}

// EvaluateWhyDenied handles POST /super-admin/colleges/:id/access-control/evaluate.
func (h *AccessControlHandler) EvaluateWhyDenied(c *gin.Context) {
	collegeIDStr := c.Param("id")
	collegeID, err := uuid.Parse(collegeIDStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid college ID format"))
		return
	}

	var req models.EvaluateAccessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body: module_or_feature_code is required"))
		return
	}
	req.CollegeID = collegeID

	report, err := h.service.EvaluateWhyDenied(c.Request.Context(), req)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, report)
}

// GlobalEvaluateAccess handles POST /super-admin/access-control/evaluate.
func (h *AccessControlHandler) GlobalEvaluateAccess(c *gin.Context) {
	var req models.EvaluateAccessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body: college_id and module_or_feature_code are required"))
		return
	}

	if req.CollegeID == uuid.Nil {
		respondError(c, validators.NewValidationError("Valid college_id is required"))
		return
	}
	if strings.TrimSpace(req.ModuleOrFeatureCode) == "" {
		respondError(c, validators.NewValidationError("module_or_feature_code is required"))
		return
	}

	report, err := h.service.EvaluateWhyDenied(c.Request.Context(), req)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, report)
}
