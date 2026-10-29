package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
)

// ApprovalHandler handles HTTP requests for approval workflows.
type ApprovalHandler struct {
	service *services.ApprovalService
}

// NewApprovalHandler creates a new approval handler.
func NewApprovalHandler(service *services.ApprovalService) *ApprovalHandler {
	return &ApprovalHandler{
		service: service,
	}
}

// CreateApprovalRequest handles POST /super-admin/approvals - create a new approval request.
func (h *ApprovalHandler) CreateApprovalRequest(c *gin.Context) {
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var req models.CreateApprovalRequestInput
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body"))
		return
	}

	if err := validators.ValidateCreateApprovalRequest(&req); err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	if req.Reason != nil && *req.Reason != "" {
		ctx = database.WithPlatformReason(ctx, *req.Reason)
	}

	result, err := h.service.CreateApprovalRequest(ctx, req, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.Created(c, map[string]interface{}{
		"approval_request": result,
	})
}

// ListApprovalRequests handles GET /super-admin/approvals - list approval requests with optional filtering and pagination.
func (h *ApprovalHandler) ListApprovalRequests(c *gin.Context) {
	var params models.ListApprovalRequestsParams
	if err := c.ShouldBindQuery(&params); err != nil {
		respondError(c, validators.NewValidationError("Invalid query parameters"))
		return
	}

	if err := validators.ValidateListApprovalRequestsParams(&params); err != nil {
		respondError(c, err)
		return
	}

	actorID, _, _ := getAuthenticatedActor(c)

	requests, meta, err := h.service.ListApprovalRequests(c.Request.Context(), params, actorID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.WithMeta(c, http.StatusOK, map[string]interface{}{
		"approval_requests": requests,
	}, meta)
}

// CancelApprovalRequest handles POST /super-admin/approvals/:id/cancel - withdraw/cancel a pending request.
func (h *ApprovalHandler) CancelApprovalRequest(c *gin.Context) {
	requestID, err := validators.ValidateRequestID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var body models.CancelApprovalRequestInput
	if err := c.ShouldBindJSON(&body); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body. Reason is required"))
		return
	}

	result, err := h.service.CancelApprovalRequest(c.Request.Context(), requestID, actorID, actorRole, body.Reason)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"message":          "Approval request cancelled successfully",
		"approval_request": result,
	})
}

// GetApprovalRequest handles GET /super-admin/approvals/:id - retrieve a single approval request with steps.
func (h *ApprovalHandler) GetApprovalRequest(c *gin.Context) {
	requestID, err := validators.ValidateRequestID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	request, err := h.service.GetApprovalRequest(c.Request.Context(), requestID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"approval_request": request,
	})
}

// ProcessApprovalDecision handles POST /super-admin/approvals/steps/:step_id/decision - process approval or rejection.
func (h *ApprovalHandler) ProcessApprovalDecision(c *gin.Context) {
	stepID, err := validators.ValidateStepID(c.Param("step_id"))
	if err != nil {
		respondError(c, err)
		return
	}

	var req models.ApprovalDecisionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body"))
		return
	}

	if err := validators.ValidateApprovalDecisionRequest(&req); err != nil {
		respondError(c, err)
		return
	}

	approverID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), approverID)
	if req.Reason != nil && *req.Reason != "" {
		ctx = database.WithPlatformReason(ctx, *req.Reason)
	}

	result, err := h.service.ProcessApprovalDecision(ctx, stepID, approverID, actorRole, req)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"approval_request": result,
	})
}

// ExecuteApprovalRequest handles POST /super-admin/approvals/:id/execute - explicitly execute an approved request.
func (h *ApprovalHandler) ExecuteApprovalRequest(c *gin.Context) {
	requestID, err := validators.ValidateRequestID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	executorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), executorID)
	result, err := h.service.ExecuteApprovalRequest(ctx, requestID, executorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"approval_request": result,
	})
}
