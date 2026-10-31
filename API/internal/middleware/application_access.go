package middleware

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yourusername/hostel-management-system/API/internal/auth"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

type cachedAppSetting struct {
	status      string
	minVersion  string
	forceUpdate bool
	expiresAt   time.Time
}

// ApplicationAccessMiddleware verifies that an application is active and meets version policy.
type ApplicationAccessMiddleware struct {
	pool     *pgxpool.Pool
	cache    map[string]cachedAppSetting
	cacheMu  sync.RWMutex
	cacheTTL time.Duration
}

// NewApplicationAccessMiddleware creates a new application access middleware.
func NewApplicationAccessMiddleware(pool *pgxpool.Pool) *ApplicationAccessMiddleware {
	return &ApplicationAccessMiddleware{
		pool:     pool,
		cache:    make(map[string]cachedAppSetting),
		cacheTTL: 60 * time.Second,
	}
}

// RequireActiveApplication verifies that the client's role-mapped application is not disabled or suspended,
// and enforces force-update minimum version requirements if enabled.
func (m *ApplicationAccessMiddleware) RequireActiveApplication() gin.HandlerFunc {
	return func(c *gin.Context) {
		if m.pool == nil {
			c.Next()
			return
		}

		claimsValue, exists := c.Get(auth.ContextClaimsKey)
		if !exists || claimsValue == nil {
			c.Next()
			return
		}

		claims, ok := claimsValue.(*auth.Claims)
		if !ok || claims.Scope != auth.ScopeCollege || claims.TenantID == nil || *claims.TenantID == uuid.Nil {
			c.Next()
			return
		}

		appID := models.MapRoleToAppID(claims.Role)
		if appID == "" {
			c.Next()
			return
		}

		cacheKey := claims.TenantID.String() + ":" + appID
		now := time.Now().UTC()

		m.cacheMu.RLock()
		cached, found := m.cache[cacheKey]
		m.cacheMu.RUnlock()

		var status, minVersion string
		var forceUpdate bool

		if found && now.Before(cached.expiresAt) {
			status = cached.status
			minVersion = cached.minVersion
			forceUpdate = cached.forceUpdate
		} else {
			// Look up college setting from platform.college_settings
			var rawValue []byte
			err := m.pool.QueryRow(
				c.Request.Context(),
				`SELECT setting_value FROM platform.college_settings WHERE college_id = $1 AND setting_key = $2`,
				*claims.TenantID,
				"app_config."+appID,
			).Scan(&rawValue)

			if err != nil {
				// No explicit override exists; default configuration is ENABLED with no forced update
				status = "ACTIVE"
			} else {
				var setting struct {
					Status      string `json:"status"`
					MinVersion  string `json:"min_version"`
					ForceUpdate bool   `json:"force_update"`
				}
				if err := json.Unmarshal(rawValue, &setting); err == nil {
					status = setting.Status
					minVersion = setting.MinVersion
					forceUpdate = setting.ForceUpdate
				} else {
					status = "ACTIVE"
				}
			}

			m.cacheMu.Lock()
			m.cache[cacheKey] = cachedAppSetting{
				status:      status,
				minVersion:  minVersion,
				forceUpdate: forceUpdate,
				expiresAt:   now.Add(m.cacheTTL),
			}
			m.cacheMu.Unlock()
		}

		if status == models.AppStatusDisabled {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error": gin.H{
					"code":        "APPLICATION_DISABLED",
					"message":     "This application is currently disabled for your institution.",
					"application": appID,
				},
			})
			return
		}

		if status == models.AppStatusSuspended {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error": gin.H{
					"code":        "APPLICATION_SUSPENDED",
					"message":     "This application has been temporarily suspended by system administration.",
					"application": appID,
				},
			})
			return
		}

		// Enforce force-update if enabled and client provides version
		if forceUpdate && minVersion != "" {
			clientVersion := c.GetHeader("X-App-Version")
			if clientVersion == "" {
				clientVersion = c.GetHeader("App-Version")
			}

			if clientVersion != "" {
				cmp, err := models.CompareSemVer(clientVersion, minVersion)
				if err == nil && cmp < 0 {
					c.AbortWithStatusJSON(http.StatusUpgradeRequired, gin.H{
						"success": false,
						"error": gin.H{
							"code":            "UPGRADE_REQUIRED",
							"message":         "A mandatory update is required to continue using this application.",
							"application":     appID,
							"current_version": clientVersion,
							"min_version":     minVersion,
							"force_update":    true,
						},
					})
					return
				}
			}
		}

		c.Next()
	}
}
