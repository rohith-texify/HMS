package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

// GetTenantAccessHierarchy retrieves the full hierarchical access matrix (App -> Module -> Feature -> Actions)
// with configured states, inherited disabled states, date windows, and effective action evaluations.
func (r *Repository) GetTenantAccessHierarchy(
	ctx context.Context,
	collegeID uuid.UUID,
) (*models.HierarchicalAccessMatrixResponse, error) {
	// 1. Fetch college details
	const collegeSQL = `
		SELECT college_id, college_code, name, status
		FROM platform.colleges
		WHERE college_id = $1
	`
	var resp models.HierarchicalAccessMatrixResponse
	err := r.Executor(ctx).QueryRow(ctx, collegeSQL, collegeID).Scan(
		&resp.CollegeID,
		&resp.CollegeCode,
		&resp.CollegeName,
		&resp.Status,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("query college for access matrix: %w", err)
	}

	// 2. Fetch all platform modules
	const modulesSQL = `
		SELECT
			module_id,
			module_code,
			module_name,
			parent_id,
			kind,
			priority,
			is_core,
			is_active
		FROM platform.modules
		ORDER BY kind ASC, module_name ASC
	`
	modRows, err := r.Executor(ctx).Query(ctx, modulesSQL)
	if err != nil {
		return nil, fmt.Errorf("query modules for access hierarchy: %w", err)
	}
	defer modRows.Close()

	type rawModule struct {
		ModuleID   uuid.UUID
		ModuleCode string
		ModuleName string
		ParentID   *uuid.UUID
		Kind       string
		Priority   string
		IsCore     bool
		IsActive   bool
	}
	modules := make([]rawModule, 0)
	for modRows.Next() {
		var m rawModule
		if err := modRows.Scan(
			&m.ModuleID,
			&m.ModuleCode,
			&m.ModuleName,
			&m.ParentID,
			&m.Kind,
			&m.Priority,
			&m.IsCore,
			&m.IsActive,
		); err != nil {
			return nil, fmt.Errorf("scan module: %w", err)
		}
		modules = append(modules, m)
	}

	// 3. Fetch college module entitlements
	const cmSQL = `
		SELECT
			college_module_id,
			module_id,
			status,
			mode,
			effective_from,
			effective_to,
			reason
		FROM platform.college_modules
		WHERE college_id = $1
	`
	cmRows, err := r.Executor(ctx).Query(ctx, cmSQL, collegeID)
	if err != nil {
		return nil, fmt.Errorf("query college modules: %w", err)
	}
	defer cmRows.Close()

	type cmConfig struct {
		CollegeModuleID uuid.UUID
		Status          string
		Mode            string
		EffectiveFrom   time.Time
		EffectiveTo     *time.Time
		Reason          *string
	}
	entitlements := make(map[uuid.UUID]cmConfig)
	for cmRows.Next() {
		var modID uuid.UUID
		var cfg cmConfig
		if err := cmRows.Scan(
			&cfg.CollegeModuleID,
			&modID,
			&cfg.Status,
			&cfg.Mode,
			&cfg.EffectiveFrom,
			&cfg.EffectiveTo,
			&cfg.Reason,
		); err != nil {
			return nil, fmt.Errorf("scan college module entitlement: %w", err)
		}
		entitlements[modID] = cfg
	}

	// 4. Fetch all permissions grouped by module
	const permSQL = `
		SELECT
			permission_id,
			module_id,
			permission_code,
			description
		FROM platform.permissions
		ORDER BY permission_code ASC
	`
	permRows, err := r.Executor(ctx).Query(ctx, permSQL)
	if err != nil {
		return nil, fmt.Errorf("query permissions: %w", err)
	}
	defer permRows.Close()

	type permItem struct {
		PermissionID   uuid.UUID
		ModuleID       uuid.UUID
		PermissionCode string
		Description    *string
	}
	permsByModule := make(map[uuid.UUID][]permItem)
	for permRows.Next() {
		var p permItem
		if err := permRows.Scan(&p.PermissionID, &p.ModuleID, &p.PermissionCode, &p.Description); err != nil {
			return nil, fmt.Errorf("scan permission: %w", err)
		}
		permsByModule[p.ModuleID] = append(permsByModule[p.ModuleID], p)
	}

	// 5. Build raw access items
	now := time.Now()
	itemsByID := make(map[uuid.UUID]*models.HierarchicalAccessItem, len(modules))
	for _, m := range modules {
		item := &models.HierarchicalAccessItem{
			ModuleID:              m.ModuleID,
			ModuleCode:            m.ModuleCode,
			ModuleName:            m.ModuleName,
			Kind:                  m.Kind,
			ParentID:              m.ParentID,
			Priority:              m.Priority,
			IsCore:                m.IsCore,
			CatalogueActive:       m.IsActive,
			CollegeID:             collegeID,
			ConfiguredStatus:      "NOT_CONFIGURED",
			ConfiguredMode:        "FULL",
			EffectiveStatus:       "DISABLED",
			EffectiveMode:         "FULL",
			InheritedDisabled:     false,
			DependenciesSatisfied: true,
			Actions:               make([]models.ActionEntitlement, 0),
			Children:              make([]models.HierarchicalAccessItem, 0),
		}

		if cfg, has := entitlements[m.ModuleID]; has {
			cmID := cfg.CollegeModuleID
			item.CollegeModuleID = &cmID
			item.ConfiguredStatus = cfg.Status
			item.ConfiguredMode = cfg.Mode
			effFrom := cfg.EffectiveFrom
			item.EffectiveFrom = &effFrom
			item.EffectiveTo = cfg.EffectiveTo
			item.Reason = cfg.Reason

			isWithinDates := (cfg.EffectiveFrom.Before(now) || cfg.EffectiveFrom.Equal(now)) &&
				(cfg.EffectiveTo == nil || cfg.EffectiveTo.After(now))

			if resp.Status == "SUSPENDED" || resp.Status == "DEACTIVATED" || resp.Status == "ARCHIVED" {
				item.EffectiveStatus = "DISABLED"
				item.InheritedDisabled = true
				item.InheritanceSource = fmt.Sprintf("College tenant is %s", resp.Status)
			} else if !m.IsActive {
				item.EffectiveStatus = "DISABLED"
				item.InheritanceSource = "Module is inactive in platform catalogue"
			} else if cfg.Status == "ACTIVE" && isWithinDates {
				item.EffectiveStatus = "ACTIVE"
				item.EffectiveMode = cfg.Mode
			} else if cfg.Status == "SCHEDULED" {
				item.EffectiveStatus = "SCHEDULED"
			} else {
				item.EffectiveStatus = "DISABLED"
			}
		}

		itemsByID[m.ModuleID] = item
	}

	// Populate parent codes & names
	for _, item := range itemsByID {
		if item.ParentID != nil {
			if parent, exists := itemsByID[*item.ParentID]; exists {
				item.ParentCode = parent.ModuleCode
				item.ParentName = parent.ModuleName
			}
		}
	}

	// 6. Resolve Hierarchical Inheritance (Parent APP -> Child MODULE -> Child FEATURE)
	// If a parent is disabled or not active, child must inherit disabled state!
	for _, item := range itemsByID {
		curr := item
		for curr.ParentID != nil {
			parent, exists := itemsByID[*curr.ParentID]
			if !exists {
				break
			}
			if parent.EffectiveStatus != "ACTIVE" {
				item.EffectiveStatus = "DISABLED"
				item.InheritedDisabled = true
				item.DependenciesSatisfied = false
				item.InheritanceSource = fmt.Sprintf("Inherited disabled state from %s '%s'", parent.Kind, parent.ModuleName)
				item.MissingDependencies = append(item.MissingDependencies, parent.ModuleName)
			}
			if parent.EffectiveMode == "READ_ONLY" {
				item.EffectiveMode = "READ_ONLY"
			}
			curr = parent
		}
	}

	// 7. Generate granular action entitlements for each item
	for _, item := range itemsByID {
		perms := permsByModule[item.ModuleID]
		for _, p := range perms {
			lowerCode := strings.ToLower(p.PermissionCode)
			isMutate := strings.HasSuffix(lowerCode, ".manage") ||
				strings.HasSuffix(lowerCode, ".create") ||
				strings.HasSuffix(lowerCode, ".edit") ||
				strings.HasSuffix(lowerCode, ".delete") ||
				strings.HasSuffix(lowerCode, ".update")

			actionName := "View Access"
			if isMutate {
				actionName = "Manage / Edit Access"
			}
			if p.Description != nil && *p.Description != "" {
				actionName = *p.Description
			}

			action := models.ActionEntitlement{
				ActionCode:     p.PermissionCode,
				ActionName:     actionName,
				IsMutateAction: isMutate,
			}

			if item.EffectiveStatus != "ACTIVE" {
				action.EffectiveAccess = "DISABLED"
				if item.InheritedDisabled {
					action.RestrictionNote = item.InheritanceSource
				} else {
					action.RestrictionNote = fmt.Sprintf("%s is %s", item.Kind, item.EffectiveStatus)
				}
			} else if isMutate && item.EffectiveMode == "READ_ONLY" {
				action.EffectiveAccess = "RESTRICTED_READ_ONLY"
				action.RestrictionNote = "Feature mode is configured as READ_ONLY. Edit actions are blocked."
			} else {
				action.EffectiveAccess = "ALLOWED"
			}

			item.Actions = append(item.Actions, action)
		}
	}

	// 8. Assemble tree hierarchy (APP -> MODULE -> FEATURE)
	var rootApps []models.HierarchicalAccessItem
	totalItems := 0
	activeItems := 0

	// First attach features to modules
	for _, item := range itemsByID {
		totalItems++
		if item.EffectiveStatus == "ACTIVE" {
			activeItems++
		}
		if item.Kind == "FEATURE" && item.ParentID != nil {
			if parentMod, ok := itemsByID[*item.ParentID]; ok {
				parentMod.Children = append(parentMod.Children, *item)
			}
		}
	}

	// Next attach modules to apps
	for _, item := range itemsByID {
		if item.Kind == "MODULE" && item.ParentID != nil {
			if parentApp, ok := itemsByID[*item.ParentID]; ok {
				parentApp.Children = append(parentApp.Children, *item)
			}
		}
	}

	// Collect root apps
	for _, m := range modules {
		if m.Kind == "APP" || m.ParentID == nil {
			if appItem, ok := itemsByID[m.ModuleID]; ok {
				rootApps = append(rootApps, *appItem)
			}
		}
	}

	resp.Hierarchy = rootApps
	resp.TotalItems = totalItems
	resp.ActiveItems = activeItems

	return &resp, nil
}

