package handlers

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
)

// AuditHandler handles HTTP requests for platform audit records and activity logs.
type AuditHandler struct {
	service *services.AuditService
}

// NewAuditHandler creates a new AuditHandler.
func NewAuditHandler(service *services.AuditService) *AuditHandler {
	return &AuditHandler{
		service: service,
	}
}

// ListAuditLogs handles GET /super-admin/audit-logs - search and filter audit events.
func (h *AuditHandler) ListAuditLogs(c *gin.Context) {
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	params := models.AuditLogFilterParams{
		Query:           c.Query("query"),
		ActorRole:       c.Query("actor_role"),
		Module:          c.Query("module"),
		Action:          c.Query("action"),
		EntityType:      c.Query("entity_type"),
		Severity:        c.Query("severity"),
		ResultStatus:    c.Query("result_status"),
		TicketReference: c.Query("ticket_reference"),
		Limit:           limit,
		Offset:          offset,
	}

	if cidStr := c.Query("college_id"); cidStr != "" {
		if cid, err := uuid.Parse(cidStr); err == nil {
			params.CollegeID = &cid
		}
	}

	if aidStr := c.Query("actor_user_id"); aidStr != "" {
		if aid, err := uuid.Parse(aidStr); err == nil {
			params.ActorUserID = &aid
		}
	}

	if corrStr := c.Query("correlation_id"); corrStr != "" {
		if corr, err := uuid.Parse(corrStr); err == nil {
			params.CorrelationID = &corr
		}
	}

	if startStr := c.Query("start_date"); startStr != "" {
		if t, err := time.Parse(time.RFC3339, startStr); err == nil {
			params.StartDate = &t
		}
	}

	if endStr := c.Query("end_date"); endStr != "" {
		if t, err := time.Parse(time.RFC3339, endStr); err == nil {
			params.EndDate = &t
		}
	}

	records, total, err := h.service.ListAuditLogs(c.Request.Context(), params, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"records": records,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	})
}

// GetAuditLog handles GET /super-admin/audit-logs/:id - retrieve event details.
func (h *AuditHandler) GetAuditLog(c *gin.Context) {
	idStr := c.Param("id")
	auditID, err := uuid.Parse(idStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid audit ID format"))
		return
	}

	log, err := h.service.GetAuditLogByID(c.Request.Context(), auditID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"record": log,
	})
}

// VerifyIntegrity handles POST /super-admin/audit-logs/verify-integrity.
func (h *AuditHandler) VerifyIntegrity(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	report, err := h.service.VerifyAuditIntegrity(c.Request.Context(), limit)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"integrity_report": report,
	})
}

// RequestExport handles POST /super-admin/audit-logs/exports - create bulk export request.
func (h *AuditHandler) RequestExport(c *gin.Context) {
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var req models.CreateAuditExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "Invalid export request body. Filters and reason are required"))
		return
	}

	exportReq, err := h.service.RequestAuditExport(c.Request.Context(), req, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"message":        "Audit export request submitted for peer approval",
		"export_request": exportReq,
	})
}

// ListExportRequests handles GET /super-admin/audit-logs/exports - list export requests.
func (h *AuditHandler) ListExportRequests(c *gin.Context) {
	status := c.Query("status")
	list, err := h.service.ListExportRequests(c.Request.Context(), status)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"export_requests": list,
		"total":           len(list),
	})
}

// ProcessExportDecision handles POST /super-admin/audit-logs/exports/:id/decision.
func (h *AuditHandler) ProcessExportDecision(c *gin.Context) {
	idStr := c.Param("id")
	requestID, err := uuid.Parse(idStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid export request ID format"))
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var req models.ProcessAuditExportDecision
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "Invalid decision payload. Decision and reason are required"))
		return
	}

	err = h.service.ProcessExportDecision(c.Request.Context(), requestID, req, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"message":  "Audit export request decision processed successfully",
		"decision": req.Decision,
	})
}
