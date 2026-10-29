package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/database"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
)

// SupportService handles diagnostic operations: support grants, entitlement diagnosis, and privacy-masked lookups.
type SupportService struct {
	db   *database.Database
	repo *repository.Repository
}

// NewSupportService creates a new SupportService.
func NewSupportService(db *database.Database, repo *repository.Repository) *SupportService {
	return &SupportService{
		db:   db,
		repo: repo,
	}
}

// ListSupportGrants retrieves support access grants with tenant and active state filtering.
func (s *SupportService) ListSupportGrants(
	ctx context.Context,
	collegeID *uuid.UUID,
	activeOnly bool,
) ([]models.SupportGrant, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Support service is not configured")
	}

	query := `
		SELECT 
			g.grant_id, g.grantee_id, COALESCE(u1.email, 'Support Staff') as grantee_email,
			g.college_id, c.college_code, c.name as college_name,
			COALESCE(g.scope, '{}'::jsonb), g.reason, g.ticket_ref,
			g.approved_by, COALESCE(u2.email, 'Admin') as approved_by_name,
			g.starts_at, g.expires_at, g.revoked_at, g.created_at, g.updated_at
		FROM platform.support_access_grants g
		JOIN platform.colleges c ON g.college_id = c.college_id
		LEFT JOIN app.users u1 ON g.grantee_id = u1.user_id
		LEFT JOIN app.users u2 ON g.approved_by = u2.user_id
		WHERE 1=1
	`
	args := []interface{}{}
	argIdx := 1

	if collegeID != nil && *collegeID != uuid.Nil {
		query += fmt.Sprintf(` AND g.college_id = $%d`, argIdx)
		args = append(args, *collegeID)
		argIdx++
	}

	if activeOnly {
		query += ` AND g.revoked_at IS NULL AND g.expires_at > NOW()`
	}

	query += ` ORDER BY g.created_at DESC LIMIT 50`

	rows, err := s.db.GetPlatformPool().Query(ctx, query, args...)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to list support grants: %v", err))
	}
	defer rows.Close()

	grants := make([]models.SupportGrant, 0)
	now := time.Now().UTC()
	for rows.Next() {
		var g models.SupportGrant
		var scopeBytes []byte
		if err := rows.Scan(
			&g.GrantID,
			&g.GranteeID,
			&g.GranteeEmail,
			&g.CollegeID,
			&g.CollegeCode,
			&g.CollegeName,
			&scopeBytes,
			&g.Reason,
			&g.TicketRef,
			&g.ApprovedBy,
			&g.ApprovedByName,
			&g.StartsAt,
			&g.ExpiresAt,
			&g.RevokedAt,
			&g.CreatedAt,
			&g.UpdatedAt,
		); err == nil {
			if len(scopeBytes) > 0 {
				_ = json.Unmarshal(scopeBytes, &g.Scope)
			}
			g.IsActive = g.RevokedAt == nil && g.ExpiresAt.After(now)
			grants = append(grants, g)
		}
	}

	return grants, nil
}

// CreateSupportGrant issues a time-boxed, ticketed support grant to an authorized support actor.
func (s *SupportService) CreateSupportGrant(
	ctx context.Context,
	req models.CreateSupportGrantRequest,
	actorUserID uuid.UUID,
	actorRole string,
) (*models.SupportGrant, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "Support service is not configured")
	}

	req.Reason = strings.TrimSpace(req.Reason)
	req.TicketRef = strings.TrimSpace(req.TicketRef)
	if req.Reason == "" || req.TicketRef == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Reason and ticket reference are required")
	}

	if req.DurationMinutes <= 0 || req.DurationMinutes > 480 { // Max 8 hours
		return nil, apierrors.New(apierrors.ValidationError, "Duration must be between 1 and 480 minutes")
	}

	// Verify target college exists
	_, err := s.repo.GetCollegeByID(ctx, req.CollegeID)
	if err != nil {
		return nil, apierrors.New(apierrors.NotFound, "Target college not found")
	}

	now := time.Now().UTC()
	expiresAt := now.Add(time.Duration(req.DurationMinutes) * time.Minute)
	grantID := uuid.New()
	scopeBytes, _ := json.Marshal(req.Scope)

	var grant models.SupportGrant
	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		_, err := s.repo.Executor(txCtx).Exec(txCtx, `
			INSERT INTO platform.support_access_grants (
				grant_id, grantee_id, college_id, scope, reason, ticket_ref,
				approved_by, starts_at, expires_at, created_at, updated_at
			) VALUES (
				$1, $2, $3, $4, $5, $6,
				$7, $8, $9, $8, $8
			)
		`, grantID, req.GranteeID, req.CollegeID, scopeBytes, req.Reason, req.TicketRef, actorUserID, now, expiresAt)
		if err != nil {
			return fmt.Errorf("insert support grant: %w", err)
		}

		grant = models.SupportGrant{
			GrantID:     grantID,
			GranteeID:   req.GranteeID,
			CollegeID:   req.CollegeID,
			Scope:       req.Scope,
			Reason:      req.Reason,
			TicketRef:   req.TicketRef,
			ApprovedBy:  actorUserID,
			StartsAt:    now,
			ExpiresAt:   expiresAt,
			CreatedAt:   now,
			UpdatedAt:   now,
			IsActive:    true,
		}

		// Record immutable audit entry
		return s.repo.RecordApprovalAudit(txCtx, models.ApprovalAuditParams{
			CollegeID:   &req.CollegeID,
			ActorUserID: actorUserID,
			ActorRole:   actorRole,
			Module:      "platform_support",
			Action:      "SUPPORT_GRANT_CREATED",
			EntityType:  "SUPPORT_GRANT",
			EntityID:    grantID,
			Reason:      &req.Reason,
			NewData: models.JSONB{
				"grantee_id": req.GranteeID.String(),
				"ticket_ref": req.TicketRef,
				"duration":   req.DurationMinutes,
			},
			Severity: "HIGH",
		})
	})

	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to issue support grant: %v", err))
	}

	return &grant, nil
}