// UpdateCollegeFeatureEntitlement upserts a feature or module configuration and audits the change.
func (r *Repository) UpdateCollegeFeatureEntitlement(
	ctx context.Context,
	collegeID uuid.UUID,
	moduleID uuid.UUID,
	req models.UpdateFeatureAccessRequest,
	actorUserID uuid.UUID,
	actorRole string,
) error {
	effFrom := time.Now()
	if req.EffectiveFrom != nil {
		effFrom = *req.EffectiveFrom
	}

	const upsertSQL = `
		INSERT INTO platform.college_modules (
			college_module_id,
			college_id,
			module_id,
			status,
			mode,
			effective_from,
			effective_to,
			reason,
			changed_by,
			created_at,
			updated_at
		) VALUES (
			gen_random_uuid(),
			$1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
		)
		ON CONFLICT (college_id, module_id)
		DO UPDATE SET
			status = EXCLUDED.status,
			mode = EXCLUDED.mode,
			effective_from = EXCLUDED.effective_from,
			effective_to = EXCLUDED.effective_to,
			reason = EXCLUDED.reason,
			changed_by = EXCLUDED.changed_by,
			updated_at = NOW()
	`
	_, err := r.Executor(ctx).Exec(
		ctx,
		upsertSQL,
		collegeID,
		moduleID,
		req.Status,
		req.Mode,
		effFrom,
		req.EffectiveTo,
		strings.TrimSpace(req.Reason),
		actorUserID,
	)
	if err != nil {
		return fmt.Errorf("upsert college module entitlement: %w", err)
	}

	// Record audit
	auditDetails := map[string]interface{}{
		"college_id":     collegeID,
		"module_id":      moduleID,
		"status":         req.Status,
		"mode":           req.Mode,
		"effective_from": effFrom,
		"effective_to":   req.EffectiveTo,
		"reason":         req.Reason,
	}
	detailsJSON, _ := json.Marshal(auditDetails)

	const auditSQL = `
		INSERT INTO platform.audit_logs (
			audit_id,
			college_id,
			actor_user_id,
			actor_role,
			module,
			action,
			entity_type,
			entity_id,
			new_data,
			reason,
			severity,
			created_at
		) VALUES (
			gen_random_uuid(),
			$1, $2, $3, 'super_admin_access_control', 'UPDATE_FEATURE_ACCESS',
			'platform.college_modules', $4, $5, $6, 'INFO', NOW()
		)
	`
	_, _ = r.Executor(ctx).Exec(
		ctx,
		auditSQL,
		collegeID,
		actorUserID,
		actorRole,
		moduleID,
		detailsJSON,
		req.Reason,
	)

	return nil
}

