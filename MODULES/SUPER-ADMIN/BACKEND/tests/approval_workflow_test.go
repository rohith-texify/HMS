package tests

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/handlers"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
)

// -----------------------------------------------------------------------------
// 1. APPROVAL VALIDATOR UNIT TESTS
// -----------------------------------------------------------------------------

func TestApprovalValidator_ValidateRequestID(t *testing.T) {
	_, err := validators.ValidateRequestID("")
	if err == nil {
		t.Error("expected error for empty request ID")
	}

	_, err = validators.ValidateRequestID("invalid-uuid")
	if err == nil {
		t.Error("expected error for invalid UUID format")
	}

	validID := uuid.New()
	parsed, err := validators.ValidateRequestID(validID.String())
	if err != nil {
		t.Errorf("unexpected error for valid request ID: %v", err)
	}
	if parsed != validID {
		t.Errorf("expected %v, got %v", validID, parsed)
	}
}

func TestApprovalValidator_ValidateStepID(t *testing.T) {
	_, err := validators.ValidateStepID("")
	if err == nil {
		t.Error("expected error for empty step ID")
	}

	validID := uuid.New()
	parsed, err := validators.ValidateStepID(validID.String())
	if err != nil {
		t.Errorf("unexpected error for valid step ID: %v", err)
	}
	if parsed != validID {
		t.Errorf("expected %v, got %v", validID, parsed)
	}
}

func TestApprovalValidator_ValidateListParams(t *testing.T) {
	tests := []struct {
		name        string
		params      *models.ListApprovalRequestsParams
		expectError bool
	}{
		{
			name: "Valid default params",
			params: &models.ListApprovalRequestsParams{
				Limit:  20,
				Offset: 0,
			},
			expectError: false,
		},
		{
			name: "Valid status PENDING",
			params: &models.ListApprovalRequestsParams{
				Status: "PENDING",
			},
			expectError: false,
		},
		{
			name: "Valid status EXECUTED",
			params: &models.ListApprovalRequestsParams{
				Status: "EXECUTED",
			},
			expectError: false,
		},
		{
			name: "Invalid status",
			params: &models.ListApprovalRequestsParams{
				Status: "UNKNOWN_STATUS",
			},
			expectError: true,
		},
		{
			name: "Negative limit",
			params: &models.ListApprovalRequestsParams{
				Limit: -1,
			},
			expectError: true,
		},
		{
			name: "Limit exceeds 100",
			params: &models.ListApprovalRequestsParams{
				Limit: 101,
			},
			expectError: true,
		},
		{
			name: "Negative offset",
			params: &models.ListApprovalRequestsParams{
				Offset: -5,
			},
			expectError: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validators.ValidateListApprovalRequestsParams(tc.params)
			if tc.expectError && err == nil {
				t.Fatalf("expected error, got nil")
			}
			if !tc.expectError && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

func TestApprovalValidator_ValidateCreateRequest(t *testing.T) {
	now := time.Now()
	past := now.Add(-1 * time.Hour)
	future := now.Add(24 * time.Hour)

	approver1 := uuid.New()
	approver2 := uuid.New()
	nilUUID := uuid.Nil

	tests := []struct {
		name        string
		req         *models.CreateApprovalRequestInput
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Nil request",
			req:         nil,
			expectError: true,
			errorMsg:    "Request body is required",
		},
		{
			name: "Unsupported operation type",
			req: &models.CreateApprovalRequestInput{
				OperationType: "UNSUPPORTED_OP",
				Payload:       map[string]interface{}{"key": "val"},
				Steps: []models.CreateApprovalStepInput{
					{StepOrder: 1},
				},
			},
			expectError: true,
			errorMsg:    "Unsupported operation type",
		},
		{
			name: "Empty payload",
			req: &models.CreateApprovalRequestInput{
				OperationType: "COLLEGE_STATUS_UPDATE",
				Payload:       map[string]interface{}{},
				Steps: []models.CreateApprovalStepInput{
					{StepOrder: 1},
				},
			},
			expectError: true,
			errorMsg:    "Payload cannot be empty",
		},
		{
			name: "Expired expires_at",
			req: &models.CreateApprovalRequestInput{
				OperationType: "COLLEGE_STATUS_UPDATE",
				Payload:       map[string]interface{}{"status": "ACTIVE"},
				ExpiresAt:     &past,
				Steps: []models.CreateApprovalStepInput{
					{StepOrder: 1},
				},
			},
			expectError: true,
			errorMsg:    "Expiry time must be in the future",
		},
		{
			name: "No steps provided",
			req: &models.CreateApprovalRequestInput{
				OperationType: "COLLEGE_STATUS_UPDATE",
				Payload:       map[string]interface{}{"status": "ACTIVE"},
				Steps:         []models.CreateApprovalStepInput{},
			},
			expectError: true,
			errorMsg:    "At least one approval step is required",
		},
		{
			name: "Step order less than 1",
			req: &models.CreateApprovalRequestInput{
				OperationType: "COLLEGE_STATUS_UPDATE",
				Payload:       map[string]interface{}{"status": "ACTIVE"},
				Steps: []models.CreateApprovalStepInput{
					{StepOrder: 0},
				},
			},
			expectError: true,
			errorMsg:    "Step order must be greater than 0",
		},
		{
			name: "Duplicate step orders",
			req: &models.CreateApprovalRequestInput{
				OperationType: "COLLEGE_STATUS_UPDATE",
				Payload:       map[string]interface{}{"status": "ACTIVE"},
				Steps: []models.CreateApprovalStepInput{
					{StepOrder: 1, ApproverID: &approver1},
					{StepOrder: 1, ApproverID: &approver2},
				},
			},
			expectError: true,
			errorMsg:    "Duplicate step_order",
		},
		{
			name: "Nil college ID UUID rejected",
			req: &models.CreateApprovalRequestInput{
				OperationType: "COLLEGE_STATUS_UPDATE",
				CollegeID:     &nilUUID,
				Payload:       map[string]interface{}{"status": "ACTIVE"},
				Steps: []models.CreateApprovalStepInput{
					{StepOrder: 1, ApproverID: &approver1},
				},
			},
			expectError: true,
			errorMsg:    "Invalid college_id",
		},
		{
			name: "Nil approver ID UUID in step rejected",
			req: &models.CreateApprovalRequestInput{
				OperationType: "COLLEGE_STATUS_UPDATE",
				Payload:       map[string]interface{}{"status": "ACTIVE"},
				Steps: []models.CreateApprovalStepInput{
					{StepOrder: 1, ApproverID: &nilUUID},
				},
			},
			expectError: true,
			errorMsg:    "Invalid step approver_id",
		},
		{
			name: "Valid sequential steps",
			req: &models.CreateApprovalRequestInput{
				OperationType: "COLLEGE_STATUS_UPDATE",
				Payload:       map[string]interface{}{"status": "ACTIVE"},
				ExpiresAt:     &future,
				Steps: []models.CreateApprovalStepInput{
					{StepOrder: 1, ApproverID: &approver1},
					{StepOrder: 2, ApproverID: &approver2},
				},
			},
			expectError: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validators.ValidateCreateApprovalRequest(tc.req)
			if tc.expectError {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				if tc.errorMsg != "" && !strings.Contains(err.Error(), tc.errorMsg) {
					t.Fatalf("expected error containing %q, got: %v", tc.errorMsg, err)
				}
			} else {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
			}
		})
	}
}

func TestApprovalValidator_ValidateDecisionRequest(t *testing.T) {
	validReason := "Valid rejection reason"
	validComment := "Valid rejection comment"
	emptyStr := "   "
	longReason := strings.Repeat("r", 501)
	longComment := strings.Repeat("c", 1001)

	tests := []struct {
		name        string
		req         *models.ApprovalDecisionRequest
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Nil decision request",
			req:         nil,
			expectError: true,
			errorMsg:    "Request body is required",
		},
		{
			name: "Invalid decision value",
			req: &models.ApprovalDecisionRequest{
				Decision: "MAYBE",
			},
			expectError: true,
			errorMsg:    "Invalid decision",
		},
		{
			name: "Valid APPROVE without reason or comment",
			req: &models.ApprovalDecisionRequest{
				Decision: "APPROVE",
			},
			expectError: false,
		},
		{
			name: "Valid APPROVED with comment",
			req: &models.ApprovalDecisionRequest{
				Decision: "APPROVED",
				Comment:  &validComment,
			},
			expectError: false,
		},
		{
			name: "REJECT without reason or comment fails",
			req: &models.ApprovalDecisionRequest{
				Decision: "REJECT",
			},
			expectError: true,
			errorMsg:    "Rejection requires a non-empty reason or comment",
		},
		{
			name: "REJECT with whitespace-only reason fails",
			req: &models.ApprovalDecisionRequest{
				Decision: "REJECT",
				Reason:   &emptyStr,
			},
			expectError: true,
			errorMsg:    "Rejection requires a non-empty reason or comment",
		},
		{
			name: "Valid REJECT with reason",
			req: &models.ApprovalDecisionRequest{
				Decision: "REJECT",
				Reason:   &validReason,
			},
			expectError: false,
		},
		{
			name: "Valid REJECT with comment",
			req: &models.ApprovalDecisionRequest{
				Decision: "REJECTED",
				Comment:  &validComment,
			},
			expectError: false,
		},
		{
			name: "Overly long reason exceeds 500 chars",
			req: &models.ApprovalDecisionRequest{
				Decision: "APPROVE",
				Reason:   &longReason,
			},
			expectError: true,
			errorMsg:    "Reason cannot exceed 500 characters",
		},
		{
			name: "Overly long comment exceeds 1000 chars",
			req: &models.ApprovalDecisionRequest{
				Decision: "APPROVE",
				Comment:  &longComment,
			},
			expectError: true,
			errorMsg:    "Comment cannot exceed 1000 characters",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validators.ValidateApprovalDecisionRequest(tc.req)
			if tc.expectError {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				if tc.errorMsg != "" && !strings.Contains(err.Error(), tc.errorMsg) {
					t.Fatalf("expected error containing %q, got: %v", tc.errorMsg, err)
				}
			} else {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
			}
		})
	}
}

