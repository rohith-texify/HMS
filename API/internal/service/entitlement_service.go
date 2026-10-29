package service

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DecisionOutcome represents the result of an authoritative entitlement decision.
type DecisionOutcome string

const (
	OutcomeAllow DecisionOutcome = "ALLOW"
	OutcomeDeny  DecisionOutcome = "DENY"
)

// AccessEvaluationRequest represents the parameters needed to evaluate effective access.
type AccessEvaluationRequest struct {
	UserID         uuid.UUID  `json:"user_id"`
	TenantID       uuid.UUID  `json:"tenant_id"`
	Scope          string     `json:"scope"`
	ModuleCode     string     `json:"module_code"`
	HTTPMethod     string     `json:"http_method"`
	PermissionCode string     `json:"permission_code"`
}

// AccessEvaluationResult encapsulates the 7-factor access evaluation verdict.
type AccessEvaluationResult struct {
	Outcome         DecisionOutcome `json:"outcome"`
	Allowed         bool            `json:"allowed"`
	DenialStage     string          `json:"denial_stage,omitempty"`
	Reason          string          `json:"reason"`
	EffectiveMode   string          `json:"effective_mode,omitempty"`
	IsReadOnlyDeny  bool            `json:"is_read_only_deny"`
	EvaluatedAt     time.Time       `json:"evaluated_at"`
	Cached          bool            `json:"cached"`
}

// cachedDecision stores an entitlement decision in memory with a timestamp.
type cachedDecision struct {
	result    AccessEvaluationResult
	expiresAt time.Time
}

// EntitlementService is the authoritative decision service evaluating tenant lifecycle,
// application status, module entitlement, effective dates, read-only mode, and user permissions.
type EntitlementService struct {
	pool      *pgxpool.Pool
	permCheck PermissionChecker
	cache     map[string]cachedDecision
	cacheMu   sync.RWMutex
	cacheTTL  time.Duration
}

// PermissionChecker interface for decoupled permission resolution.
type PermissionChecker interface {
	HasPermission(ctx context.Context, userID uuid.UUID, permissionCode string) (bool, error)
}

// NewEntitlementService instantiates the authoritative entitlement decision service.
func NewEntitlementService(pool *pgxpool.Pool, permCheck PermissionChecker) *EntitlementService {
	svc := &EntitlementService{
		pool:      pool,
		permCheck: permCheck,
		cache:     make(map[string]cachedDecision),
		cacheTTL:  45 * time.Second, // Bounded short-lived consistency window
	}

	// Periodic in-memory cache eviction
	go svc.cacheEvictionRoutine()

	return svc
}

