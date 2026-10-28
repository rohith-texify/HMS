package services

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/database"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
)

// AuditService handles business logic for searching, filtering, tamper checking, and exporting platform audit logs.
type AuditService struct {
	db   *database.Database
	repo *repository.Repository
}

// NewAuditService creates a new AuditService.
func NewAuditService(db *database.Database, repo *repository.Repository) *AuditService {
	return &AuditService{
		db:   db,
		repo: repo,
	}
}

// ListAuditLogs retrieves paginated audit logs with search, actor, college, and date filtering.
func (s *AuditService) ListAuditLogs(
	ctx context.Context,
	params models.AuditLogFilterParams,
	actorUserID uuid.UUID,
	actorRole string,
) ([]models.PlatformAuditLog, int, error) {
	if s == nil || s.repo == nil {
		return nil, 0, apierrors.New(apierrors.InternalError, "Audit service is not configured")
	}

	records, total, err := s.repo.ListAuditLogs(ctx, params)
	if err != nil {
		return nil, 0, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to list audit logs: %v", err))
	}

	// Log the access to audit viewer itself (Compliance requirement)
	go func() {
		bgCtx := context.Background()
		_, _ = s.repo.RecordPlatformAudit(bgCtx, models.PlatformAuditLog{
			ActorUserID:  &actorUserID,
			ActorRole:    actorRole,
			Module:       "platform_audit",
			Action:       "VIEW_AUDIT_LOGS",
			EntityType:   "AUDIT_QUERY",
			Reason:       stringPtr("Inspected platform audit records"),
			Severity:     "INFO",
			ResultStatus: "SUCCESS",
		})
	}()

	return records, total, nil
}

// GetAuditLogByID retrieves a single audit event with full diff details.
func (s *AuditService) GetAuditLogByID(
	ctx context.Context,
	auditID uuid.UUID,
) (*models.PlatformAuditLog, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Audit service is not configured")
	}

	if auditID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "Audit ID is required")
	}

	log, err := s.repo.GetAuditLogByID(ctx, auditID)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to get audit log: %v", err))
	}
	if log == nil {
		return nil, apierrors.New(apierrors.NotFound, fmt.Sprintf("Audit log '%s' not found", auditID))
	}

	return log, nil
}

// VerifyAuditIntegrity verifies the tamper-evident cryptographic hash chain.
func (s *AuditService) VerifyAuditIntegrity(
	ctx context.Context,
	limit int,
) (*models.AuditIntegrityCheckReport, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Audit service is not configured")
	}

	return s.repo.VerifyAuditChainIntegrity(ctx, limit)
}

// RequestAuditExport submits a request for bulk audit export requiring approval.
func (s *AuditService) RequestAuditExport(
	ctx context.Context,
	req models.CreateAuditExportRequest,
	requesterID uuid.UUID,
	requesterRole string,
) (*models.AuditExportRequest, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Audit service is not configured")
	}

	if strings.TrimSpace(req.Reason) == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Business justification is mandatory for audit data export")
	}

	// 1. Estimate count matching filters
	var params models.AuditLogFilterParams
	_, count, err := s.repo.ListAuditLogs(ctx, params)
	if err != nil {
		count = 0
	}

	exportReq, err := s.repo.CreateAuditExportRequest(ctx, req, requesterID, requesterRole, count)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to create export request: %v", err))
	}

	// 2. Audit log the export request
	_, _ = s.repo.RecordPlatformAudit(ctx, models.PlatformAuditLog{
		ActorUserID:  &requesterID,
		ActorRole:    requesterRole,
		Module:       "platform_audit",
		Action:       "REQUEST_AUDIT_EXPORT",
		EntityType:   "AUDIT_EXPORT_REQUEST",
		EntityID:     &exportReq.RequestID,
		Reason:       &req.Reason,
		Severity:     "WARNING",
		ResultStatus: "SUCCESS",
	})

	return exportReq, nil
}

// ListExportRequests retrieves export requests.
func (s *AuditService) ListExportRequests(
	ctx context.Context,
	status string,
) ([]models.AuditExportRequest, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Audit service is not configured")
	}

	return s.repo.ListAuditExportRequests(ctx, status)
}

// ProcessExportDecision processes peer approval or rejection of an export request.
func (s *AuditService) ProcessExportDecision(
	ctx context.Context,
	requestID uuid.UUID,
	req models.ProcessAuditExportDecision,
	approverID uuid.UUID,
	approverRole string,
) error {
	if s == nil || s.repo == nil {
		return apierrors.New(apierrors.InternalError, "Audit service is not configured")
	}

	err := s.repo.ProcessAuditExportDecision(ctx, requestID, req.Decision, approverID)
	if err != nil {
		return apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to process decision: %v", err))
	}

	// Audit log the approval/rejection decision
	_, _ = s.repo.RecordPlatformAudit(ctx, models.PlatformAuditLog{
		ActorUserID:  &approverID,
		ActorRole:    approverRole,
		Module:       "platform_audit",
		Action:       fmt.Sprintf("AUDIT_EXPORT_%s", req.Decision),
		EntityType:   "AUDIT_EXPORT_REQUEST",
		EntityID:     &requestID,
		Reason:       &req.Reason,
		Severity:     "CRITICAL",
		ResultStatus: "SUCCESS",
	})

	return nil
}

func stringPtr(s string) *string {
	return &s
}
