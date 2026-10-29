package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/database"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
)

// ChangeManagementService coordinates configuration change tracking, snapshot comparisons,
// approval gate integration, precondition validation, and rollback.
type ChangeManagementService struct {
	db              *database.Database
	repo            *repository.Repository
	approvalService *ApprovalService
}

// NewChangeManagementService creates a new change management service.
func NewChangeManagementService(
	db *database.Database,
	repo *repository.Repository,
	approvalService *ApprovalService,
) *ChangeManagementService {
	return &ChangeManagementService{
		db:              db,
		repo:            repo,
		approvalService: approvalService,
	}
}

// ListChangeSets lists change sets derived from persistent approval requests and audit snapshots.
func (s *ChangeManagementService) ListChangeSets(
	ctx context.Context,
	params models.ChangeSetFilterParams,
) ([]models.ConfigurationChangeSet, int, error) {
	if s == nil || s.repo == nil {
		return nil, 0, apierrors.New(apierrors.InternalError, "Change management repository not configured")
	}

	limit := 50
	if params.Limit > 0 {
		limit = params.Limit
	}
	offset := 0
	if params.Offset > 0 {
		offset = params.Offset
	}

	var statusFilter *string
	if params.Status != "" {
		statusFilter = &params.Status
	}

	requests, total, err := s.repo.ListApprovalRequests(ctx, statusFilter, params.CollegeID, nil, nil, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list change sets: %w", err)
	}

	changeSets := make([]models.ConfigurationChangeSet, 0, len(requests))
	for _, req := range requests {
		cs := s.mapApprovalRequestToChangeSet(req)
		if params.Category != "" && string(cs.Category) != params.Category {
			continue
		}
		changeSets = append(changeSets, cs)
	}

	return changeSets, total, nil
}

// GetChangeSet retrieves a single change set by ID (mapped to its persistent approval request).
func (s *ChangeManagementService) GetChangeSet(
	ctx context.Context,
	changeSetID uuid.UUID,
) (*models.ConfigurationChangeSet, []models.SnapshotDiffItem, error) {
	if s == nil || s.repo == nil {
		return nil, nil, apierrors.New(apierrors.InternalError, "Change management repository not configured")
	}

	reqWithSteps, err := s.approvalService.GetApprovalRequest(ctx, changeSetID)
	if err != nil {
		return nil, nil, err
	}

	cs := s.mapApprovalRequestToChangeSet(reqWithSteps.ApprovalRequest)
	diffs := s.calculateDiff(cs.BeforeSnapshot, cs.ProposedSnapshot)

	return &cs, diffs, nil
}

// ProposeChangeSet creates a new change proposal, capturing current preconditions and before snapshots.
func (s *ChangeManagementService) ProposeChangeSet(
	ctx context.Context,
	req models.CreateChangeSetProposalRequest,
	actorUserID uuid.UUID,
	actorRole string,
) (*models.ConfigurationChangeSet, error) {
	if s == nil || s.approvalService == nil {
		return nil, apierrors.New(apierrors.InternalError, "Service not configured")
	}

	// 1. Capture before-snapshot & precondition based on category
	beforeSnapshot, err := s.captureBeforeSnapshot(ctx, req.Category, req.CollegeID, req.TargetKey)
	if err != nil {
		return nil, err
	}

	// 2. Prepare payload for the operation
	payload := models.JSONB{
		"target_key": req.TargetKey,
		"value":      req.ProposedValue,
		"reason":     req.Reason,
	}
	if req.CollegeID != nil {
		payload["college_id"] = req.CollegeID.String()
	}

	// Specific payload mappings for established approval operation types
	var opType string
	switch req.Category {
	case models.ChangeCategoryCollegeSetting:
		opType = "COLLEGE_SETTING_UPDATE"
		payload["key"] = req.TargetKey
		if valStr, ok := req.ProposedValue["setting_value"]; ok {
			b, _ := json.Marshal(valStr)
			payload["value"] = string(b)
		} else {
			b, _ := json.Marshal(req.ProposedValue)
			payload["value"] = string(b)
		}
	case models.ChangeCategoryCollegeModule:
		opType = "COLLEGE_MODULE_UPDATE"
		payload["module_id"] = req.TargetKey
		if st, ok := req.ProposedValue["status"].(string); ok {
			payload["status"] = st
		}
		if md, ok := req.ProposedValue["mode"].(string); ok {
			payload["mode"] = md
		}
	case models.ChangeCategoryCollegeStatus:
		opType = "COLLEGE_STATUS_UPDATE"
		if st, ok := req.ProposedValue["status"].(string); ok {
			payload["status"] = st
		}
	default:
		opType = req.OperationType
	}

	// 3. Create persistent approval request with snapshot and precondition
	expiresAt := time.Now().Add(72 * time.Hour)
	approvalInput := models.CreateApprovalRequestInput{
		OperationType: opType,
		CollegeID:     req.CollegeID,
		Payload:       payload,
		Reason:        &req.Reason,
		Snapshot: models.JSONB{
			"before":       beforeSnapshot,
			"proposed":     req.ProposedValue,
			"category":     string(req.Category),
			"target_key":   req.TargetKey,
			"precondition": beforeSnapshot,
		},
		ExpiresAt: &expiresAt,
		Steps: []models.CreateApprovalStepInput{
			{StepOrder: 1}, // Default to senior peer approval
		},
	}

	created, err := s.approvalService.CreateApprovalRequest(ctx, approvalInput, actorUserID, actorRole)
	if err != nil {
		return nil, err
	}

	cs := s.mapApprovalRequestToChangeSet(created.ApprovalRequest)
	return &cs, nil
}

