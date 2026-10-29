package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
)

// ChangeManagementHandler handles HTTP requests for Configuration Change Management (Module 15).
type ChangeManagementHandler struct {
	service *services.ChangeManagementService
}

// NewChangeManagementHandler creates a new ChangeManagementHandler.
func NewChangeManagementHandler(service *services.ChangeManagementService) *ChangeManagementHandler {
	return &ChangeManagementHandler{
		service: service,
	}
}

// ListChangeSets handles GET /super-admin/change-sets - list configuration proposals and snapshots.
func (h *ChangeManagementHandler) ListChangeSets(c *gin.Context) {
	var params models.ChangeSetFilterParams
	if err := c.ShouldBindQuery(&params); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "Invalid query parameters"))
		return
	}

	changeSets, total, err := h.service.ListChangeSets(c.Request.Context(), params)
	if err != nil {
		respondError(c, err)
		return
	}

	limit := 50
	if params.Limit > 0 {
		limit = params.Limit
	}
	offset := params.Offset

	meta := models.NewPaginationMeta(limit, offset, total)
	response.WithMeta(c, http.StatusOK, map[string]interface{}{
		"change_sets": changeSets,
	}, meta)
}

// GetChangeSet handles GET /super-admin/change-sets/:id - detail and before/after diff.
func (h *ChangeManagementHandler) GetChangeSet(c *gin.Context) {
	id, err := validators.ValidateRequestID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	cs, diffs, err := h.service.GetChangeSet(c.Request.Context(), id)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"change_set": cs,
		"diffs":      diffs,
	})
}

// ProposeChangeSet handles POST /super-admin/change-sets - submit a new configuration change proposal.
func (h *ChangeManagementHandler) ProposeChangeSet(c *gin.Context) {
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var req models.CreateChangeSetProposalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "Invalid request body"))
		return
	}

	cs, err := h.service.ProposeChangeSet(c.Request.Context(), req, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.Created(c, map[string]interface{}{
		"message":    "Configuration change proposal created successfully and routed to approval",
		"change_set": cs,
	})
}

// WithdrawChangeSet handles POST /super-admin/change-sets/:id/withdraw - withdraw/cancel a pending proposal.
func (h *ChangeManagementHandler) WithdrawChangeSet(c *gin.Context) {
	id, err := validators.ValidateRequestID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var body struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "Reason is required to withdraw a change set"))
		return
	}

	cs, err := h.service.WithdrawChangeSet(c.Request.Context(), id, actorID, actorRole, body.Reason)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"message":    "Change proposal withdrawn successfully",
		"change_set": cs,
	})
}

// ProposeRollback handles POST /super-admin/change-sets/rollback - propose rollback to a historical audit version.
func (h *ChangeManagementHandler) ProposeRollback(c *gin.Context) {
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var req models.RollbackChangeProposalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "Audit ID and reason are required for rollback"))
		return
	}

	collegeIDStr := c.Query("college_id")
	collegeID, err := validators.ValidateRequestID(collegeIDStr)
	if err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "Valid college_id query parameter is required"))
		return
	}

	cs, err := h.service.ProposeRollback(c.Request.Context(), collegeID, req.AuditID, actorID, actorRole, req.Reason)
	if err != nil {
		respondError(c, err)
		return
	}

	response.Created(c, map[string]interface{}{
		"message":    "Rollback proposal submitted and routed to approval",
		"change_set": cs,
	})
}
