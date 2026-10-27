package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type AssignCollegeModuleParams struct {
	CollegeID     uuid.UUID
	ModuleID      uuid.UUID
	Status        string
	Mode          string
	EffectiveFrom *time.Time
	EffectiveTo   *time.Time
	ChangeReason  *string
	ChangedBy     uuid.UUID
}

func (r *Repository) AssignCollegeModule(
	ctx context.Context,
	params AssignCollegeModuleParams,
) (CollegeModule, error) {
	var module CollegeModule

	err := r.Executor(ctx).QueryRow(
		ctx,
		`
		INSERT INTO platform.college_modules (
			college_id,
			module_id,
			status,
			mode,
			effective_from,
			effective_to,
			change_reason,
			changed_by
		)
		VALUES (
			$1,
			$2,
			$3,
			$4,
			$5,
			$6,
			$7,
			$8
		)
		RETURNING
			college_id,
			module_id,
			(
				SELECT module_code
				FROM platform.modules
				WHERE module_id = platform.college_modules.module_id
			),
			(
				SELECT parent_id
				FROM platform.modules
				WHERE module_id = platform.college_modules.module_id
			),
			(
				SELECT kind
				FROM platform.modules
				WHERE module_id = platform.college_modules.module_id
			),
			(
				SELECT priority
				FROM platform.modules
				WHERE module_id = platform.college_modules.module_id
			),
			(
				SELECT is_core
				FROM platform.modules
				WHERE module_id = platform.college_modules.module_id
			),
			status,
			mode,
			effective_from::text,
			effective_to::text,
			change_reason,
			changed_by
		`,
		params.CollegeID,
		params.ModuleID,
		params.Status,
		params.Mode,
		params.EffectiveFrom,
		params.EffectiveTo,
		params.ChangeReason,
		params.ChangedBy,
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
		var pgErr interface {
			SQLState() string
		}

		if errors.As(err, &pgErr) && pgErr.SQLState() == "23505" {
			return CollegeModule{}, ErrConflict
		}

		return CollegeModule{}, fmt.Errorf(
			"failed to assign college module: %w",
			err,
		)
	}

	return module, nil
}
