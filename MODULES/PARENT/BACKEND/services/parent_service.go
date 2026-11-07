package services

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/validators"
)

var (
	ErrInvalidParentID         = errors.New("invalid parent id")
	ErrInvalidParentCollegeID  = errors.New("invalid college id")
	ErrInvalidParentFirstName  = errors.New("first name is required")
	ErrInvalidParentPagination = errors.New("invalid pagination")
	ErrParentNotFound          = errors.New("parent not found")
	ErrParentConflict          = errors.New("parent conflict")
)

type ParentService struct {
	db   *database.Database
	repo *repository.Repository
}

func NewParentService(
	db *database.Database,
	repo *repository.Repository,
) *ParentService {
	return &ParentService{
		db:   db,
		repo: repo,
	}
}

func (s *ParentService) ListParents(
	ctx context.Context,
	collegeID uuid.UUID,
	limit int,
	offset int,
) ([]models.Parent, error) {
	if collegeID == uuid.Nil {
		return nil, ErrInvalidParentCollegeID
	}

	lim, off, err := validators.ValidatePagination(limit, offset)
	if err != nil {
		return nil, ErrInvalidParentPagination
	}

	return s.repo.ListParents(
		ctx,
		repository.ListParentsParams{
			CollegeID: collegeID,
			Limit:     lim,
			Offset:    off,
		},
	)
}

func (s *ParentService) GetParentByID(
	ctx context.Context,
	collegeID uuid.UUID,
	parentID uuid.UUID,
) (models.Parent, error) {
	if collegeID == uuid.Nil {
		return models.Parent{}, ErrInvalidParentCollegeID
	}

	if parentID == uuid.Nil {
		return models.Parent{}, ErrInvalidParentID
	}

	parent, err := s.repo.GetParentByID(ctx, collegeID, parentID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return models.Parent{}, ErrParentNotFound
		}
		return models.Parent{}, err
	}

	return parent, nil
}

func (s *ParentService) CreateParent(
	ctx context.Context,
	params repository.CreateParentParams,
) (models.Parent, error) {
	if params.CollegeID == uuid.Nil {
		return models.Parent{}, ErrInvalidParentCollegeID
	}

	params.FirstName = strings.TrimSpace(params.FirstName)
	if err := validators.ValidateParentInput(params.FirstName); err != nil {
		return models.Parent{}, ErrInvalidParentFirstName
	}

	if err := validators.ValidateParentCredentials(params.Email, params.Password, params.ConfirmPassword); err != nil {
		return models.Parent{}, err
	}

	normalizeParentPointers(&params)

	// If password is provided, provision parent user account and assign PARENT role
	if params.Password != nil && strings.TrimSpace(*params.Password) != "" {
		pwd := strings.TrimSpace(*params.Password)
		email := strings.ToLower(strings.TrimSpace(*params.Email))

		hash, err := bcrypt.GenerateFromPassword([]byte(pwd), bcrypt.DefaultCost)
		if err != nil {
			return models.Parent{}, fmt.Errorf("failed to hash parent password: %w", err)
		}

		var createdParent models.Parent

		if s.db != nil {
			txErr := s.db.WithTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
				// Concurrency-Safe Parent Quota Enforcement
				var maxParents int
				if qErr := tx.QueryRow(txCtx, `
					SELECT COALESCE(max_parents, 500) FROM platform.colleges WHERE college_id = $1 FOR UPDATE
				`, params.CollegeID).Scan(&maxParents); qErr == nil {
					var activeParentCount int
					_ = tx.QueryRow(txCtx, `
						SELECT COUNT(DISTINCT ur.user_id)
						FROM platform.user_roles ur
						JOIN platform.roles r ON ur.role_id = r.role_id
						JOIN app.users u ON ur.user_id = u.user_id
						WHERE ur.college_id = $1 
						  AND r.role_code = 'PARENT'
						  AND ur.status = 'ACTIVE' 
						  AND u.status = 'ACTIVE'
					`, params.CollegeID).Scan(&activeParentCount)
					if activeParentCount >= maxParents {
						return fmt.Errorf("parent account limit reached for this college (limit: %d, currently active: %d). Contact Super Admin to increase quota", maxParents, activeParentCount)
					}
				}

				// Check or insert into app.users
				var userID uuid.UUID
				err := tx.QueryRow(txCtx, `
					SELECT user_id FROM app.users WHERE LOWER(email) = LOWER($1)
				`, email).Scan(&userID)

				var phoneVal *string
				if params.Phone != nil && strings.TrimSpace(*params.Phone) != "" {
					p := strings.TrimSpace(*params.Phone)
					phoneVal = &p
				}

				if err != nil && errors.Is(err, pgx.ErrNoRows) {
					userID = uuid.New()
					_, err = tx.Exec(txCtx, `
						INSERT INTO app.users (user_id, email, phone, password_hash, status)
						VALUES ($1, $2, $3, $4, 'ACTIVE')
					`, userID, email, phoneVal, string(hash))
					if err != nil {
						return fmt.Errorf("failed to create parent user account: %w", err)
					}
				} else if err != nil {
					return fmt.Errorf("failed to check existing user: %w", err)
				} else {
					_, err = tx.Exec(txCtx, `
						UPDATE app.users
						SET password_hash = $1, status = 'ACTIVE', phone = COALESCE(NULLIF($2, ''), phone), updated_at = NOW()
						WHERE user_id = $3
					`, string(hash), phoneVal, userID)
					if err != nil {
						return fmt.Errorf("failed to update parent credentials: %w", err)
					}
				}

				// Ensure PARENT role exists and assign user_roles
				var roleID uuid.UUID
				err = tx.QueryRow(txCtx, `
					SELECT role_id FROM platform.roles WHERE role_code = 'PARENT'
				`).Scan(&roleID)
				if err != nil {
					roleID = uuid.New()
					_, err = tx.Exec(txCtx, `
						INSERT INTO platform.roles (role_id, role_code, role_name, scope, is_system_role)
						VALUES ($1, 'PARENT', 'Parent', 'COLLEGE', true)
						ON CONFLICT (role_code) DO NOTHING
					`, roleID)
					if err != nil {
						return fmt.Errorf("failed to ensure parent role: %w", err)
					}
					_ = tx.QueryRow(txCtx, `SELECT role_id FROM platform.roles WHERE role_code = 'PARENT'`).Scan(&roleID)
				}

				var userRoleID uuid.UUID
				err = tx.QueryRow(txCtx, `
					SELECT user_role_id FROM platform.user_roles
					WHERE user_id = $1 AND role_id = $2 AND college_id = $3
				`, userID, roleID, params.CollegeID).Scan(&userRoleID)
				if err != nil && errors.Is(err, pgx.ErrNoRows) {
					_, err = tx.Exec(txCtx, `
						INSERT INTO platform.user_roles (user_role_id, user_id, role_id, college_id, status)
						VALUES (gen_random_uuid(), $1, $2, $3, 'ACTIVE')
					`, userID, roleID, params.CollegeID)
					if err != nil {
						return fmt.Errorf("failed to grant parent role: %w", err)
					}
				}

				// Bind UserID and insert parent profile
				params.UserID = &userID
				// Attach tx to context so repo uses the transaction
				repoWithTx := repository.WithTx(txCtx, tx)
				created, err := s.repo.CreateParent(repoWithTx, params)
				if err != nil {
					return err
				}
				createdParent = created
				return nil
			})

			if txErr != nil {
				if errors.Is(txErr, repository.ErrConflict) {
					return models.Parent{}, ErrParentConflict
				}
				return models.Parent{}, txErr
			}

			return createdParent, nil
		}
	}

	parent, err := s.repo.CreateParent(ctx, params)
	if err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return models.Parent{}, ErrParentConflict
		}
		return models.Parent{}, err
	}

	return parent, nil
}

