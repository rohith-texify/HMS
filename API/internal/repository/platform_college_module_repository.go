package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type CollegeModule struct {
	CollegeID     uuid.UUID  `json:"college_id"`
	ModuleID      uuid.UUID  `json:"module_id"`
	ModuleCode    string     `json:"module_code"`
	ParentID      *uuid.UUID `json:"parent_id,omitempty"`
	Kind          string     `json:"kind"`
	Priority      string     `json:"priority"`
	IsCore        bool       `json:"is_core"`
	Status        string     `json:"status"`
	Mode          string     `json:"mode"`
	EffectiveFrom *string    `json:"effective_from,omitempty"`
	EffectiveTo   *string    `json:"effective_to,omitempty"`
	ChangeReason  *string    `json:"change_reason,omitempty"`
	ChangedBy     *uuid.UUID `json:"changed_by,omitempty"`
}

type ConfigureCollegeModuleParams struct {
	CollegeID     uuid.UUID
	ModuleID      uuid.UUID
	Status        string
	Mode          string
	EffectiveFrom *string
	EffectiveTo   *string
	ChangeReason  string
	ChangedBy     uuid.UUID
}

func (r *Repository) ListCollegeModules(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]CollegeModule, error) {
	rows, err := r.Executor(ctx).Query(
		ctx,
		`
		SELECT
			cm.college_id,
			m.module_id,
			m.module_code,
			m.parent_id,
			m.kind,
			m.priority,
			m.is_core,
			cm.status,
			cm.mode,
			cm.effective_from::text,
			cm.effective_to::text,
			cm.change_reason,
			cm.changed_by
		FROM platform.college_modules cm
		INNER JOIN platform.modules m
			ON m.module_id = cm.module_id
		WHERE cm.college_id = $1
		ORDER BY
			m.priority ASC,
			m.module_code ASC
		`,
		collegeID,
	)
	if err != nil {
		return nil, fmt.Errorf(
			"failed to list college modules: %w",
			err,
		)
	}

	defer rows.Close()

	modules := make([]CollegeModule, 0)

	for rows.Next() {
		var module CollegeModule

		if err := rows.Scan(
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
		); err != nil {
			return nil, fmt.Errorf(
				"failed to scan college module: %w",
				err,
			)
		}

		modules = append(modules, module)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf(
			"failed while reading college modules: %w",
			err,
		)
	}

	return modules, nil
}

func (r *Repository) ConfigureCollegeModule(
	ctx context.Context,
	params ConfigureCollegeModuleParams,
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
		&module.Status,
		&module.Mode,
		&module.EffectiveFrom,
		&module.EffectiveTo,
		&module.ChangeReason,
		&module.ChangedBy,
	)

	if err != nil {
		var pgErr *pgconn.PgError

		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return CollegeModule{}, ErrConflict
		}

		return CollegeModule{}, fmt.Errorf(
			"failed to configure college module: %w",
			err,
		)
	}

	return module, nil
}

func (r *Repository) GetModule(
	ctx context.Context,
	moduleID uuid.UUID,
) (CollegeModule, error) {
	var module CollegeModule

	err := r.Executor(ctx).QueryRow(
		ctx,
		`
		SELECT
			module_id,
			module_code,
			parent_id,
			kind,
			priority,
			is_core
		FROM platform.modules
		WHERE module_id = $1
		`,
		moduleID,
	).Scan(
		&module.ModuleID,
		&module.ModuleCode,
		&module.ParentID,
		&module.Kind,
		&module.Priority,
		&module.IsCore,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return CollegeModule{}, ErrNotFound
		}

		return CollegeModule{}, fmt.Errorf(
			"failed to get module: %w",
			err,
		)
	}

	return module, nil
}
