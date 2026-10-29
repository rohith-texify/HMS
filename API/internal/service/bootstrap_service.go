package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// CollegeBootstrapConfig represents the safe, authenticated configuration payload
// returned to a tenant application at startup.
type CollegeBootstrapConfig struct {
	Tenant         TenantMetadata           `json:"tenant"`
	EnabledModules []BootstrapModule        `json:"enabled_modules"`
	Settings       map[string]interface{}   `json:"settings"`
	Metadata       BootstrapMetadata        `json:"metadata"`
}

type TenantMetadata struct {
	CollegeID   uuid.UUID `json:"college_id"`
	CollegeCode string    `json:"college_code"`
	Name        string    `json:"name"`
	Status      string    `json:"status"`
	Timezone    string    `json:"timezone"`
}

type BootstrapModule struct {
	ModuleCode    string     `json:"module_code"`
	ModuleName    string     `json:"module_name"`
	Kind          string     `json:"kind"`
	Mode          string     `json:"mode"`
	Status        string     `json:"status"`
	EffectiveFrom time.Time  `json:"effective_from"`
	EffectiveTo   *time.Time `json:"effective_to,omitempty"`
}

type BootstrapMetadata struct {
	EvaluatedAt     time.Time `json:"evaluated_at"`
	CacheTTLSeconds int       `json:"cache_ttl_seconds"`
}

// BootstrapService aggregates authorized, non-sensitive configuration for an active tenant.
type BootstrapService struct {
	pool *pgxpool.Pool
}

// NewBootstrapService creates a new BootstrapService instance.
func NewBootstrapService(pool *pgxpool.Pool) *BootstrapService {
	return &BootstrapService{
		pool: pool,
	}
}

// GetCollegeBootstrapConfig retrieves the authorized, non-sensitive tenant bootstrap configuration.
// It derives access strictly from server-side validated tenant identity.
func (s *BootstrapService) GetCollegeBootstrapConfig(
	ctx context.Context,
	tenantID uuid.UUID,
) (*CollegeBootstrapConfig, error) {
	if s == nil || s.pool == nil {
		return nil, fmt.Errorf("bootstrap service pool is not configured")
	}
	if tenantID == uuid.Nil {
		return nil, fmt.Errorf("invalid tenant context")
	}

	now := time.Now().UTC()

	// 1. Fetch Tenant Metadata
	tenantQuery := `
		SELECT college_id, college_code, name, status, COALESCE(timezone, 'UTC')
		FROM platform.colleges
		WHERE college_id = $1
	`
	var tMeta TenantMetadata
	err := s.pool.QueryRow(ctx, tenantQuery, tenantID).Scan(
		&tMeta.CollegeID,
		&tMeta.CollegeCode,
		&tMeta.Name,
		&tMeta.Status,
		&tMeta.Timezone,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load tenant metadata: %w", err)
	}

	// 2. Fetch Enabled Modules & Modes
	modulesQuery := `
		SELECT 
			m.code,
			m.name,
			m.kind,
			cm.mode,
			cm.status,
			cm.effective_from,
			cm.effective_to
		FROM platform.college_modules cm
		JOIN platform.modules m ON cm.module_id = m.module_id
		WHERE cm.college_id = $1
		  AND cm.status = 'ACTIVE'
		  AND (cm.effective_from <= $2)
		  AND (cm.effective_to IS NULL OR cm.effective_to > $2)
		ORDER BY m.code ASC
	`
	rows, err := s.pool.Query(ctx, modulesQuery, tenantID, now)
	if err != nil {
		return nil, fmt.Errorf("failed to load college modules: %w", err)
	}
	defer rows.Close()

	modules := make([]BootstrapModule, 0)
	for rows.Next() {
		var mod BootstrapModule
		if err := rows.Scan(
			&mod.ModuleCode,
			&mod.ModuleName,
			&mod.Kind,
			&mod.Mode,
			&mod.Status,
			&mod.EffectiveFrom,
			&mod.EffectiveTo,
		); err != nil {
			return nil, fmt.Errorf("failed to scan module row: %w", err)
		}
		modules = append(modules, mod)
	}

	// 3. Fetch Non-Sensitive College Settings
	// SECURITY: Strict filter ensures is_sensitive = false and setting_key does not leak secrets.
	settingsQuery := `
		SELECT setting_key, setting_value
		FROM platform.college_settings
		WHERE college_id = $1
		  AND is_sensitive = false
	`
	sRows, err := s.pool.Query(ctx, settingsQuery, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to load college settings: %w", err)
	}
	defer sRows.Close()

	safeSettings := make(map[string]interface{})
	for sRows.Next() {
		var key string
		var val interface{}
		if err := sRows.Scan(&key, &val); err != nil {
			return nil, fmt.Errorf("failed to scan setting row: %w", err)
		}
		// Redundant defense-in-depth secret key filtering
		lowerKey := strings.ToLower(key)
		if strings.Contains(lowerKey, "password") ||
			strings.Contains(lowerKey, "secret") ||
			strings.Contains(lowerKey, "token") ||
			strings.Contains(lowerKey, "key") {
			continue
		}
		safeSettings[key] = val
	}

	return &CollegeBootstrapConfig{
		Tenant:         tMeta,
		EnabledModules: modules,
		Settings:       safeSettings,
		Metadata: BootstrapMetadata{
			EvaluatedAt:     now,
			CacheTTLSeconds: 45,
		},
	}, nil
}