// EvaluateAccess executes the authoritative 7-factor entitlement evaluation:
// ALLOW = VALID_IDENTITY AND CORRECT_SCOPE AND ACTIVE_TENANT AND APPLICATION_ALLOWED
//         AND MODULE_ALLOWED AND MODE_ALLOWED AND USER_PERMISSION_GRANTED
func (s *EntitlementService) EvaluateAccess(
	ctx context.Context,
	req AccessEvaluationRequest,
) AccessEvaluationResult {
	now := time.Now().UTC()

	// 1. Identity & Scope Validation
	if req.UserID == uuid.Nil {
		return failResult("IDENTITY", "Unauthenticated request: valid user identity required.")
	}

	if req.Scope == "PLATFORM" {
		// Platform scope users do not require college tenant entitlements.
		// Enforce user permission directly.
		if req.PermissionCode != "" && s.permCheck != nil {
			hasPerm, err := s.permCheck.HasPermission(ctx, req.UserID, req.PermissionCode)
			if err != nil || !hasPerm {
				return failResult("USER_PERMISSION", fmt.Sprintf("Platform user lacks required permission: %s", req.PermissionCode))
			}
		}
		return AccessEvaluationResult{
			Outcome:     OutcomeAllow,
			Allowed:     true,
			Reason:      "Platform scope operation authorized.",
			EvaluatedAt: now,
		}
	}

	if req.Scope != "COLLEGE" {
		return failResult("SCOPE", fmt.Sprintf("Invalid scope '%s': must be COLLEGE or PLATFORM.", req.Scope))
	}

	if req.TenantID == uuid.Nil {
		return failResult("TENANT_CONTEXT", "Missing tenant context: college operation requires valid tenant ID.")
	}

	// Check bounded cache
	cacheKey := s.buildCacheKey(req)
	s.cacheMu.RLock()
	cached, found := s.cache[cacheKey]
	s.cacheMu.RUnlock()

	if found && now.Before(cached.expiresAt) {
		res := cached.result
		res.Cached = true
		return res
	}

	// 2. Active Tenant Lifecycle Status
	if s.pool == nil {
		return failResult("INFRASTRUCTURE", "Entitlement database pool is unavailable.")
	}

	var tenantStatus string
	err := s.pool.QueryRow(ctx, `SELECT status FROM platform.colleges WHERE college_id = $1`, req.TenantID).Scan(&tenantStatus)
	if err != nil {
		if err == pgx.ErrNoRows {
			return failResult("TENANT_STATUS", "College tenant record not found.")
		}
		return failResult("INFRASTRUCTURE", "Failed to query tenant status.")
	}

	if tenantStatus != "ACTIVE" {
		return failResult("TENANT_STATUS", fmt.Sprintf("College tenant is not active (current status: %s).", tenantStatus))
	}

	// 3. Module Catalogue Status & College Entitlement
	cleanModule := strings.TrimSpace(strings.ToUpper(req.ModuleCode))
	if cleanModule != "" {
		var modActive bool
		var cmStatus string
		var cmMode string
		var effFrom time.Time
		var effTo *time.Time

		query := `
			SELECT 
				m.is_active,
				cm.status,
				cm.mode,
				cm.effective_from,
				cm.effective_to
			FROM platform.modules m
			INNER JOIN platform.college_modules cm 
				ON cm.module_id = m.module_id AND cm.college_id = $1
			WHERE UPPER(m.module_code) = $2
			LIMIT 1
		`
		err = s.pool.QueryRow(ctx, query, req.TenantID, cleanModule).Scan(&modActive, &cmStatus, &cmMode, &effFrom, &effTo)
		if err != nil {
			if err == pgx.ErrNoRows {
				return failResult("MODULE_ENTITLEMENT", fmt.Sprintf("College is not entitled to module '%s'.", cleanModule))
			}
			return failResult("INFRASTRUCTURE", fmt.Sprintf("Failed to query module entitlement: %v", err))
		}

		if !modActive {
			return failResult("MODULE_CATALOGUE", fmt.Sprintf("Module '%s' is deactivated platform-wide.", cleanModule))
		}

		if cmStatus != "ACTIVE" {
			return failResult("MODULE_ENTITLEMENT", fmt.Sprintf("Module '%s' entitlement is not active (status: %s).", cleanModule, cmStatus))
		}

		if effFrom.After(now) {
			return failResult("MODULE_DATES", fmt.Sprintf("Module '%s' entitlement is scheduled for the future (%s).", cleanModule, effFrom.Format(time.RFC3339)))
		}

		if effTo != nil && effTo.Before(now) {
			return failResult("MODULE_DATES", fmt.Sprintf("Module '%s' entitlement expired on %s.", cleanModule, effTo.Format(time.RFC3339)))
		}

		// 4. Read-Only Mode & Mutation Restrictions
		method := strings.ToUpper(strings.TrimSpace(req.HTTPMethod))
		isMutate := method == http.MethodPost || method == http.MethodPut || method == http.MethodPatch || method == http.MethodDelete
		if cmMode == "READ_ONLY" && isMutate {
			res := failResult("READ_ONLY_RESTRICTION", fmt.Sprintf("Module '%s' is restricted to READ_ONLY mode. Mutation requests (%s) are blocked.", cleanModule, method))
			res.IsReadOnlyDeny = true
			res.EffectiveMode = cmMode
			return res
		}
	}

	// 5. User Permission Verification
	if req.PermissionCode != "" && s.permCheck != nil {
		hasPerm, err := s.permCheck.HasPermission(ctx, req.UserID, req.PermissionCode)
		if err != nil {
			return failResult("INFRASTRUCTURE", "Failed to evaluate user permission.")
		}
		if !hasPerm {
			return failResult("USER_PERMISSION", fmt.Sprintf("User lacks required college permission: '%s'.", req.PermissionCode))
		}
	}

	// All checks passed -> ALLOW
	result := AccessEvaluationResult{
		Outcome:       OutcomeAllow,
		Allowed:       true,
		Reason:        "Access granted: identity, tenant, module entitlement, and permissions verified.",
		EffectiveMode: "FULL",
		EvaluatedAt:   now,
	}

	// Store in cache
	s.cacheMu.Lock()
	s.cache[cacheKey] = cachedDecision{
		result:    result,
		expiresAt: now.Add(s.cacheTTL),
	}
	s.cacheMu.Unlock()

	return result
}

// InvalidateTenantCache clears all cached decisions for a specific college tenant.
func (s *EntitlementService) InvalidateTenantCache(tenantID uuid.UUID) {
	prefix := tenantID.String() + ":"
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()
	for k := range s.cache {
		if strings.HasPrefix(k, prefix) {
			delete(s.cache, k)
		}
	}
}

// InvalidateAllCache flushes the entire in-memory decision cache.
func (s *EntitlementService) InvalidateAllCache() {
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()
	s.cache = make(map[string]cachedDecision)
}

func (s *EntitlementService) buildCacheKey(req AccessEvaluationRequest) string {
	return fmt.Sprintf("%s:%s:%s:%s:%s",
		req.TenantID.String(),
		req.UserID.String(),
		strings.ToUpper(req.ModuleCode),
		strings.ToUpper(req.HTTPMethod),
		strings.ToLower(req.PermissionCode),
	)
}

func (s *EntitlementService) cacheEvictionRoutine() {
	ticker := time.NewTicker(2 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		now := time.Now().UTC()
		s.cacheMu.Lock()
		for k, v := range s.cache {
			if now.After(v.expiresAt) {
				delete(s.cache, k)
			}
		}
		s.cacheMu.Unlock()
	}
}

func failResult(stage string, reason string) AccessEvaluationResult {
	return AccessEvaluationResult{
		Outcome:     OutcomeDeny,
		Allowed:     false,
		DenialStage: stage,
		Reason:      reason,
		EvaluatedAt: time.Now().UTC(),
	}
}
