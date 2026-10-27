package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

// UpdateTemplateParams contains fields that can be updated on an entitlement template.
type UpdateTemplateParams struct {
	Name        *string
	Description *string
	Version     *int
	IsActive    *bool
}

// TemplateAuditParams holds parameters for recording template audit logs.
type TemplateAuditParams struct {
	ActorUserID uuid.UUID
	ActorRole   string
	Action      string
	TemplateID  uuid.UUID
	OldData     interface{}
	NewData     interface{}
	Reason      *string
	Severity    string
}

// ListEntitlementTemplates retrieves entitlement templates matching the criteria with pagination.
func (r *Repository) ListEntitlementTemplates(
	ctx context.Context,
	isActive *bool,
	limit, offset int,
) ([]models.EntitlementTemplate, int, error) {
	whereClauses := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if isActive != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("is_active = $%d", argIdx))
		args = append(args, *isActive)
		argIdx++
	}

	whereSQL := ""
	for i, clause := range whereClauses {
		if i == 0 {
			whereSQL = "WHERE " + clause
		} else {
			whereSQL += " AND " + clause
		}
	}

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM platform.entitlement_templates %s", whereSQL)
	var total int
	err := r.Executor(ctx).QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count entitlement templates: %w", err)
	}

	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	query := fmt.Sprintf(`
		SELECT
			template_id,
			template_code,
			name,
			description,
			version,
			is_active,
			created_at,
			updated_at
		FROM platform.entitlement_templates
		%s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := r.Executor(ctx).Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query entitlement templates: %w", err)
	}
	defer rows.Close()

	var templates []models.EntitlementTemplate
	for rows.Next() {
		var tmpl models.EntitlementTemplate
		if err := rows.Scan(
			&tmpl.TemplateID,
			&tmpl.TemplateCode,
			&tmpl.Name,
			&tmpl.Description,
			&tmpl.Version,
			&tmpl.IsActive,
			&tmpl.CreatedAt,
			&tmpl.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan entitlement template: %w", err)
		}
		templates = append(templates, tmpl)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error reading entitlement template rows: %w", err)
	}

	return templates, total, nil
}

// GetEntitlementTemplateByID retrieves an entitlement template by its UUID.
func (r *Repository) GetEntitlementTemplateByID(
	ctx context.Context,
	templateID uuid.UUID,
) (*models.EntitlementTemplate, error) {
	query := `
		SELECT
			template_id,
			template_code,
			name,
			description,
			version,
			is_active,
			created_at,
			updated_at
		FROM platform.entitlement_templates
		WHERE template_id = $1
	`

	var tmpl models.EntitlementTemplate
	err := r.Executor(ctx).QueryRow(ctx, query, templateID).Scan(
		&tmpl.TemplateID,
		&tmpl.TemplateCode,
		&tmpl.Name,
		&tmpl.Description,
		&tmpl.Version,
		&tmpl.IsActive,
		&tmpl.CreatedAt,
		&tmpl.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &tmpl, nil
}

// GetEntitlementTemplateByCode retrieves an entitlement template by its unique code.
func (r *Repository) GetEntitlementTemplateByCode(
	ctx context.Context,
	code string,
) (*models.EntitlementTemplate, error) {
	query := `
		SELECT
			template_id,
			template_code,
			name,
			description,
			version,
			is_active,
			created_at,
			updated_at
		FROM platform.entitlement_templates
		WHERE template_code = $1
	`

	var tmpl models.EntitlementTemplate
	err := r.Executor(ctx).QueryRow(ctx, query, code).Scan(
		&tmpl.TemplateID,
		&tmpl.TemplateCode,
		&tmpl.Name,
		&tmpl.Description,
		&tmpl.Version,
		&tmpl.IsActive,
		&tmpl.CreatedAt,
		&tmpl.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &tmpl, nil
}

// CreateEntitlementTemplate inserts a new entitlement template record.
func (r *Repository) CreateEntitlementTemplate(
	ctx context.Context,
	tmpl models.EntitlementTemplate,
) (*models.EntitlementTemplate, error) {
	query := `
		INSERT INTO platform.entitlement_templates (
			template_id,
			template_code,
			name,
			description,
			version,
			is_active,
			created_at,
			updated_at
		) VALUES (
			COALESCE(NULLIF($1, '00000000-0000-0000-0000-000000000000'::uuid), gen_random_uuid()),
			$2,
			$3,
			$4,
			$5,
			$6,
			NOW(),
			NOW()
		)
		RETURNING
			template_id,
			template_code,
			name,
			description,
			version,
			is_active,
			created_at,
			updated_at
	`

	var created models.EntitlementTemplate
	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		tmpl.TemplateID,
		tmpl.TemplateCode,
		tmpl.Name,
		tmpl.Description,
		tmpl.Version,
		tmpl.IsActive,
	).Scan(
		&created.TemplateID,
		&created.TemplateCode,
		&created.Name,
		&created.Description,
		&created.Version,
		&created.IsActive,
		&created.CreatedAt,
		&created.UpdatedAt,
	)
	if err != nil {
		var pgErr interface{ SQLState() string }
		if errors.As(err, &pgErr) && pgErr.SQLState() == "23505" {
			return nil, fmt.Errorf("entitlement template with code '%s' already exists", tmpl.TemplateCode)
		}
		return nil, fmt.Errorf("failed to create entitlement template: %w", err)
	}

	return &created, nil
}

// UpdateEntitlementTemplate updates permitted fields of an entitlement template.
func (r *Repository) UpdateEntitlementTemplate(
	ctx context.Context,
	templateID uuid.UUID,
	params UpdateTemplateParams,
) (*models.EntitlementTemplate, error) {
	setClauses := []string{"updated_at = NOW()"}
	args := []interface{}{templateID}
	argIdx := 2

	if params.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *params.Name)
		argIdx++
	}

	if params.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, *params.Description)
		argIdx++
	}

	if params.Version != nil {
		setClauses = append(setClauses, fmt.Sprintf("version = $%d", argIdx))
		args = append(args, *params.Version)
		argIdx++
	}

	if params.IsActive != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_active = $%d", argIdx))
		args = append(args, *params.IsActive)
		argIdx++
	}

	setSQL := ""
	for i, clause := range setClauses {
		if i == 0 {
			setSQL = clause
		} else {
			setSQL += ", " + clause
		}
	}

	query := fmt.Sprintf(`
		UPDATE platform.entitlement_templates
		SET %s
		WHERE template_id = $1
		RETURNING
			template_id,
			template_code,
			name,
			description,
			version,
			is_active,
			created_at,
			updated_at
	`, setSQL)

	var updated models.EntitlementTemplate
	err := r.Executor(ctx).QueryRow(ctx, query, args...).Scan(
		&updated.TemplateID,
		&updated.TemplateCode,
		&updated.Name,
		&updated.Description,
		&updated.Version,
		&updated.IsActive,
		&updated.CreatedAt,
		&updated.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update entitlement template: %w", err)
	}

	return &updated, nil
}

// DeleteEntitlementTemplate removes an entitlement template from platform.entitlement_templates.
func (r *Repository) DeleteEntitlementTemplate(
	ctx context.Context,
	templateID uuid.UUID,
) error {
	query := `DELETE FROM platform.entitlement_templates WHERE template_id = $1`
	tag, err := r.Executor(ctx).Exec(ctx, query, templateID)
	if err != nil {
		var pgErr interface{ SQLState() string }
		if errors.As(err, &pgErr) && pgErr.SQLState() == "23503" {
			return fmt.Errorf("cannot delete entitlement template: it is referenced by other records")
		}
		return fmt.Errorf("failed to delete entitlement template: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("entitlement template not found")
	}
	return nil
}

// RecordTemplateAudit writes an audit record for entitlement template mutations.
func (r *Repository) RecordTemplateAudit(
	ctx context.Context,
	params TemplateAuditParams,
) error {
	var oldJSON, newJSON []byte
	var err error

	if params.OldData != nil {
		oldJSON, err = json.Marshal(params.OldData)
		if err != nil {
			return fmt.Errorf("failed to marshal old data for audit: %w", err)
		}
	}

	if params.NewData != nil {
		newJSON, err = json.Marshal(params.NewData)
		if err != nil {
			return fmt.Errorf("failed to marshal new data for audit: %w", err)
		}
	}

	severity := params.Severity
	if severity == "" {
		if params.Action == "DELETE_TEMPLATE" {
			severity = "WARNING"
		} else {
			severity = "INFO"
		}
	}

	query := `
		INSERT INTO platform.audit_logs (
			audit_id,
			college_id,
			actor_user_id,
			actor_role,
			module,
			action,
			entity_type,
			entity_id,
			old_data,
			new_data,
			reason,
			created_at,
			severity
		) VALUES (
			gen_random_uuid(),
			NULL,
			$1,
			$2,
			'platform_entitlement_templates',
			$3,
			'ENTITLEMENT_TEMPLATE',
			$4,
			$5::jsonb,
			$6::jsonb,
			$7,
			NOW(),
			$8
		)
	`

	_, err = r.Executor(ctx).Exec(
		ctx,
		query,
		params.ActorUserID,
		params.ActorRole,
		params.Action,
		params.TemplateID,
		oldJSON,
		newJSON,
		params.Reason,
		severity,
	)
	if err != nil {
		return fmt.Errorf("failed to record template audit log: %w", err)
	}

	return nil
}
