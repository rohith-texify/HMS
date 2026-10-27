package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/internal/database"
)

type User struct {
	UserID       uuid.UUID
	Email        *string
	Phone        *string
	PasswordHash *string
	Status       string
	MFAEnabled   bool
	LastLoginAt  *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type UserRepository struct {
	*Repository
}

func NewUserRepository(db *database.Database) *UserRepository {
	return &UserRepository{
		Repository: New(db),
	}
}

func (r *UserRepository) FindByID(
	ctx context.Context,
	userID uuid.UUID,
) (*User, error) {
	const query = `
		SELECT
			user_id,
			email,
			phone,
			password_hash,
			status,
			mfa_enabled,
			last_login_at,
			created_at,
			updated_at
		FROM app.users
		WHERE user_id = $1
	`

	var user User

	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		userID,
	).Scan(
		&user.UserID,
		&user.Email,
		&user.Phone,
		&user.PasswordHash,
		&user.Status,
		&user.MFAEnabled,
		&user.LastLoginAt,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}

		return nil, fmt.Errorf("failed to find user by ID: %w", err)
	}

	return &user, nil
}

func (r *UserRepository) FindByEmail(
	ctx context.Context,
	email string,
) (*User, error) {
	const query = `
		SELECT
			user_id,
			email,
			phone,
			password_hash,
			status,
			mfa_enabled,
			last_login_at,
			created_at,
			updated_at
		FROM app.users
		WHERE email = $1
	`

	var user User

	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		email,
	).Scan(
		&user.UserID,
		&user.Email,
		&user.Phone,
		&user.PasswordHash,
		&user.Status,
		&user.MFAEnabled,
		&user.LastLoginAt,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}

		return nil, fmt.Errorf("failed to find user by email: %w", err)
	}

	return &user, nil
}

func (r *UserRepository) UpdateLastLogin(
	ctx context.Context,
	userID uuid.UUID,
	loginTime time.Time,
) error {
	const query = `
		UPDATE app.users
		SET
			last_login_at = $1,
			updated_at = NOW()
		WHERE user_id = $2
	`

	commandTag, err := r.Executor(ctx).Exec(
		ctx,
		query,
		loginTime,
		userID,
	)

	if err != nil {
		return fmt.Errorf("failed to update last login time: %w", err)
	}

	if commandTag.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}