// WithdrawChangeSet allows the requester to withdraw/cancel a pending change set.
func (s *ChangeManagementService) WithdrawChangeSet(
	ctx context.Context,
	changeSetID uuid.UUID,
	actorUserID uuid.UUID,
	actorRole string,
	reason string,
) (*models.ConfigurationChangeSet, error) {
	updated, err := s.approvalService.CancelApprovalRequest(ctx, changeSetID, actorUserID, actorRole, reason)
	if err != nil {
		return nil, err
	}
	cs := s.mapApprovalRequestToChangeSet(updated.ApprovalRequest)
	return &cs, nil
}

// ProposeRollback generates a rollback change proposal from an audited historical snapshot.
func (s *ChangeManagementService) ProposeRollback(
	ctx context.Context,
	collegeID uuid.UUID,
	auditID uuid.UUID,
	actorUserID uuid.UUID,
	actorRole string,
	reason string,
) (*models.ConfigurationChangeSet, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Repository not configured")
	}

	// 1. Fetch the exact historical audit entry
	auditEntry, err := s.repo.GetSettingsAuditByID(ctx, collegeID, auditID)
	if err != nil {
		return nil, apierrors.New(apierrors.NotFound, fmt.Sprintf("historical snapshot audit entry %s not found: %v", auditID, err))
	}

	if auditEntry.OldValue == nil {
		return nil, apierrors.New(apierrors.ValidationError, "Cannot rollback: historical record has no previous snapshot value")
	}

	// 2. Fetch current active setting to serve as before-snapshot precondition
	currentSetting, err := s.repo.GetCollegeSettingByKey(ctx, collegeID, auditEntry.SettingKey)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("failed to fetch current setting for precondition: %v", err))
	}

	var beforeVal models.JSONB
	if currentSetting != nil {
		beforeVal = currentSetting.SettingValue
	}

	// 3. Construct proposed rollback value
	proposedVal := models.JSONB{
		"setting_key":   auditEntry.SettingKey,
		"setting_value": auditEntry.OldValue,
		"rollback_from": auditID.String(),
	}

	valBytes, _ := json.Marshal(auditEntry.OldValue)

	// 4. Submit via approval workflow with rollback lineage
	expiresAt := time.Now().Add(72 * time.Hour)
	approvalInput := models.CreateApprovalRequestInput{
		OperationType: "COLLEGE_SETTING_UPDATE",
		CollegeID:     &collegeID,
		Payload: models.JSONB{
			"college_id": collegeID.String(),
			"key":        auditEntry.SettingKey,
			"value":      string(valBytes),
			"reason":     reason,
		},
		Reason: &reason,
		Snapshot: models.JSONB{
			"before":             beforeVal,
			"proposed":           proposedVal,
			"category":           string(models.ChangeCategoryCollegeSetting),
			"target_key":         auditEntry.SettingKey,
			"rollback_source_id": auditID.String(),
		},
		ExpiresAt: &expiresAt,
		Steps: []models.CreateApprovalStepInput{
			{StepOrder: 1},
		},
	}

	created, err := s.approvalService.CreateApprovalRequest(ctx, approvalInput, actorUserID, actorRole)
	if err != nil {
		return nil, err
	}

	cs := s.mapApprovalRequestToChangeSet(created.ApprovalRequest)
	return &cs, nil
}

