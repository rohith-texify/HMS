package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
)

// ModuleHandler handles HTTP requests for module catalogue and college module management.
type ModuleHandler struct {
	service *services.ModuleService
}

// NewModuleHandler creates a new module handler.
func NewModuleHandler(service *services.ModuleService) *ModuleHandler {
	return &ModuleHandler{
		service: service,
	}
}

// ListModules handles GET /super-admin/modules - list platform module catalogue.
func (h *ModuleHandler) ListModules(c *gin.Context) {
	var params models.ListModulesParams
	if err := c.ShouldBindQuery(&params); err != nil {
		respondError(c, validators.NewValidationError("Invalid query parameters"))
		return
	}

	modules, meta, err := h.service.ListModules(c.Request.Context(), params)
	if err != nil {
		respondError(c, err)
		return
	}

	response.WithMeta(c, http.StatusOK, map[string]interface{}{
		"modules": modules,
	}, meta)
}

// GetModule handles GET /super-admin/modules/:id - retrieve a single module.
func (h *ModuleHandler) GetModule(c *gin.Context) {
	moduleID, err := validators.ValidateModuleID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	module, err := h.service.GetModule(c.Request.Context(), moduleID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"module": module,
	})
}

// CreateModule handles POST /super-admin/modules - create a new platform module.
func (h *ModuleHandler) CreateModule(c *gin.Context) {
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var req models.CreateModuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body"))
		return
	}

	if err := validators.ValidateCreateModuleRequest(&req); err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	module, err := h.service.CreateModule(ctx, req, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.Created(c, map[string]interface{}{
		"module": module,
	})
}

// UpdateModule handles PUT and PATCH /super-admin/modules/:id - update module details.
func (h *ModuleHandler) UpdateModule(c *gin.Context) {
	moduleID, err := validators.ValidateModuleID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var req models.UpdateModuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body"))
		return
	}

	if err := validators.ValidateUpdateModuleRequest(&req); err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	module, err := h.service.UpdateModule(ctx, moduleID, req, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"module": module,
	})
}

// ToggleModuleStatus handles PATCH /super-admin/modules/:id/status - toggle active status.
func (h *ModuleHandler) ToggleModuleStatus(c *gin.Context) {
	moduleID, err := validators.ValidateModuleID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var req models.ToggleModuleStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body"))
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	module, err := h.service.ToggleModuleStatus(ctx, moduleID, req, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"module": module,
	})
}

// DeleteModule handles DELETE /super-admin/modules/:id - delete a platform module.
func (h *ModuleHandler) DeleteModule(c *gin.Context) {
	moduleID, err := validators.ValidateModuleID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	if err := h.service.DeleteModule(ctx, moduleID, actorID, actorRole); err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"message": "Module deleted successfully",
	})
}