// RevokeSupportGrant prematurely terminates an active support grant.
func (s *SupportService) RevokeSupportGrant(
	ctx context.Context,
	grantID uuid.UUID,
	actorUserID uuid.UUID,
	actorRole string,
	reason string,
) error {
	if s == nil || s.repo == nil || s.db == nil {
		return apierrors.New(apierrors.InternalError, "Support service is not configured")
	}

	err := s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var collegeID uuid.UUID
		var revokedAt *time.Time
		err := s.repo.Executor(txCtx).QueryRow(txCtx, `
			SELECT college_id, revoked_at FROM platform.support_access_grants WHERE grant_id = $1 FOR UPDATE
		`, grantID).Scan(&collegeID, &revokedAt)
		if err != nil {
			if err == pgx.ErrNoRows {
				return apierrors.New(apierrors.NotFound, "Support grant not found")
			}
			return fmt.Errorf("query support grant: %w", err)
		}

		if revokedAt != nil {
			return apierrors.New(apierrors.Conflict, "Support grant is already revoked")
		}

		now := time.Now().UTC()
		_, err = s.repo.Executor(txCtx).Exec(txCtx, `
			UPDATE platform.support_access_grants
			SET revoked_at = $1, updated_at = $1
			WHERE grant_id = $2
		`, now, grantID)
		if err != nil {
			return fmt.Errorf("revoke grant: %w", err)
		}

		return s.repo.RecordApprovalAudit(txCtx, models.ApprovalAuditParams{
			CollegeID:   &collegeID,
			ActorUserID: actorUserID,
			ActorRole:   actorRole,
			Module:      "platform_support",
			Action:      "SUPPORT_GRANT_REVOKED",
			EntityType:  "SUPPORT_GRANT",
			EntityID:    grantID,
			Reason:      &reason,
			Severity:    "HIGH",
		})
	})

	if err != nil {
		if apiErr, ok := err.(*apierrors.APIError); ok {
			return apiErr
		}
		return apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to revoke grant: %v", err))
	}

	return nil
}