// -----------------------------------------------------------------------------
// 2. REPOSITORY & SERVICE FAIL-CLOSED TESTS (SCENARIO 11)
// -----------------------------------------------------------------------------

func TestApprovalRepository_FailClosed_Unconfigured(t *testing.T) {
	ctx := context.Background()
	repo := repository.New(nil)

	// Verify fail-closed behavior across all approval repository methods
	_, _, err := repo.ListApprovalRequests(ctx, nil, nil, 10, 0)
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
	}

	_, err = repo.GetApprovalRequestByID(ctx, uuid.New())
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
	}

	_, err = repo.GetApprovalStepsByRequestID(ctx, uuid.New())
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
	}

	_, err = repo.GetApprovalStepByID(ctx, uuid.New())
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
	}

	_, err = repo.UpdateApprovalStepDecision(ctx, uuid.New(), uuid.New(), "APPROVED", nil, nil)
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
	}

	err = repo.UpdateApprovalRequestStatus(ctx, uuid.New(), "APPROVED")
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
	}

	err = repo.MarkApprovalRequestAsExecuted(ctx, uuid.New())
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
	}

	_, err = repo.CreateApprovalRequest(ctx, models.ApprovalRequest{
		OperationType: "COLLEGE_STATUS_UPDATE",
		Payload:       models.JSONB{"status": "ACTIVE"},
		RequestedBy:   uuid.New(),
	})
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
	}

	_, err = repo.CreateApprovalStep(ctx, uuid.New(), 1, nil)
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
	}

	_, err = repo.GetApprovalRequestByIDForUpdate(ctx, uuid.New())
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
	}

	_, err = repo.GetApprovalStepByIDForUpdate(ctx, uuid.New())
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
	}

	err = repo.RecordApprovalAudit(ctx, models.ApprovalAuditParams{
		ActorUserID: uuid.New(),
		Action:      "APPROVAL_REQUEST_CREATED",
	})
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
	}

	colID := uuid.New()
	err = repo.ExecuteOperation(ctx, "COLLEGE_STATUS_UPDATE", &colID, models.JSONB{"status": "ACTIVE"}, uuid.New())
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
	}
}