// ListCollegeModules handles GET /super-admin/colleges/:id/modules - list college modules.
func (h *ModuleHandler) ListCollegeModules(c *gin.Context) {
	collegeIDStr := c.Param("id")
	if collegeIDStr == "" {
		collegeIDStr = c.Param("college_id")
	}

	collegeID, err := validators.ValidateCollegeID(collegeIDStr)
	if err != nil {
		respondError(c, err)
		return
	}

	var status *string
	if statusParam := c.Query("status"); statusParam != "" {
		status = &statusParam
	}

	limit := 20
	if limitParam := c.Query("limit"); limitParam != "" {
		var parsedLimit int
		if _, err := fmt.Sscanf(limitParam, "%d", &parsedLimit); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	offset := 0
	if offsetParam := c.Query("offset"); offsetParam != "" {
		var parsedOffset int
		if _, err := fmt.Sscanf(offsetParam, "%d", &parsedOffset); err == nil && parsedOffset >= 0 {
			offset = parsedOffset
		}
	}

	collegeModules, meta, err := h.service.ListCollegeModules(c.Request.Context(), collegeID, status, limit, offset)
	if err != nil {
		respondError(c, err)
		return
	}

	response.WithMeta(c, http.StatusOK, map[string]interface{}{
		"college_modules": collegeModules,
	}, meta)
}

// AssignCollegeModule handles POST /super-admin/colleges/:id/modules - assign a module to a college.
func (h *ModuleHandler) AssignCollegeModule(c *gin.Context) {
	collegeIDStr := c.Param("id")
	if collegeIDStr == "" {
		collegeIDStr = c.Param("college_id")
	}

	collegeID, err := validators.ValidateCollegeID(collegeIDStr)
	if err != nil {
		respondError(c, err)
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var req models.AssignCollegeModuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body"))
		return
	}

	if err := validators.ValidateAssignCollegeModuleRequest(&req); err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	assigned, err := h.service.AssignCollegeModule(ctx, collegeID, req, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.Created(c, map[string]interface{}{
		"college_module": assigned,
	})
}

// UpdateCollegeModule handles PATCH/PUT for college module availability.
// Supports both:
//   - PUT/PATCH /super-admin/colleges/:id/modules/:module_id
//   - PATCH /super-admin/colleges/modules/:module_id (legacy college_module_id)
func (h *ModuleHandler) UpdateCollegeModule(c *gin.Context) {
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var req models.UpdateCollegeModuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body"))
		return
	}

	if err := validators.ValidateUpdateCollegeModuleRequest(&req); err != nil {
		respondError(c, err)
		return
	}

	collegeIDStr := c.Param("id")
	if collegeIDStr == "" {
		collegeIDStr = c.Param("college_id")
	}

	moduleIDStr := c.Param("module_id")

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)

	// If college_id is present in the path, this is /colleges/:id/modules/:module_id
	if collegeIDStr != "" {
		collegeID, err := validators.ValidateCollegeID(collegeIDStr)
		if err != nil {
			respondError(c, err)
			return
		}

		moduleID, err := validators.ValidateModuleID(moduleIDStr)
		if err != nil {
			respondError(c, err)
			return
		}

		result, err := h.service.UpdateCollegeModuleByCollegeAndModule(ctx, collegeID, moduleID, req, actorID, actorRole)
		if err != nil {
			respondError(c, err)
			return
		}

		response.OK(c, map[string]interface{}{
			"college_module": result,
		})
		return
	}

	// Legacy route: /colleges/modules/:module_id where module_id is actually college_module_id
	collegeModuleID, err := uuid.Parse(moduleIDStr)
	if err != nil || collegeModuleID == uuid.Nil {
		respondError(c, validators.NewValidationError("Invalid college module ID"))
		return
	}

	collegeModule, err := h.service.UpdateCollegeModule(ctx, collegeModuleID, req, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"college_module": collegeModule,
	})
}

// GetCollegeEntitlements handles GET /super-admin/colleges/:id/entitlements.
func (h *ModuleHandler) GetCollegeEntitlements(c *gin.Context) {
	collegeIDStr := c.Param("id")
	if collegeIDStr == "" {
		collegeIDStr = c.Param("college_id")
	}

	collegeID, err := validators.ValidateCollegeID(collegeIDStr)
	if err != nil {
		respondError(c, err)
		return
	}

	entitlements, err := h.service.GetCollegeEntitlements(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"college_id":   collegeID,
		"entitlements": entitlements,
	})
}

// UpdateCollegeEntitlement handles PUT /super-admin/colleges/:id/entitlements.
func (h *ModuleHandler) UpdateCollegeEntitlement(c *gin.Context) {
	collegeIDStr := c.Param("id")
	if collegeIDStr == "" {
		collegeIDStr = c.Param("college_id")
	}

	collegeID, err := validators.ValidateCollegeID(collegeIDStr)
	if err != nil {
		respondError(c, err)
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var req models.AssignCollegeModuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body"))
		return
	}

	if err := validators.ValidateAssignCollegeModuleRequest(&req); err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	entitlement, err := h.service.UpdateCollegeEntitlement(ctx, collegeID, req, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"entitlement": entitlement,
	})
}

// GetCollegeEntitlementMatrix handles GET /super-admin/colleges/:id/entitlements/matrix.
func (h *ModuleHandler) GetCollegeEntitlementMatrix(c *gin.Context) {
	collegeIDStr := c.Param("id")
	if collegeIDStr == "" {
		collegeIDStr = c.Param("college_id")
	}

	collegeID, err := validators.ValidateCollegeID(collegeIDStr)
	if err != nil {
		respondError(c, err)
		return
	}

	matrix, err := h.service.GetCollegeEntitlementMatrix(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"college_id": collegeID,
		"matrix":     matrix,
	})
}