// captureBeforeSnapshot reads the actual current configuration state from the database.
func (s *ChangeManagementService) captureBeforeSnapshot(
	ctx context.Context,
	category models.ChangeSetCategory,
	collegeID *uuid.UUID,
	targetKey string,
) (models.JSONB, error) {
	switch category {
	case models.ChangeCategoryCollegeSetting:
		if collegeID == nil {
			return nil, apierrors.New(apierrors.ValidationError, "College ID is required for college setting snapshot")
		}
		st, err := s.repo.GetCollegeSettingByKey(ctx, *collegeID, targetKey)
		if err != nil && !errors.Is(err, repository.ErrNilDatabase) {
			// If not found, before value is empty
			return models.JSONB{}, nil
		}
		if st != nil {
			return st.SettingValue, nil
		}
		return models.JSONB{}, nil

	case models.ChangeCategorySystemSetting:
		st, err := s.repo.GetSystemSettingByKey(ctx, targetKey)
		if err != nil {
			return models.JSONB{}, nil
		}
		if st != nil {
			return st.SettingValue, nil
		}
		return models.JSONB{}, nil

	default:
		return models.JSONB{}, nil
	}
}

// mapApprovalRequestToChangeSet converts an ApprovalRequest to a ConfigurationChangeSet.
func (s *ChangeManagementService) mapApprovalRequestToChangeSet(
	req models.ApprovalRequest,
) models.ConfigurationChangeSet {
	category := models.ChangeCategoryCollegeSetting
	if strings.Contains(req.OperationType, "MODULE") {
		category = models.ChangeCategoryCollegeModule
	} else if strings.Contains(req.OperationType, "STATUS") {
		category = models.ChangeCategoryCollegeStatus
	} else if strings.Contains(req.OperationType, "SYSTEM") {
		category = models.ChangeCategorySystemSetting
	}

	var before models.JSONB = models.JSONB{}
	var proposed models.JSONB = req.Payload
	var targetKey string = req.OperationType

	if req.Snapshot != nil {
		if b, ok := req.Snapshot["before"].(map[string]interface{}); ok {
			before = b
		}
		if p, ok := req.Snapshot["proposed"].(map[string]interface{}); ok {
			proposed = p
		}
		if tk, ok := req.Snapshot["target_key"].(string); ok {
			targetKey = tk
		}
	}

	var status models.ChangeSetStatus
	switch req.Status {
	case "PENDING":
		status = models.ChangeSetStatusPending
	case "APPROVED":
		status = models.ChangeSetStatusApproved
	case "EXECUTED":
		status = models.ChangeSetStatusApplied
	case "REJECTED":
		status = models.ChangeSetStatusRejected
	case "CANCELLED":
		status = models.ChangeSetStatusCancelled
	default:
		status = models.ChangeSetStatusPending
	}

	reasonStr := ""
	if req.Reason != nil {
		reasonStr = *req.Reason
	}

	reqID := req.RequestID
	return models.ConfigurationChangeSet{
		ChangeSetID:       req.RequestID,
		Category:          category,
		OperationType:     req.OperationType,
		CollegeID:         req.CollegeID,
		TargetEntity:      req.OperationType,
		TargetKey:         targetKey,
		RequestedBy:       req.RequestedBy,
		Reason:            reasonStr,
		Status:            status,
		BeforeSnapshot:    before,
		ProposedSnapshot:  proposed,
		ApprovalRequestID: &reqID,
		ExecutedAt:        req.ExecutedAt,
		CreatedAt:         req.CreatedAt,
		UpdatedAt:         req.UpdatedAt,
	}
}

// calculateDiff computes an attribute-level diff between before and proposed snapshots with secret redaction.
func (s *ChangeManagementService) calculateDiff(
	before models.JSONB,
	proposed models.JSONB,
) []models.SnapshotDiffItem {
	diffs := make([]models.SnapshotDiffItem, 0)
	allKeys := make(map[string]bool)

	for k := range before {
		allKeys[k] = true
	}
	for k := range proposed {
		allKeys[k] = true
	}

	for k := range allKeys {
		oldVal, oldExists := before[k]
		newVal, newExists := proposed[k]

		isSens := isSensitiveKey(k)
		changeType := "UNCHANGED"

		if !oldExists && newExists {
			changeType = "ADDED"
		} else if oldExists && !newExists {
			changeType = "REMOVED"
		} else if fmt.Sprintf("%v", oldVal) != fmt.Sprintf("%v", newVal) {
			changeType = "MODIFIED"
		}

		if isSens {
			if oldExists {
				oldVal = "********"
			}
			if newExists {
				newVal = "********"
			}
		}

		diffs = append(diffs, models.SnapshotDiffItem{
			Key:           k,
			OriginalValue: oldVal,
			ProposedValue: newVal,
			ChangeType:    changeType,
			IsSensitive:   isSens,
		})
	}

	return diffs
}

// isSensitiveKey checks if an attribute key holds secret credentials.
func isSensitiveKey(key string) bool {
	lower := strings.ToLower(key)
	return strings.Contains(lower, "password") ||
		strings.Contains(lower, "secret") ||
		strings.Contains(lower, "token") ||
		strings.Contains(lower, "api_key") ||
		strings.Contains(lower, "private")
}
