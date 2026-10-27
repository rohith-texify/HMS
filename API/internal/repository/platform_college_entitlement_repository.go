package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type UpdateCollegeEntitlementParams struct {
	ModuleID      uuid.UUID
	Status        string
	Mode          string
	EffectiveFrom interface{}
	EffectiveTo   interface{}
	ChangeReason  *string
	ChangedBy     uuid.UUID
}

func (r *Repository) UpdateCollegeEntitlement(
	ctx context.Context,
	collegeID uuid.UUID,
	params UpdateCollegeEntitlementParams,
) (CollegeModule, error) {
	var module CollegeModule

	err := r.Executor(ctx).QueryRow(
		ctx,
		`
		UPDATE platform.college_modules cm
		SET
			status = $1,
			mode = $2,
			effective_from = $3,
			effective_to = $4,
			change_reason = $5,
			changed_by = $6,
			updated_at = NOW()
		WHERE cm.college_id = $7
		  AND cm.module_id = $8
		RETURNING
			cm.college_id,
			cm.module_id,
			(
				SELECT m.module_code
				FROM platform.modules m
				WHERE m.module_id = cm.module_id
			),
			(
				SELECT m.parent_id
				FROM platform.modules m
				WHERE m.module_id = cm.module_id
			),
			(
				SELECT m.kind
				FROM platform.modules m
				WHERE m.module_id = cm.module_id
			),
			(
				SELECT m.priority
				FROM platform.modules m
				WHERE m.module_id = cm.module_id
			),
			(
				SELECT m.is_core
				FROM platform.modules m
				WHERE m.module_id = cm.module_id
			),
			cm.status,
			cm.mode,
			cm.effective_from::text,
			cm.effective_to::text,
			cm.change_reason,
			cm.changed_by
		`,
		params.Status,
		params.Mode,
		params.EffectiveFrom,
		params.EffectiveTo,
		params.ChangeReason,
		params.ChangedBy,
		collegeID,
		params.ModuleID,
	).Scan(
		&module.CollegeID,
		&module.ModuleID,
		&module.ModuleCode,
		&module.ParentID,
		&module.Kind,
		&module.Priority,
		&module.IsCore,
		&module.Status,
		&module.Mode,
		&module.EffectiveFrom,
		&module.EffectiveTo,
		&module.ChangeReason,
		&module.ChangedBy,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return CollegeModule{}, ErrNotFound
		}

		return CollegeModule{}, fmt.Errorf(
			"failed to update college entitlement: %w",
			err,
		)
	}

	return module, nil
}