func TestApprovalService_FailClosedAndGuards(t *testing.T) {
	ctx := context.Background()

	// 1. Nil service / unconfigured DB
	svc := services.NewApprovalService(nil, nil)

	_, _, err := svc.ListApprovalRequests(ctx, models.ListApprovalRequestsParams{})
	if err == nil {
		t.Errorf("expected error for unconfigured service in ListApprovalRequests")
	}

	_, err = svc.GetApprovalRequest(ctx, uuid.New())
	if err == nil {
		t.Errorf("expected error for unconfigured service in GetApprovalRequest")
	}

	_, err = svc.CreateApprovalRequest(ctx, models.CreateApprovalRequestInput{
		OperationType: "COLLEGE_STATUS_UPDATE",
		Payload:       models.JSONB{"status": "ACTIVE"},
		Steps:         []models.CreateApprovalStepInput{{StepOrder: 1}},
	}, uuid.New(), "SUPER_ADMIN")
	if err == nil {
		t.Errorf("expected error for unconfigured service in CreateApprovalRequest")
	}

	_, err = svc.ProcessApprovalDecision(ctx, uuid.New(), uuid.New(), "SUPER_ADMIN", models.ApprovalDecisionRequest{
		Decision: "APPROVE",
	})
	if err == nil {
		t.Errorf("expected error for unconfigured service in ProcessApprovalDecision")
	}

	_, err = svc.ExecuteApprovalRequest(ctx, uuid.New(), uuid.New(), "SUPER_ADMIN")
	if err == nil {
		t.Errorf("expected error for unconfigured service in ExecuteApprovalRequest")
	}

	// 2. Authentication guards with valid service struct but nil requestedBy
	dummyRepo := repository.New(nil)
	dummyDB := &database.Database{}
	svcWithRepo := services.NewApprovalService(dummyDB, dummyRepo)

	_, err = svcWithRepo.CreateApprovalRequest(ctx, models.CreateApprovalRequestInput{
		OperationType: "COLLEGE_STATUS_UPDATE",
		Payload:       models.JSONB{"status": "ACTIVE"},
		Steps:         []models.CreateApprovalStepInput{{StepOrder: 1}},
	}, uuid.Nil, "SUPER_ADMIN")
	if err == nil || !strings.Contains(err.Error(), "Authenticated user is required") {
		t.Errorf("expected unauthorized error for nil requestedBy, got %v", err)
	}

	_, err = svcWithRepo.ProcessApprovalDecision(ctx, uuid.New(), uuid.Nil, "SUPER_ADMIN", models.ApprovalDecisionRequest{
		Decision: "APPROVE",
	})
	if err == nil || !strings.Contains(err.Error(), "Authenticated approver ID is required") {
		t.Errorf("expected unauthorized error for nil approverID, got %v", err)
	}

	_, err = svcWithRepo.ExecuteApprovalRequest(ctx, uuid.New(), uuid.Nil, "SUPER_ADMIN")
	if err == nil || !strings.Contains(err.Error(), "Authenticated executor ID is required") {
		t.Errorf("expected unauthorized error for nil executorID, got %v", err)
	}

	// 3. Maker-checker creation guard: requester assigned as approver
	requesterID := uuid.New()
	_, err = svcWithRepo.CreateApprovalRequest(ctx, models.CreateApprovalRequestInput{
		OperationType: "COLLEGE_STATUS_UPDATE",
		Payload:       models.JSONB{"status": "ACTIVE"},
		Steps: []models.CreateApprovalStepInput{
			{StepOrder: 1, ApproverID: &requesterID},
		},
	}, requesterID, "SUPER_ADMIN")
	if err == nil || !strings.Contains(err.Error(), "maker-checker violation") {
		t.Errorf("expected maker-checker violation when requester assigned as approver, got %v", err)
	}
}

// -----------------------------------------------------------------------------
// 3. APPROVAL HANDLER UNIT TESTS & ACTOR SPOOFING PROTECTION (SCENARIO 14)
// -----------------------------------------------------------------------------

