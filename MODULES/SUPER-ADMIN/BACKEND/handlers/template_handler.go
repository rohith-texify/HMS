package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/database"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
)

// TemplateHandler handles HTTP requests for entitlement templates.
type TemplateHandler struct {
	service *services.TemplateService
}

// NewTemplateHandler creates a new entitlement template handler.
func NewTemplateHandler(service *services.TemplateService) *TemplateHandler {
	return &TemplateHandler{
		service: service,
	}
}

// ListTemplates handles GET /super-admin/entitlement-templates
func (h *TemplateHandler) ListTemplates(c *gin.Context) {
	var params models.ListTemplatesParams
	if err := c.ShouldBindQuery(&params); err != nil {
		respondError(c, validators.NewValidationError("Invalid query parameters"))
		return
	}

	templates, meta, err := h.service.ListTemplates(c.Request.Context(), params)
	if err != nil {
		respondError(c, err)
		return
	}

	response.WithMeta(c, http.StatusOK, map[string]interface{}{
		"templates": templates,
	}, meta)
}

// GetTemplate handles GET /super-admin/entitlement-templates/:id
func (h *TemplateHandler) GetTemplate(c *gin.Context) {
	templateID, err := validators.ValidateTemplateID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	tmpl, err := h.service.GetTemplate(c.Request.Context(), templateID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"template": tmpl,
	})
}

// CreateTemplate handles POST /super-admin/entitlement-templates
func (h *TemplateHandler) CreateTemplate(c *gin.Context) {
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var req models.CreateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body"))
		return
	}

	if err := validators.ValidateCreateTemplateRequest(&req); err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	tmpl, err := h.service.CreateTemplate(ctx, req, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.Created(c, map[string]interface{}{
		"template": tmpl,
	})
}

// UpdateTemplate handles PUT and PATCH /super-admin/entitlement-templates/:id
func (h *TemplateHandler) UpdateTemplate(c *gin.Context) {
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	templateID, err := validators.ValidateTemplateID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	var req models.UpdateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body"))
		return
	}

	if err := validators.ValidateUpdateTemplateRequest(&req); err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	tmpl, err := h.service.UpdateTemplate(ctx, templateID, req, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"template": tmpl,
	})
}

// DeleteTemplate handles DELETE /super-admin/entitlement-templates/:id
func (h *TemplateHandler) DeleteTemplate(c *gin.Context) {
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	templateID, err := validators.ValidateTemplateID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	if err := h.service.DeleteTemplate(ctx, templateID, actorID, actorRole); err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"message": "Entitlement template deleted successfully",
	})
}

// ApplyTemplateToCollege handles applying an entitlement template to a college.
// Supported routes:
// - POST /super-admin/entitlement-templates/:id/apply/:college_id
// - POST /super-admin/colleges/:id/apply-template
func (h *TemplateHandler) ApplyTemplateToCollege(c *gin.Context) {
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var collegeID, templateID uuid.UUID

	// Check if college_id is in URL param
	collegeIDParam := c.Param("college_id")
	if collegeIDParam != "" {
		// Route: /super-admin/entitlement-templates/:id/apply/:college_id
		var err error
		templateID, err = validators.ValidateTemplateID(c.Param("id"))
		if err != nil {
			respondError(c, err)
			return
		}

		collegeID, err = validators.ValidateCollegeID(collegeIDParam)
		if err != nil {
			respondError(c, err)
			return
		}
	} else {
		// Route: /super-admin/colleges/:id/apply-template
		var err error
		collegeID, err = validators.ValidateCollegeID(c.Param("id"))
		if err != nil {
			respondError(c, err)
			return
		}

		var req models.ApplyTemplateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			respondError(c, validators.NewValidationError("Invalid request body"))
			return
		}

		templateID = req.TemplateID
		if templateID == uuid.Nil {
			respondError(c, apierrors.New(apierrors.ValidationError, "Template ID is required"))
			return
		}

		if req.CollegeID != uuid.Nil && req.CollegeID != collegeID {
			respondError(c, apierrors.New(apierrors.ValidationError, "College ID in URL does not match body"))
			return
		}
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	if err := h.service.ApplyTemplateToCollege(ctx, collegeID, templateID, actorID, actorRole); err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"message": "Entitlement template applied successfully",
	})
}
