package middleware

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type cachedEntitlement struct {
	entitled  bool
	mode      string
	expiresAt time.Time
}

type ModuleEntitlementMiddleware struct {
	pool     *pgxpool.Pool
	cache    map[string]cachedEntitlement
	cacheMu  sync.RWMutex
	cacheTTL time.Duration
}

func NewModuleEntitlementMiddleware(pool *pgxpool.Pool) *ModuleEntitlementMiddleware {
	m := &ModuleEntitlementMiddleware{
		pool:     pool,
		cache:    make(map[string]cachedEntitlement),
		cacheTTL: 45 * time.Second, // 45-second bounded consistency window
	}

	go m.cacheEvictionRoutine()
	return m
}

// InvalidateTenant clears cached module entitlements for a specific tenant.
func (m *ModuleEntitlementMiddleware) InvalidateTenant(tenantID uuid.UUID) {
	prefix := tenantID.String() + ":"
	m.cacheMu.Lock()
	defer m.cacheMu.Unlock()
	for k := range m.cache {
		if strings.HasPrefix(k, prefix) {
			delete(m.cache, k)
		}
	}
}

func (m *ModuleEntitlementMiddleware) cacheEvictionRoutine() {
	ticker := time.NewTicker(2 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		now := time.Now().UTC()
		m.cacheMu.Lock()
		for k, v := range m.cache {
			if now.After(v.expiresAt) {
				delete(m.cache, k)
			}
		}
		m.cacheMu.Unlock()
	}
}

// RequireModule verifies that the authenticated tenant is entitled
// to use the requested application module.
//
// The tenant ID comes from the verified JWT tenant context.
// It must never come from the request body, query string, or headers.
func (m *ModuleEntitlementMiddleware) RequireModule(
	moduleCode string,
) gin.HandlerFunc {
	return func(c *gin.Context) {
		if moduleCode == "" {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "MODULE_CONFIGURATION_ERROR",
					"message": "module code is required",
				},
			})
			return
		}

		tenantValue, exists := c.Get(TenantIDContextKey)
		if !exists || tenantValue == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "TENANT_CONTEXT_REQUIRED",
					"message": "tenant context is required",
				},
			})
			return
		}

		tenantID, ok := tenantValue.(uuid.UUID)
		if !ok || tenantID == uuid.Nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "INVALID_TENANT_CONTEXT",
					"message": "invalid tenant context",
				},
			})
			return
		}

		entitled, mode, err := m.checkModuleEntitlement(
			c,
			tenantID,
			moduleCode,
		)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "MODULE_ENTITLEMENT_CHECK_FAILED",
					"message": "failed to verify module entitlement",
				},
			})
			return
		}

		if !entitled {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "MODULE_NOT_ENTITLED",
					"message": "college is not entitled to this module",
					"module":  moduleCode,
				},
			})
			return
		}

		// Enforce Read-Only mode restriction:
		// If module is configured as READ_ONLY, mutate HTTP methods (POST, PUT, PATCH, DELETE) are blocked
		method := c.Request.Method
		if mode == "READ_ONLY" && (method == http.MethodPost || method == http.MethodPut || method == http.MethodPatch || method == http.MethodDelete) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "MODULE_READ_ONLY",
					"message": "college is entitled to read-only access for this module; edit actions are prohibited",
					"module":  moduleCode,
				},
			})
			return
		}

		c.Set("module_code", moduleCode)
		c.Set("module_mode", mode)
		c.Next()
	}
}

func (m *ModuleEntitlementMiddleware) checkModuleEntitlement(
	c *gin.Context,
	tenantID uuid.UUID,
	moduleCode string,
) (bool, string, error) {
	if m.pool == nil {
		return false, "", fmt.Errorf("database pool is nil")
	}

	cacheKey := tenantID.String() + ":" + strings.ToUpper(strings.TrimSpace(moduleCode))
	now := time.Now().UTC()

	m.cacheMu.RLock()
	cached, found := m.cache[cacheKey]
	m.cacheMu.RUnlock()

	if found && now.Before(cached.expiresAt) {
		return cached.entitled, cached.mode, nil
	}

	var mode string

	err := m.pool.QueryRow(
		c.Request.Context(),
		`
		SELECT cm.mode
		FROM platform.college_modules cm
		INNER JOIN platform.modules m
			ON m.module_id = cm.module_id
		WHERE cm.college_id = $1
		  AND UPPER(m.module_code) = UPPER($2)
		  AND m.is_active = TRUE
		  AND cm.status = 'ACTIVE'
		  AND (
				cm.effective_from IS NULL
				OR cm.effective_from <= NOW()
		  )
		  AND (
				cm.effective_to IS NULL
				OR cm.effective_to > NOW()
		  )
		LIMIT 1
		`,
		tenantID,
		moduleCode,
	).Scan(&mode)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			m.cacheMu.Lock()
			m.cache[cacheKey] = cachedEntitlement{
				entitled:  false,
				mode:      "",
				expiresAt: now.Add(m.cacheTTL),
			}
			m.cacheMu.Unlock()
			return false, "", nil
		}
		return false, "", fmt.Errorf("failed to check module entitlement: %w", err)
	}

	m.cacheMu.Lock()
	m.cache[cacheKey] = cachedEntitlement{
		entitled:  true,
		mode:      mode,
		expiresAt: now.Add(m.cacheTTL),
	}
	m.cacheMu.Unlock()

	return true, mode, nil
}