// PreviewModuleImpact handles POST /super-admin/colleges/:id/modules/:module_id/preview.
func (h *ModuleHandler) PreviewModuleImpact(c *gin.Context) {
	collegeIDStr := c.Param("id")
	if collegeIDStr == "" {
		collegeIDStr = c.Param("college_id")
	}

	collegeID, err := validators.ValidateCollegeID(collegeIDStr)
	if err != nil {
		respondError(c, err)
		return
	}

	moduleID, err := validators.ValidateModuleID(c.Param("module_id"))
	if err != nil {
		respondError(c, err)
		return
	}

	var req struct {
		TargetStatus string `json:"status"`
		TargetMode   string `json:"mode"`
	}
	_ = c.ShouldBindJSON(&req)

	preview, err := h.service.PreviewModuleImpact(c.Request.Context(), collegeID, moduleID, req.TargetStatus, req.TargetMode)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"preview": preview,
	})
}

// RequestModuleEntitlementChange handles POST /super-admin/colleges/:id/modules/:module_id/change.
func (h *ModuleHandler) RequestModuleEntitlementChange(c *gin.Context) {
	collegeIDStr := c.Param("id")
	if collegeIDStr == "" {
		collegeIDStr = c.Param("college_id")
	}

	collegeID, err := validators.ValidateCollegeID(collegeIDStr)
	if err != nil {
		respondError(c, err)
		return
	}

	moduleID, err := validators.ValidateModuleID(c.Param("module_id"))
	if err != nil {
		respondError(c, err)
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var req struct {
		models.UpdateCollegeModuleRequest
		RequestApproval bool `json:"request_approval"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body"))
		return
	}

	if err := validators.ValidateUpdateCollegeModuleRequest(&req.UpdateCollegeModuleRequest); err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	updated, approval, err := h.service.RequestModuleEntitlementChange(ctx, collegeID, moduleID, req.UpdateCollegeModuleRequest, actorID, actorRole, req.RequestApproval)
	if err != nil {
		respondError(c, err)
		return
	}

	if approval != nil {
		response.Created(c, map[string]interface{}{
			"message":          "Module change submitted for maker-checker approval",
			"requires_approval": true,
			"approval_request": approval,
		})
		return
	}

	response.OK(c, map[string]interface{}{
		"message":          "Module entitlement updated successfully",
		"requires_approval": false,
		"college_module":   updated,
	})
}

// ListModuleHistory handles GET /super-admin/modules/history and GET /super-admin/colleges/:id/modules/history.
func (h *ModuleHandler) ListModuleHistory(c *gin.Context) {
	var collegeID *uuid.UUID
	collegeIDStr := c.Param("id")
	if collegeIDStr == "" {
		collegeIDStr = c.Query("college_id")
	}
	if collegeIDStr != "" {
		cid, err := validators.ValidateCollegeID(collegeIDStr)
		if err == nil {
			collegeID = &cid
		}
	}

	var moduleID *uuid.UUID
	if modIDStr := c.Query("module_id"); modIDStr != "" {
		mid, err := validators.ValidateModuleID(modIDStr)
		if err == nil {
			moduleID = &mid
		}
	}

	limit := 20
	if limitParam := c.Query("limit"); limitParam != "" {
		var parsedLimit int
		if _, err := fmt.Sscanf(limitParam, "%d", &parsedLimit); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	offset := 0
	if offsetParam := c.Query("offset"); offsetParam != "" {
		var parsedOffset int
		if _, err := fmt.Sscanf(offsetParam, "%d", &parsedOffset); err == nil && parsedOffset >= 0 {
			offset = parsedOffset
		}
	}

	history, meta, err := h.service.ListModuleHistory(c.Request.Context(), collegeID, moduleID, limit, offset)
	if err != nil {
		respondError(c, err)
		return
	}

	response.WithMeta(c, http.StatusOK, map[string]interface{}{
		"history": history,
	}, meta)
}