// DiagnoseEntitlement evaluates why a specific module is granted or denied for a college.
func (s *SupportService) DiagnoseEntitlement(
	ctx context.Context,
	collegeID uuid.UUID,
	moduleCode string,
) (*models.EntitlementDiagnosticReport, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Support service is not configured")
	}

	college, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		return nil, apierrors.New(apierrors.NotFound, "College not found")
	}

	normCode := strings.ToUpper(strings.TrimSpace(moduleCode))
	report := &models.EntitlementDiagnosticReport{
		CollegeID:     collegeID,
		CollegeCode:   college.CollegeCode,
		CollegeStatus: college.Status,
		ModuleCode:    normCode,
		EvaluatedAt:   time.Now().UTC(),
		Blockers:      make([]string, 0),
	}

	// 1. Check if module exists in catalog
	var modID uuid.UUID
	var isCatalogActive bool
	err = s.db.GetPlatformPool().QueryRow(ctx, `
		SELECT module_id, is_active FROM platform.modules WHERE UPPER(code) = $1
	`, normCode).Scan(&modID, &isCatalogActive)
	if err != nil {
		report.ModuleFound = false
		report.IsAccessPermitted = false
		report.EvaluationVerdict = "DENIED: Module code does not exist in platform catalog"
		report.Blockers = append(report.Blockers, "Module code not recognized")
		return report, nil
	}

	report.ModuleFound = true
	report.ModuleActiveInCatalog = isCatalogActive
	if !isCatalogActive {
		report.Blockers = append(report.Blockers, "Module is globally disabled in platform catalog")
	}

	// 2. Check college lifecycle
	if college.Status != "ACTIVE" {
		report.Blockers = append(report.Blockers, fmt.Sprintf("College is not ACTIVE (current status: %s)", college.Status))
	}

	// 3. Check college_modules row
	var cmStatus string
	var cmMode string
	err = s.db.GetPlatformPool().QueryRow(ctx, `
		SELECT status, mode FROM platform.college_modules WHERE college_id = $1 AND module_id = $2
	`, collegeID, modID).Scan(&cmStatus, &cmMode)
	if err != nil {
		report.IsEntitled = false
		report.EntitlementStatus = "NOT_ASSIGNED"
		report.Blockers = append(report.Blockers, "Module has not been entitled or assigned to this college")
	} else {
		report.IsEntitled = true
		report.EntitlementStatus = cmStatus
		report.EntitlementMode = cmMode
		if cmStatus != "ACTIVE" {
			report.Blockers = append(report.Blockers, fmt.Sprintf("College module status is %s", cmStatus))
		}
	}

	if len(report.Blockers) == 0 {
		report.IsAccessPermitted = true
		report.EvaluationVerdict = "PERMITTED: College is active, module is globally enabled, and tenant entitlement is ACTIVE"
	} else {
		report.IsAccessPermitted = false
		report.EvaluationVerdict = fmt.Sprintf("DENIED: %s", strings.Join(report.Blockers, "; "))
	}

	return report, nil
}

// MaskedStudentLookup retrieves a minimally scoped, privacy-redacted student status record.
func (s *SupportService) MaskedStudentLookup(
	ctx context.Context,
	collegeID uuid.UUID,
	admissionNumber string,
	actorUserID uuid.UUID,
	actorRole string,
	reason string,
) (*models.MaskedStudentLookupResult, error) {
	if s == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "Support service is not configured")
	}

	cleanAdm := strings.TrimSpace(admissionNumber)
	if cleanAdm == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Admission number is required")
	}
	if reason == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Troubleshooting reason is required for audit")
	}

	var res models.MaskedStudentLookupResult
	var firstName, lastName string
	var email string
	var collegeCode string

	query := `
		SELECT 
			s.id, s.college_id, c.college_code, s.admission_number,
			s.first_name, COALESCE(s.last_name, ''), COALESCE(s.email, ''),
			s.student_status, s.hostel_status
		FROM app.students s
		JOIN platform.colleges c ON s.college_id = c.college_id
		WHERE s.college_id = $1 AND UPPER(s.admission_number) = UPPER($2)
	`
	err := s.db.GetPlatformPool().QueryRow(ctx, query, collegeID, cleanAdm).Scan(
		&res.StudentID,
		&res.CollegeID,
		&collegeCode,
		&res.AdmissionNumber,
		&firstName,
		&lastName,
		&email,
		&res.StudentStatus,
		&res.HostelStatus,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, apierrors.New(apierrors.NotFound, "No student found matching this admission number in target college")
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to query student: %v", err))
	}

	res.CollegeCode = collegeCode
	// Apply Privacy Masking: First char + asterisks
	res.MaskedName = maskString(firstName) + " " + maskString(lastName)
	res.MaskedEmail = maskEmail(email)
	res.LookupAudited = true

	// Audit student lookup for privacy compliance
	go func() {
		bgCtx := context.Background()
		_ = s.repo.RecordApprovalAudit(bgCtx, models.ApprovalAuditParams{
			CollegeID:   &collegeID,
			ActorUserID: actorUserID,
			ActorRole:   actorRole,
			Module:      "platform_support",
			Action:      "MASKED_STUDENT_LOOKUP",
			EntityType:  "STUDENT",
			EntityID:    res.StudentID,
			Reason:      &reason,
			NewData: models.JSONB{
				"admission_number": cleanAdm,
				"student_status":   res.StudentStatus,
			},
			Severity: "INFO",
		})
	}()

	return &res, nil
}

func maskString(s string) string {
	s = strings.TrimSpace(s)
	if len(s) == 0 {
		return ""
	}
	if len(s) == 1 {
		return "*"
	}
	return string(s[0]) + strings.Repeat("*", len(s)-1)
}

func maskEmail(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return "***@***.***"
	}
	user := parts[0]
	domain := parts[1]
	maskedUser := maskString(user)
	return maskedUser + "@" + domain
}