func TestApprovalHandler_AuthenticationAndSpoofingProtection(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := services.NewApprovalService(nil, nil)
	handler := handlers.NewApprovalHandler(svc)

	// 1. Missing actor context -> 401 Unauthorized
	t.Run("CreateApprovalRequest - Missing Actor Context returns 401", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		body := `{"operation_type":"COLLEGE_STATUS_UPDATE","payload":{"status":"ACTIVE"},"steps":[{"step_order":1}]}`
		c.Request, _ = http.NewRequest(http.MethodPost, "/super-admin/approvals", bytes.NewBufferString(body))
		c.Request.Header.Set("Content-Type", "application/json")

		handler.CreateApprovalRequest(c)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected HTTP 401, got %d", w.Code)
		}
	})

	// 2. Malformed JSON -> 400 Bad Request
	t.Run("CreateApprovalRequest - Malformed JSON returns 400", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("auth_user_id", uuid.New())
		c.Set("auth_role", "SUPER_ADMIN")
		c.Request, _ = http.NewRequest(http.MethodPost, "/super-admin/approvals", bytes.NewBufferString("{invalid-json"))
		c.Request.Header.Set("Content-Type", "application/json")

		handler.CreateApprovalRequest(c)

		if w.Code != http.StatusBadRequest {
			t.Errorf("expected HTTP 400, got %d", w.Code)
		}
	})

	// 3. Invalid UUID in URL Param -> 400 Bad Request
	t.Run("GetApprovalRequest - Invalid UUID parameter returns 400", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "id", Value: "not-a-uuid"}}
		c.Request, _ = http.NewRequest(http.MethodGet, "/super-admin/approvals/not-a-uuid", nil)

		handler.GetApprovalRequest(c)

		if w.Code != http.StatusBadRequest {
			t.Errorf("expected HTTP 400, got %d", w.Code)
		}
	})

	t.Run("ProcessApprovalDecision - Invalid Step ID returns 400", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "step_id", Value: "invalid-step"}}
		c.Request, _ = http.NewRequest(http.MethodPost, "/super-admin/approvals/steps/invalid-step/decision", bytes.NewBufferString(`{"decision":"APPROVE"}`))
		c.Request.Header.Set("Content-Type", "application/json")

		handler.ProcessApprovalDecision(c)

		if w.Code != http.StatusBadRequest {
			t.Errorf("expected HTTP 400, got %d", w.Code)
		}
	})

	t.Run("ProcessApprovalDecision - Missing Actor returns 401", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		stepID := uuid.New()
		c.Params = gin.Params{{Key: "step_id", Value: stepID.String()}}
		c.Request, _ = http.NewRequest(http.MethodPost, fmt.Sprintf("/super-admin/approvals/steps/%s/decision", stepID.String()), bytes.NewBufferString(`{"decision":"APPROVE"}`))
		c.Request.Header.Set("Content-Type", "application/json")

		handler.ProcessApprovalDecision(c)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected HTTP 401, got %d", w.Code)
		}
	})

	t.Run("ExecuteApprovalRequest - Missing Actor returns 401", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		reqID := uuid.New()
		c.Params = gin.Params{{Key: "id", Value: reqID.String()}}
		c.Request, _ = http.NewRequest(http.MethodPost, fmt.Sprintf("/super-admin/approvals/%s/execute", reqID.String()), nil)

		handler.ExecuteApprovalRequest(c)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected HTTP 401, got %d", w.Code)
		}
	})
}

// -----------------------------------------------------------------------------
// 4. ISOLATED INTEGRATION TESTS (REQUIRES TEST_DATABASE_URL)
// -----------------------------------------------------------------------------

func seedTestUser(ctx context.Context, db *database.Database, emailPrefix string) (uuid.UUID, error) {
	userID := uuid.New()
	email := fmt.Sprintf("%s-%s@hms.platform", emailPrefix, userID.String()[:8])
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO app.users (user_id, email, status)
		VALUES ($1, $2, 'ACTIVE')
		ON CONFLICT DO NOTHING
	`, userID, email)
	return userID, err
}

func createTestCollegeForApproval(ctx context.Context, db *database.Database) (uuid.UUID, error) {
	collegeID := uuid.New()
	code := "col-" + collegeID.String()[:8]
	name := "Approval Test College " + code
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO platform.colleges (college_id, college_code, name, status, timezone)
		VALUES ($1, $2, $3, 'ONBOARDING', 'UTC')
	`, collegeID, code, name)
	return collegeID, err
}