func (s *ParentService) UpdateParent(
	ctx context.Context,
	params repository.UpdateParentParams,
) (models.Parent, error) {
	if params.CollegeID == uuid.Nil {
		return models.Parent{}, ErrInvalidParentCollegeID
	}

	if params.ID == uuid.Nil {
		return models.Parent{}, ErrInvalidParentID
	}

	params.FirstName = strings.TrimSpace(params.FirstName)
	if err := validators.ValidateParentInput(params.FirstName); err != nil {
		return models.Parent{}, ErrInvalidParentFirstName
	}

	normalizeParentUpdatePointers(&params)

	parent, err := s.repo.UpdateParent(ctx, params)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return models.Parent{}, ErrParentNotFound
		}
		if errors.Is(err, repository.ErrConflict) {
			return models.Parent{}, ErrParentConflict
		}
		return models.Parent{}, err
	}

	return parent, nil
}

func normalizeParentPointers(params *repository.CreateParentParams) {
	normalizeStringPointer(&params.MiddleName)
	normalizeStringPointer(&params.LastName)
	normalizeStringPointer(&params.Relationship)
	normalizeStringPointer(&params.Phone)
	normalizeStringPointer(&params.AlternatePhone)
	normalizeStringPointer(&params.Email)
	normalizeStringPointer(&params.Occupation)
	normalizeStringPointer(&params.AddressLine1)
	normalizeStringPointer(&params.AddressLine2)
	normalizeStringPointer(&params.City)
	normalizeStringPointer(&params.State)
	normalizeStringPointer(&params.PostalCode)
	normalizeStringPointer(&params.Country)
}

func normalizeParentUpdatePointers(params *repository.UpdateParentParams) {
	normalizeStringPointer(&params.MiddleName)
	normalizeStringPointer(&params.LastName)
	normalizeStringPointer(&params.Relationship)
	normalizeStringPointer(&params.Phone)
	normalizeStringPointer(&params.AlternatePhone)
	normalizeStringPointer(&params.Email)
	normalizeStringPointer(&params.Occupation)
	normalizeStringPointer(&params.AddressLine1)
	normalizeStringPointer(&params.AddressLine2)
	normalizeStringPointer(&params.City)
	normalizeStringPointer(&params.State)
	normalizeStringPointer(&params.PostalCode)
	normalizeStringPointer(&params.Country)
}

func normalizeStringPointer(value **string) {
	if value == nil || *value == nil {
		return
	}
	trimmed := strings.TrimSpace(**value)
	if trimmed == "" {
		*value = nil
		return
	}
	*value = &trimmed
}

func (s *ParentService) IsParentNotFound(err error) bool {
	return errors.Is(err, ErrParentNotFound)
}

func (s *ParentService) IsParentConflict(err error) bool {
	return errors.Is(err, ErrParentConflict)
}