// EvaluateWhyDenied performs multi-stage diagnostic evaluation to explain access decisions.
func (r *Repository) EvaluateWhyDenied(
	ctx context.Context,
	req models.EvaluateAccessRequest,
) (*models.WhyDeniedEvaluationReport, error) {
	report := &models.WhyDeniedEvaluationReport{
		Allowed:          false,
		TargetModuleCode: req.ModuleOrFeatureCode,
		EvaluatedAction:  req.Action,
		EvaluationSteps:  make([]models.EvaluationStep, 0),
		DenialStage:      "NONE",
	}

	// 1. Stage 1: Tenant Status Check
	var collegeStatus string
	var collegeName string
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT status, name FROM platform.colleges WHERE college_id = $1
	`, req.CollegeID).Scan(&collegeStatus, &collegeName)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			report.PrimaryReason = "College tenant does not exist."
			report.DenialStage = "TENANT_STATUS"
			report.EvaluationSteps = append(report.EvaluationSteps, models.EvaluationStep{
				Stage:   "TENANT_STATUS",
				Rule:    "College must exist in platform.colleges",
				Status:  "FAIL",
				Details: "College ID was not found in the database.",
			})
			return report, nil
		}
		return nil, fmt.Errorf("query college status: %w", err)
	}

	if collegeStatus != "ACTIVE" && collegeStatus != "ONBOARDING" {
		report.PrimaryReason = fmt.Sprintf("College tenant '%s' status is %s (must be ACTIVE).", collegeName, collegeStatus)
		report.DenialStage = "TENANT_STATUS"
		report.EvaluationSteps = append(report.EvaluationSteps, models.EvaluationStep{
			Stage:   "TENANT_STATUS",
			Rule:    "College status must be ACTIVE or ONBOARDING",
			Status:  "FAIL",
			Details: fmt.Sprintf("College status is currently '%s'. All tenant features are blocked.", collegeStatus),
		})
		report.RemediationAdvice = "Reinstate or activate the college tenant under College Management."
		return report, nil
	}
	report.EvaluationSteps = append(report.EvaluationSteps, models.EvaluationStep{
		Stage:   "TENANT_STATUS",
		Rule:    "College status must be ACTIVE or ONBOARDING",
		Status:  "PASS",
		Details: fmt.Sprintf("College '%s' is %s.", collegeName, collegeStatus),
	})

	// 2. Stage 2: Platform Catalogue Verification
	var modID uuid.UUID
	var modName string
	var modKind string
	var parentID *uuid.UUID
	var isCatalogueActive bool
	err = r.Executor(ctx).QueryRow(ctx, `
		SELECT module_id, module_name, kind, parent_id, is_active
		FROM platform.modules
		WHERE UPPER(module_code) = UPPER($1)
	`, strings.TrimSpace(req.ModuleOrFeatureCode)).Scan(&modID, &modName, &modKind, &parentID, &isCatalogueActive)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			report.PrimaryReason = fmt.Sprintf("Module/Feature code '%s' does not exist in the platform catalogue.", req.ModuleOrFeatureCode)
			report.DenialStage = "CATALOGUE_STATUS"
			report.EvaluationSteps = append(report.EvaluationSteps, models.EvaluationStep{
				Stage:   "CATALOGUE_STATUS",
				Rule:    "Target module or feature must exist in platform.modules",
				Status:  "FAIL",
				Details: fmt.Sprintf("No module matching '%s' found in platform.modules.", req.ModuleOrFeatureCode),
			})
			report.RemediationAdvice = "Register this module or feature in the platform module catalogue."
			return report, nil
		}
		return nil, fmt.Errorf("query module catalogue: %w", err)
	}

	report.TargetKind = modKind
	if !isCatalogueActive {
		report.PrimaryReason = fmt.Sprintf("%s '%s' is deactivated platform-wide in the module catalogue.", modKind, modName)
		report.DenialStage = "CATALOGUE_STATUS"
		report.EvaluationSteps = append(report.EvaluationSteps, models.EvaluationStep{
			Stage:   "CATALOGUE_STATUS",
			Rule:    "Target module or feature must have is_active = true in platform catalogue",
			Status:  "FAIL",
			Details: "Platform catalogue flag is_active is false.",
		})
		report.RemediationAdvice = "Enable this module/feature platform-wide in Module Catalogue management."
		return report, nil
	}
	report.EvaluationSteps = append(report.EvaluationSteps, models.EvaluationStep{
		Stage:   "CATALOGUE_STATUS",
		Rule:    "Target module or feature must have is_active = true in platform catalogue",
		Status:  "PASS",
		Details: fmt.Sprintf("%s '%s' is active in platform catalogue.", modKind, modName),
	})

	// 3. Stage 3: Parent Hierarchy & Inherited Disabled State
	// Check all ancestors up to root APP
	currParentID := parentID
	for currParentID != nil {
		var pID uuid.UUID
		var pCode, pName, pKind string
		var pParentID *uuid.UUID
		var pActive bool
		err = r.Executor(ctx).QueryRow(ctx, `
			SELECT module_id, module_code, module_name, kind, parent_id, is_active
			FROM platform.modules
			WHERE module_id = $1
		`, *currParentID).Scan(&pID, &pCode, &pName, &pKind, &pParentID, &pActive)
		if err != nil {
			break
		}

		if !pActive {
			report.PrimaryReason = fmt.Sprintf("Parent %s '%s' is deactivated in the platform catalogue.", pKind, pName)
			report.DenialStage = "PARENT_INHERITANCE"
			report.EvaluationSteps = append(report.EvaluationSteps, models.EvaluationStep{
				Stage:   "PARENT_INHERITANCE",
				Rule:    "All parent applications and modules must be active in catalogue",
				Status:  "FAIL",
				Details: fmt.Sprintf("Parent %s '%s' has is_active = false.", pKind, pName),
			})
			return report, nil
		}

		// Check parent entitlement for this college
		var pStatus string
		pErr := r.Executor(ctx).QueryRow(ctx, `
			SELECT status FROM platform.college_modules WHERE college_id = $1 AND module_id = $2
		`, req.CollegeID, pID).Scan(&pStatus)
		if pErr != nil || pStatus != "ACTIVE" {
			report.PrimaryReason = fmt.Sprintf("Inherited disabled state: Parent %s '%s' is %s for this college.", pKind, pName, pStatus)
			report.DenialStage = "PARENT_INHERITANCE"
			report.EvaluationSteps = append(report.EvaluationSteps, models.EvaluationStep{
				Stage:   "PARENT_INHERITANCE",
				Rule:    "All ancestor applications and modules must be entitled and ACTIVE for this college",
				Status:  "FAIL",
				Details: fmt.Sprintf("Ancestor %s '%s' configured status is '%s'. Child features automatically inherit disabled state.", pKind, pName, pStatus),
			})
			report.RemediationAdvice = fmt.Sprintf("Enable the parent %s '%s' for this college in Module Entitlements.", pKind, pName)
			return report, nil
		}

		currParentID = pParentID
	}
	report.EvaluationSteps = append(report.EvaluationSteps, models.EvaluationStep{
		Stage:   "PARENT_INHERITANCE",
		Rule:    "All ancestor applications and modules must be entitled and ACTIVE for this college",
		Status:  "PASS",
		Details: "All ancestor modules are active and enabled for this college.",
	})

	// 4. Stage 4: Direct College Entitlement Check
	var cmStatus string
	var cmMode string
	var effFrom time.Time
	var effTo *time.Time
	err = r.Executor(ctx).QueryRow(ctx, `
		SELECT status, mode, effective_from, effective_to
		FROM platform.college_modules
		WHERE college_id = $1 AND module_id = $2
	`, req.CollegeID, modID).Scan(&cmStatus, &cmMode, &effFrom, &effTo)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			report.PrimaryReason = fmt.Sprintf("This college is not entitled to %s '%s' (not configured).", modKind, modName)
			report.DenialStage = "TENANT_ENTITLEMENT"
			report.EvaluationSteps = append(report.EvaluationSteps, models.EvaluationStep{
				Stage:   "TENANT_ENTITLEMENT",
				Rule:    "Module/feature must be assigned to college in platform.college_modules",
				Status:  "FAIL",
				Details: "No assignment record exists for this college and module.",
			})
			report.RemediationAdvice = fmt.Sprintf("Assign %s '%s' to this college in Module / Feature Access Control.", modKind, modName)
			return report, nil
		}
		return nil, fmt.Errorf("query college module entitlement: %w", err)
	}

	report.EffectiveStatus = cmStatus
	report.EffectiveMode = cmMode

	now := time.Now()
	if cmStatus == "DISABLED" {
		report.PrimaryReason = fmt.Sprintf("%s '%s' is explicitly DISABLED for this college.", modKind, modName)
		report.DenialStage = "TENANT_ENTITLEMENT"
		report.EvaluationSteps = append(report.EvaluationSteps, models.EvaluationStep{
			Stage:   "TENANT_ENTITLEMENT",
			Rule:    "College module status must be ACTIVE",
			Status:  "FAIL",
			Details: "Configured status is DISABLED.",
		})
		report.RemediationAdvice = fmt.Sprintf("Change status from DISABLED to ACTIVE for %s '%s'.", modKind, modName)
		return report, nil
	}

	if cmStatus == "SCHEDULED" {
		report.PrimaryReason = fmt.Sprintf("%s '%s' is SCHEDULED and not yet effective (starts %s).", modKind, modName, effFrom.Format("2006-01-02 15:04:05"))
		report.DenialStage = "TENANT_ENTITLEMENT"
		report.EvaluationSteps = append(report.EvaluationSteps, models.EvaluationStep{
			Stage:   "TENANT_ENTITLEMENT",
			Rule:    "Current time must be within effective date window",
			Status:  "FAIL",
			Details: fmt.Sprintf("Effective from %s.", effFrom.Format(time.RFC3339)),
		})
		return report, nil
	}

	if effFrom.After(now) {
		report.PrimaryReason = fmt.Sprintf("Entitlement effective start date is in the future (%s).", effFrom.Format("2006-01-02"))
		report.DenialStage = "TENANT_ENTITLEMENT"
		report.EvaluationSteps = append(report.EvaluationSteps, models.EvaluationStep{
			Stage:   "TENANT_ENTITLEMENT",
			Rule:    "Current date must be on or after effective_from",
			Status:  "FAIL",
			Details: fmt.Sprintf("Effective from %s is after current time %s.", effFrom.Format(time.RFC3339), now.Format(time.RFC3339)),
		})
		return report, nil
	}

	if effTo != nil && effTo.Before(now) {
		report.PrimaryReason = fmt.Sprintf("Entitlement expired on %s.", effTo.Format("2006-01-02"))
		report.DenialStage = "TENANT_ENTITLEMENT"
		report.EvaluationSteps = append(report.EvaluationSteps, models.EvaluationStep{
			Stage:   "TENANT_ENTITLEMENT",
			Rule:    "Current date must be before effective_to",
			Status:  "FAIL",
			Details: fmt.Sprintf("Effective to %s has passed.", effTo.Format(time.RFC3339)),
		})
		report.RemediationAdvice = "Extend or remove the effective_to expiry date."
		return report, nil
	}

	report.EvaluationSteps = append(report.EvaluationSteps, models.EvaluationStep{
		Stage:   "TENANT_ENTITLEMENT",
		Rule:    "Module entitlement must be ACTIVE and within effective date window",
		Status:  "PASS",
		Details: fmt.Sprintf("Entitlement is ACTIVE in %s mode.", cmMode),
	})

	// 5. Stage 5: Read-Only Mode & Action Check
	isMutate := false
	if req.HTTPMethod != "" {
		method := strings.ToUpper(strings.TrimSpace(req.HTTPMethod))
		if method == "POST" || method == "PUT" || method == "PATCH" || method == "DELETE" {
			isMutate = true
		}
	}
	if req.Action != "" {
		actionLower := strings.ToLower(strings.TrimSpace(req.Action))
		if strings.Contains(actionLower, "manage") || strings.Contains(actionLower, "edit") ||
			strings.Contains(actionLower, "create") || strings.Contains(actionLower, "delete") ||
			strings.Contains(actionLower, "update") {
			isMutate = true
		}
	}

	if cmMode == "READ_ONLY" && isMutate {
		report.PrimaryReason = fmt.Sprintf("%s '%s' is configured in READ_ONLY mode. Edit and mutation actions are prohibited.", modKind, modName)
		report.DenialStage = "READ_ONLY_RESTRICTION"
		report.EvaluationSteps = append(report.EvaluationSteps, models.EvaluationStep{
			Stage:   "READ_ONLY_RESTRICTION",
			Rule:    "READ_ONLY mode prohibits mutate actions (manage, create, edit, update, delete)",
			Status:  "FAIL",
			Details: fmt.Sprintf("Requested action involves mutation (HTTP %s / action '%s'), but mode is READ_ONLY.", req.HTTPMethod, req.Action),
		})
		report.RemediationAdvice = "To allow this action, update feature mode from READ_ONLY to FULL."
		return report, nil
	}
	report.EvaluationSteps = append(report.EvaluationSteps, models.EvaluationStep{
		Stage:   "READ_ONLY_RESTRICTION",
		Rule:    "READ_ONLY mode check for mutate actions",
		Status:  "PASS",
		Details: fmt.Sprintf("Action permitted under mode '%s'.", cmMode),
	})

	// 6. Stage 6: User Authorization & Role Permission Check (if UserID provided)
	if req.UserID != nil && *req.UserID != uuid.Nil {
		var userStatus string
		uErr := r.Executor(ctx).QueryRow(ctx, `SELECT status FROM app.users WHERE user_id = $1`, *req.UserID).Scan(&userStatus)
		if uErr != nil || userStatus != "ACTIVE" {
			report.PrimaryReason = fmt.Sprintf("User account is not active (status: %s).", userStatus)
			report.DenialStage = "USER_PERMISSION"
			report.EvaluationSteps = append(report.EvaluationSteps, models.EvaluationStep{
				Stage:   "USER_PERMISSION",
				Rule:    "User account must be ACTIVE",
				Status:  "FAIL",
				Details: fmt.Sprintf("User status is '%s'.", userStatus),
			})
			return report, nil
		}

		// Check user role permission
		var hasRolePermission bool
		roleCheckSQL := `
			SELECT EXISTS (
				SELECT 1
				FROM platform.user_roles ur
				JOIN platform.role_permissions rp ON rp.role_id = ur.role_id
				JOIN platform.permissions p ON p.permission_id = rp.permission_id
				WHERE ur.user_id = $1
				  AND ur.college_id = $2
				  AND ur.status = 'ACTIVE'
				  AND p.module_id = $3
			)
		`
		_ = r.Executor(ctx).QueryRow(ctx, roleCheckSQL, *req.UserID, req.CollegeID, modID).Scan(&hasRolePermission)
		if !hasRolePermission {
			report.PrimaryReason = fmt.Sprintf("User does not have an active role granting permissions for %s '%s'.", modKind, modName)
			report.DenialStage = "USER_PERMISSION"
			report.EvaluationSteps = append(report.EvaluationSteps, models.EvaluationStep{
				Stage:   "USER_PERMISSION",
				Rule:    "User must hold an active role possessing permission for this module",
				Status:  "FAIL",
				Details: "No matching active role permission found for user.",
			})
			report.RemediationAdvice = "Assign a role containing this module's permissions to the user."
			return report, nil
		}
		report.EvaluationSteps = append(report.EvaluationSteps, models.EvaluationStep{
			Stage:   "USER_PERMISSION",
			Rule:    "User must hold an active role possessing permission for this module",
			Status:  "PASS",
			Details: "User holds active role granting permission.",
		})
	} else {
		report.EvaluationSteps = append(report.EvaluationSteps, models.EvaluationStep{
			Stage:   "USER_PERMISSION",
			Rule:    "Specific user check",
			Status:  "SKIPPED",
			Details: "No specific user ID provided; evaluated at college tenant entitlement level.",
		})
	}

	// All checks passed!
	report.Allowed = true
	report.PrimaryReason = fmt.Sprintf("Access is fully ALLOWED for %s '%s' in %s mode.", modKind, modName, cmMode)
	report.DenialStage = "NONE"

	return report, nil
}