func TestApprovalWorkflow_Integration_MultiStepAndAutoExecute(t *testing.T) {
	db, repo := setupTestDB(t)
	defer db.Pool.Close()

	ctx := context.Background()
	svc := services.NewApprovalService(db, repo)

	// Seed actors
	requesterID, err := seedTestUser(ctx, db, "requester")
	if err != nil {
		t.Fatalf("failed to seed requester: %v", err)
	}
	approver1ID, err := seedTestUser(ctx, db, "approver1")
	if err != nil {
		t.Fatalf("failed to seed approver1: %v", err)
	}
	approver2ID, err := seedTestUser(ctx, db, "approver2")
	if err != nil {
		t.Fatalf("failed to seed approver2: %v", err)
	}

	collegeID, err := createTestCollegeForApproval(ctx, db)
	if err != nil {
		t.Fatalf("failed to create test college: %v", err)
	}
	defer func() {
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.audit_logs WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.approval_steps WHERE request_id IN (SELECT request_id FROM platform.approval_requests WHERE college_id = $1)", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.approval_requests WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.colleges WHERE college_id = $1", collegeID)
	}()

	// 1. Create a 2-step approval request for COLLEGE_STATUS_UPDATE -> ACTIVE
	payload := map[string]interface{}{
		"college_id": collegeID.String(),
		"status":     "ACTIVE",
		"reason":     "Full multi-step integration activation",
	}

	createInput := models.CreateApprovalRequestInput{
		CollegeID:     &collegeID,
		OperationType: "COLLEGE_STATUS_UPDATE",
		Payload:       payload,
		Steps: []models.CreateApprovalStepInput{
			{StepOrder: 1, ApproverID: &approver1ID},
			{StepOrder: 2, ApproverID: &approver2ID},
		},
	}

	createdReq, err := svc.CreateApprovalRequest(ctx, createInput, requesterID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to create approval request: %v", err)
	}

	if createdReq.Status != "PENDING" {
		t.Fatalf("expected request status to be PENDING, got %s", createdReq.Status)
	}
	if len(createdReq.Steps) != 2 {
		t.Fatalf("expected 2 steps, got %d", len(createdReq.Steps))
	}

	step1 := createdReq.Steps[0]
	step2 := createdReq.Steps[1]

	// 2. Maker-checker enforcement: Requester CANNOT approve their own request
	reason := "Self-approval test"
	_, err = svc.ProcessApprovalDecision(ctx, step1.ApprovalStepID, requesterID, "SUPER_ADMIN", models.ApprovalDecisionRequest{
		Decision: "APPROVE",
		Reason:   &reason,
	})
	if err == nil {
		t.Fatalf("expected maker-checker violation when requester attempts to approve, but got nil")
	}

	// 3. Assigned approver enforcement: Approver 2 cannot approve step 1 (assigned to approver 1)
	_, err = svc.ProcessApprovalDecision(ctx, step1.ApprovalStepID, approver2ID, "SUPER_ADMIN", models.ApprovalDecisionRequest{
		Decision: "APPROVE",
		Reason:   &reason,
	})
	if err == nil {
		t.Fatalf("expected unauthorized error when non-assigned approver attempts decision, but got nil")
	}

	// 4. Sequential ordering: Step 2 cannot be approved before Step 1
	_, err = svc.ProcessApprovalDecision(ctx, step2.ApprovalStepID, approver2ID, "SUPER_ADMIN", models.ApprovalDecisionRequest{
		Decision: "APPROVE",
		Reason:   &reason,
	})
	if err == nil {
		t.Fatalf("expected sequential approval violation when approving step 2 before step 1, but got nil")
	}

	// 5. Approver 1 approves Step 1
	decisionReason1 := "Step 1 verification completed"
	updatedReq, err := svc.ProcessApprovalDecision(ctx, step1.ApprovalStepID, approver1ID, "SUPER_ADMIN", models.ApprovalDecisionRequest{
		Decision: "APPROVE",
		Reason:   &decisionReason1,
	})
	if err != nil {
		t.Fatalf("failed to approve step 1: %v", err)
	}
	if updatedReq.Status != "PENDING" {
		t.Fatalf("expected request status still PENDING after 1st step of 2, got %s", updatedReq.Status)
	}

	// 6. Repeated decision protection: Approver 1 cannot decide on Step 1 again
	_, err = svc.ProcessApprovalDecision(ctx, step1.ApprovalStepID, approver1ID, "SUPER_ADMIN", models.ApprovalDecisionRequest{
		Decision: "APPROVE",
		Reason:   &decisionReason1,
	})
	if err == nil {
		t.Fatalf("expected error for repeated decision on already approved step, got nil")
	}

	// 7. Approver 2 approves Step 2 (final step -> triggers auto execution)
	decisionReason2 := "Step 2 final sign-off"
	finalReq, err := svc.ProcessApprovalDecision(ctx, step2.ApprovalStepID, approver2ID, "SUPER_ADMIN", models.ApprovalDecisionRequest{
		Decision: "APPROVE",
		Reason:   &decisionReason2,
	})
	if err != nil {
		t.Fatalf("failed to approve step 2: %v", err)
	}

	// Check final status
	if finalReq.Status != "APPROVED" && finalReq.Status != "EXECUTED" {
		t.Fatalf("expected final request status APPROVED or EXECUTED, got %s", finalReq.Status)
	}

	// 8. Verify college status in database was updated to ACTIVE
	var currentStatus string
	err = db.Pool.QueryRow(ctx, "SELECT status FROM platform.colleges WHERE college_id = $1", collegeID).Scan(&currentStatus)
	if err != nil {
		t.Fatalf("failed to query college status: %v", err)
	}
	if currentStatus != "ACTIVE" {
		t.Fatalf("expected college status to be ACTIVE after execution, got %s", currentStatus)
	}

	// 9. Verify duplicate execution prevention
	_, err = svc.ExecuteApprovalRequest(ctx, createdReq.RequestID, approver2ID, "SUPER_ADMIN")
	// If it was already EXECUTED, it should reject re-execution
	if finalReq.Status == "EXECUTED" && err == nil {
		t.Fatalf("expected duplicate execution to be rejected")
	}

	// 10. Verify audit log entry was written
	var auditCount int
	err = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM platform.audit_logs
		WHERE entity_type = 'APPROVAL_REQUEST' AND entity_id = $1
	`, createdReq.RequestID).Scan(&auditCount)
	if err != nil {
		t.Fatalf("failed to count audit logs: %v", err)
	}
	if auditCount == 0 {
		t.Fatalf("expected audit log entries for approval request, found none")
	}
}

func TestApprovalWorkflow_Integration_RejectionFlow(t *testing.T) {
	db, repo := setupTestDB(t)
	defer db.Pool.Close()

	ctx := context.Background()
	svc := services.NewApprovalService(db, repo)

	requesterID, err := seedTestUser(ctx, db, "rej-req")
	if err != nil {
		t.Fatalf("failed to seed requester: %v", err)
	}
	approverID, err := seedTestUser(ctx, db, "rej-appr")
	if err != nil {
		t.Fatalf("failed to seed approver: %v", err)
	}

	collegeID, err := createTestCollegeForApproval(ctx, db)
	if err != nil {
		t.Fatalf("failed to create college: %v", err)
	}
	defer func() {
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.audit_logs WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.approval_steps WHERE request_id IN (SELECT request_id FROM platform.approval_requests WHERE college_id = $1)", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.approval_requests WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.colleges WHERE college_id = $1", collegeID)
	}()

	payload := map[string]interface{}{
		"college_id": collegeID.String(),
		"status":     "ACTIVE",
	}

	createdReq, err := svc.CreateApprovalRequest(ctx, models.CreateApprovalRequestInput{
		CollegeID:     &collegeID,
		OperationType: "COLLEGE_STATUS_UPDATE",
		Payload:       payload,
		Steps: []models.CreateApprovalStepInput{
			{StepOrder: 1, ApproverID: &approverID},
		},
	}, requesterID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	step := createdReq.Steps[0]

	// Reject the request
	rejReason := "Does not meet security criteria"
	rejectedReq, err := svc.ProcessApprovalDecision(ctx, step.ApprovalStepID, approverID, "SUPER_ADMIN", models.ApprovalDecisionRequest{
		Decision: "REJECT",
		Reason:   &rejReason,
	})
	if err != nil {
		t.Fatalf("failed to reject request: %v", err)
	}

	if rejectedReq.Status != "REJECTED" {
		t.Fatalf("expected request status REJECTED, got %s", rejectedReq.Status)
	}

	// Verify cannot execute a rejected request
	_, err = svc.ExecuteApprovalRequest(ctx, createdReq.RequestID, approverID, "SUPER_ADMIN")
	if err == nil {
		t.Fatalf("expected execution of rejected request to fail")
	}

	// Verify college status remained ONBOARDING
	var currentStatus string
	err = db.Pool.QueryRow(ctx, "SELECT status FROM platform.colleges WHERE college_id = $1", collegeID).Scan(&currentStatus)
	if err != nil {
		t.Fatalf("failed to query college status: %v", err)
	}
	if currentStatus != "ONBOARDING" {
		t.Fatalf("expected college status to stay ONBOARDING, got %s", currentStatus)
	}
}

func TestApprovalWorkflow_Integration_ConcurrencyRowLock(t *testing.T) {
	db, repo := setupTestDB(t)
	defer db.Pool.Close()

	ctx := context.Background()
	svc := services.NewApprovalService(db, repo)

	requesterID, err := seedTestUser(ctx, db, "conc-req")
	if err != nil {
		t.Fatalf("failed to seed requester: %v", err)
	}
	approverID, err := seedTestUser(ctx, db, "conc-appr")
	if err != nil {
		t.Fatalf("failed to seed approver: %v", err)
	}

	collegeID, err := createTestCollegeForApproval(ctx, db)
	if err != nil {
		t.Fatalf("failed to create college: %v", err)
	}
	defer func() {
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.audit_logs WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.approval_steps WHERE request_id IN (SELECT request_id FROM platform.approval_requests WHERE college_id = $1)", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.approval_requests WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.colleges WHERE college_id = $1", collegeID)
	}()

	createdReq, err := svc.CreateApprovalRequest(ctx, models.CreateApprovalRequestInput{
		CollegeID:     &collegeID,
		OperationType: "COLLEGE_STATUS_UPDATE",
		Payload: map[string]interface{}{
			"college_id": collegeID.String(),
			"status":     "ACTIVE",
		},
		Steps: []models.CreateApprovalStepInput{
			{StepOrder: 1, ApproverID: &approverID},
		},
	}, requesterID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	step := createdReq.Steps[0]

	// Launch two concurrent attempts to approve the same step
	var wg sync.WaitGroup
	successCount := 0
	errorCount := 0
	var mu sync.Mutex

	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			reason := fmt.Sprintf("Concurrent approval attempt %d", id)
			_, decErr := svc.ProcessApprovalDecision(ctx, step.ApprovalStepID, approverID, "SUPER_ADMIN", models.ApprovalDecisionRequest{
				Decision: "APPROVE",
				Reason:   &reason,
			})
			mu.Lock()
			if decErr == nil {
				successCount++
			} else {
				errorCount++
			}
			mu.Unlock()
		}(i)
	}

	wg.Wait()

	// Exactly one decision must succeed, the other must fail (repeat decision prevented by row lock)
	if successCount != 1 {
		t.Fatalf("expected exactly 1 concurrent decision to succeed, got %d (errors: %d)", successCount, errorCount)
	}
	if errorCount != 1 {
		t.Fatalf("expected exactly 1 concurrent decision to be rejected, got %d", errorCount)
	}
}

func TestApprovalWorkflow_Integration_SafeExecutionRollback(t *testing.T) {
	db, repo := setupTestDB(t)
	defer db.Pool.Close()

	ctx := context.Background()
	svc := services.NewApprovalService(db, repo)

	requesterID, err := seedTestUser(ctx, db, "roll-req")
	if err != nil {
		t.Fatalf("failed to seed requester: %v", err)
	}
	approverID, err := seedTestUser(ctx, db, "roll-appr")
	if err != nil {
		t.Fatalf("failed to seed approver: %v", err)
	}

	// Payload with missing/invalid data for college status update (e.g. non-existent college)
	nonExistentCollegeID := uuid.New()
	invalidPayload := map[string]interface{}{
		"college_id": nonExistentCollegeID.String(),
		"status":     "ACTIVE",
	}

	createdReq, err := svc.CreateApprovalRequest(ctx, models.CreateApprovalRequestInput{
		OperationType: "COLLEGE_STATUS_UPDATE",
		Payload:       invalidPayload,
		Steps: []models.CreateApprovalStepInput{
			{StepOrder: 1, ApproverID: &approverID},
		},
	}, requesterID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to create approval request: %v", err)
	}
	defer func() {
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.approval_steps WHERE request_id = $1", createdReq.RequestID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.approval_requests WHERE request_id = $1", createdReq.RequestID)
	}()

	// Approving this triggers auto-execution which will fail to update non-existent college.
	// The transaction must safely rollback without corrupting state.
	reason := "Attempt approval on invalid college"
	_, err = svc.ProcessApprovalDecision(ctx, createdReq.Steps[0].ApprovalStepID, approverID, "SUPER_ADMIN", models.ApprovalDecisionRequest{
		Decision: "APPROVE",
		Reason:   &reason,
	})

	if err == nil {
		t.Fatalf("expected execution failure due to non-existent college, got nil")
	}

	// Verify request in DB did not transition to EXECUTED
	refetched, fetchErr := svc.GetApprovalRequest(ctx, createdReq.RequestID)
	if fetchErr != nil {
		t.Fatalf("failed to refetch request: %v", fetchErr)
	}
	if refetched.Status == "EXECUTED" {
		t.Fatalf("expected request status to not be EXECUTED after rollback, got %s", refetched.Status)
	}
}

func TestApprovalWorkflow_Integration_RepeatedAndConflictingDecisions(t *testing.T) {
	db, repo := setupTestDB(t)
	defer db.Pool.Close()

	ctx := context.Background()
	svc := services.NewApprovalService(db, repo)

	requesterID, err := seedTestUser(ctx, db, "conf-req")
	if err != nil {
		t.Fatalf("failed to seed requester: %v", err)
	}
	approverID, err := seedTestUser(ctx, db, "conf-appr")
	if err != nil {
		t.Fatalf("failed to seed approver: %v", err)
	}

	collegeID, err := createTestCollegeForApproval(ctx, db)
	if err != nil {
		t.Fatalf("failed to create college: %v", err)
	}
	defer func() {
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.audit_logs WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.approval_steps WHERE request_id IN (SELECT request_id FROM platform.approval_requests WHERE college_id = $1)", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.approval_requests WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.colleges WHERE college_id = $1", collegeID)
	}()

	// Case 1: Rejection, followed by attempted approval (Scenario 9)
	req1, err := svc.CreateApprovalRequest(ctx, models.CreateApprovalRequestInput{
		CollegeID:     &collegeID,
		OperationType: "COLLEGE_STATUS_UPDATE",
		Payload:       models.JSONB{"college_id": collegeID.String(), "status": "ACTIVE"},
		Steps:         []models.CreateApprovalStepInput{{StepOrder: 1, ApproverID: &approverID}},
	}, requesterID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to create req1: %v", err)
	}

	rejReason := "Rejection test reason"
	_, err = svc.ProcessApprovalDecision(ctx, req1.Steps[0].ApprovalStepID, approverID, "SUPER_ADMIN", models.ApprovalDecisionRequest{
		Decision: "REJECT",
		Reason:   &rejReason,
	})
	if err != nil {
		t.Fatalf("failed to reject req1: %v", err)
	}

	// Attempt approval after rejection (must fail with conflict)
	appReason := "Attempt approval after rejection"
	_, err = svc.ProcessApprovalDecision(ctx, req1.Steps[0].ApprovalStepID, approverID, "SUPER_ADMIN", models.ApprovalDecisionRequest{
		Decision: "APPROVE",
		Reason:   &appReason,
	})
	if err == nil {
		t.Fatalf("expected conflict error when attempting approval after rejection, got nil")
	}

	// Case 2: Approval, followed by attempted rejection (Scenario 10)
	req2, err := svc.CreateApprovalRequest(ctx, models.CreateApprovalRequestInput{
		CollegeID:     &collegeID,
		OperationType: "COLLEGE_STATUS_UPDATE",
		Payload:       models.JSONB{"college_id": collegeID.String(), "status": "ACTIVE"},
		Steps:         []models.CreateApprovalStepInput{{StepOrder: 1, ApproverID: &approverID}},
	}, requesterID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to create req2: %v", err)
	}

	_, err = svc.ProcessApprovalDecision(ctx, req2.Steps[0].ApprovalStepID, approverID, "SUPER_ADMIN", models.ApprovalDecisionRequest{
		Decision: "APPROVE",
		Reason:   &appReason,
	})
	if err != nil {
		t.Fatalf("failed to approve req2: %v", err)
	}

	// Attempt rejection after approval (must fail with conflict)
	_, err = svc.ProcessApprovalDecision(ctx, req2.Steps[0].ApprovalStepID, approverID, "SUPER_ADMIN", models.ApprovalDecisionRequest{
		Decision: "REJECT",
		Reason:   &rejReason,
	})
	if err == nil {
		t.Fatalf("expected conflict error when attempting rejection after approval, got nil")
	}
}

func TestApprovalWorkflow_Integration_MissingRequest(t *testing.T) {
	db, repo := setupTestDB(t)
	defer db.Pool.Close()

	ctx := context.Background()
	svc := services.NewApprovalService(db, repo)

	// Query non-existent request ID
	nonExistentID := uuid.New()
	_, err := svc.GetApprovalRequest(ctx, nonExistentID)
	if err == nil {
		t.Fatalf("expected NotFound error for non-existent request, got nil")
	}

	// Attempt decision on non-existent step ID
	reason := "Decision on non-existent step"
	_, err = svc.ProcessApprovalDecision(ctx, nonExistentID, uuid.New(), "SUPER_ADMIN", models.ApprovalDecisionRequest{
		Decision: "APPROVE",
		Reason:   &reason,
	})
	if err == nil {
		t.Fatalf("expected NotFound error for non-existent step, got nil")
	}
}

func TestApprovalWorkflow_Integration_PaginationAndFilters(t *testing.T) {
	db, repo := setupTestDB(t)
	defer db.Pool.Close()

	ctx := context.Background()
	svc := services.NewApprovalService(db, repo)

	requesterID, err := seedTestUser(ctx, db, "page-req")
	if err != nil {
		t.Fatalf("failed to seed requester: %v", err)
	}
	approverID, err := seedTestUser(ctx, db, "page-appr")
	if err != nil {
		t.Fatalf("failed to seed approver: %v", err)
	}

	collegeID, err := createTestCollegeForApproval(ctx, db)
	if err != nil {
		t.Fatalf("failed to create college: %v", err)
	}
	defer func() {
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.audit_logs WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.approval_steps WHERE request_id IN (SELECT request_id FROM platform.approval_requests WHERE college_id = $1)", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.approval_requests WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.colleges WHERE college_id = $1", collegeID)
	}()

	// Create 3 requests
	for i := 0; i < 3; i++ {
		_, err := svc.CreateApprovalRequest(ctx, models.CreateApprovalRequestInput{
			CollegeID:     &collegeID,
			OperationType: "COLLEGE_STATUS_UPDATE",
			Payload:       models.JSONB{"status": "ACTIVE"},
			Steps:         []models.CreateApprovalStepInput{{StepOrder: 1, ApproverID: &approverID}},
		}, requesterID, "SUPER_ADMIN")
		if err != nil {
			t.Fatalf("failed to create request %d: %v", i, err)
		}
	}

	// List with college_id filter and limit=2, offset=0
	list1, meta1, err := svc.ListApprovalRequests(ctx, models.ListApprovalRequestsParams{
		CollegeID: &collegeID,
		Status:    "PENDING",
		Limit:     2,
		Offset:    0,
	})
	if err != nil {
		t.Fatalf("failed to list requests: %v", err)
	}
	if len(list1) != 2 {
		t.Fatalf("expected 2 items, got %d", len(list1))
	}
	if meta1.Total != 3 {
		t.Fatalf("expected total 3, got %d", meta1.Total)
	}

	// Offset=2
	list2, meta2, err := svc.ListApprovalRequests(ctx, models.ListApprovalRequestsParams{
		CollegeID: &collegeID,
		Status:    "PENDING",
		Limit:     2,
		Offset:    2,
	})
	if err != nil {
		t.Fatalf("failed to list requests with offset: %v", err)
	}
	if len(list2) != 1 {
		t.Fatalf("expected 1 item, got %d", len(list2))
	}
	if meta2.Total != 3 {
		t.Fatalf("expected total 3, got %d", meta2.Total)
	}
}

func TestApprovalWorkflow_Integration_OuterTransactionHandling(t *testing.T) {
	db, repo := setupTestDB(t)
	defer db.Pool.Close()

	ctx := context.Background()
	svc := services.NewApprovalService(db, repo)

	requesterID, err := seedTestUser(ctx, db, "outer-req")
	if err != nil {
		t.Fatalf("failed to seed requester: %v", err)
	}
	approverID, err := seedTestUser(ctx, db, "outer-appr")
	if err != nil {
		t.Fatalf("failed to seed approver: %v", err)
	}

	collegeID, err := createTestCollegeForApproval(ctx, db)
	if err != nil {
		t.Fatalf("failed to create college: %v", err)
	}
	defer func() {
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.audit_logs WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.approval_steps WHERE request_id IN (SELECT request_id FROM platform.approval_requests WHERE college_id = $1)", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.approval_requests WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.colleges WHERE college_id = $1", collegeID)
	}()

	// Run inside an explicit outer transaction
	var createdReqID uuid.UUID
	err = db.WithPlatformTransaction(ctx, func(outerCtx context.Context, _ pgx.Tx) error {
		created, err := svc.CreateApprovalRequest(outerCtx, models.CreateApprovalRequestInput{
			CollegeID:     &collegeID,
			OperationType: "COLLEGE_STATUS_UPDATE",
			Payload:       models.JSONB{"status": "ACTIVE"},
			Steps:         []models.CreateApprovalStepInput{{StepOrder: 1, ApproverID: &approverID}},
		}, requesterID, "SUPER_ADMIN")
		if err != nil {
			return err
		}
		createdReqID = created.RequestID

		// Force an intentional error to roll back the outer transaction
		return fmt.Errorf("intentional outer transaction rollback")
	})

	if err == nil {
		t.Fatalf("expected error from outer transaction rollback")
	}

	// Verify request was NOT committed
	_, fetchErr := svc.GetApprovalRequest(ctx, createdReqID)
	if fetchErr == nil {
		t.Fatalf("expected request to not exist after outer transaction rollback")
	}
}

func TestApprovalWorkflow_Integration_CollegeSettingUpdateExecution(t *testing.T) {
	db, repo := setupTestDB(t)
	defer db.Pool.Close()

	ctx := context.Background()
	svc := services.NewApprovalService(db, repo)

	// Seed actors
	requesterID, err := seedTestUser(ctx, db, "requester-setting")
	if err != nil {
		t.Fatalf("failed to seed requester: %v", err)
	}
	approverID, err := seedTestUser(ctx, db, "approver-setting")
	if err != nil {
		t.Fatalf("failed to seed approver: %v", err)
	}

	collegeID, err := createTestCollegeForApproval(ctx, db)
	if err != nil {
		t.Fatalf("failed to create college: %v", err)
	}
	defer func() {
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.audit_logs WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.approval_steps WHERE request_id IN (SELECT request_id FROM platform.approval_requests WHERE college_id = $1)", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.approval_requests WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.college_settings WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.colleges WHERE college_id = $1", collegeID)
	}()

	// Create setting approval request
	settingKey := "maintenance_auto_dispatch"
	settingVal := `{"enabled": true, "threshold_minutes": 15}`
	reqInput := models.CreateApprovalRequestInput{
		CollegeID:     &collegeID,
		OperationType: "COLLEGE_SETTING_UPDATE",
		Payload: models.JSONB{
			"setting_key":   settingKey,
			"setting_value": settingVal,
		},
		Steps: []models.CreateApprovalStepInput{
			{StepOrder: 1, ApproverID: &approverID},
		},
	}

	createdReq, err := svc.CreateApprovalRequest(ctx, reqInput, requesterID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to create approval request: %v", err)
	}

	// Approver approves and triggers execution
	reason := "Approved setting change"
	decReq := models.ApprovalDecisionRequest{
		Decision: "APPROVE",
		Reason:   &reason,
	}
	finalReq, err := svc.ProcessApprovalDecision(ctx, createdReq.Steps[0].ApprovalStepID, approverID, "SUPER_ADMIN", decReq)
	if err != nil {
		t.Fatalf("failed to approve step: %v", err)
	}

	if finalReq.Status != "APPROVED" && finalReq.Status != "EXECUTED" {
		t.Fatalf("expected status APPROVED or EXECUTED, got %s", finalReq.Status)
	}

	// Verify setting was inserted in platform.college_settings
	var valStr string
	err = db.Pool.QueryRow(ctx, "SELECT setting_value::text FROM platform.college_settings WHERE college_id = $1 AND setting_key = $2", collegeID, settingKey).Scan(&valStr)
	if err != nil {
		t.Fatalf("failed to query college setting after execution: %v", err)
	}

	if !strings.Contains(valStr, "threshold_minutes") {
		t.Fatalf("expected setting value to contain threshold_minutes, got: %s", valStr)
	}
}
