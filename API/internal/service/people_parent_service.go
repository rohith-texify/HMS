package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/yourusername/hostel-management-system/API/internal/database"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
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
	db         *database.Database
	repository *repository.Repository
}

func NewParentService(
	db *database.Database,
	repository *repository.Repository,
) *ParentService {
	return &ParentService{
		db:         db,
		repository: repository,
	}
}

func (s *ParentService) ListParents(
	ctx context.Context,
	collegeID uuid.UUID,
	limit int,
	offset int,
) ([]repository.Parent, error) {
	if collegeID == uuid.Nil {
		return nil, ErrInvalidParentCollegeID
	}

	if limit <= 0 || limit > 100 {
		return nil, ErrInvalidParentPagination
	}

	if offset < 0 {
		return nil, ErrInvalidParentPagination
	}

	return s.repository.ListParents(
		ctx,
		repository.ListParentsParams{
			CollegeID: collegeID,
			Limit:     limit,
			Offset:    offset,
		},
	)
}

func (s *ParentService) GetParentByID(
	ctx context.Context,
	collegeID uuid.UUID,
	parentID uuid.UUID,
) (repository.Parent, error) {
	if collegeID == uuid.Nil {
		return repository.Parent{}, ErrInvalidParentCollegeID
	}

	if parentID == uuid.Nil {
		return repository.Parent{}, ErrInvalidParentID
	}

	parent, err := s.repository.GetParentByID(
		ctx,
		collegeID,
		parentID,
	)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return repository.Parent{}, ErrParentNotFound
		}
		return repository.Parent{}, err
	}

	return parent, nil
}

func (s *ParentService) CreateParent(
	ctx context.Context,
	params repository.CreateParentParams,
) (repository.Parent, error) {
	if params.CollegeID == uuid.Nil {
		return repository.Parent{}, ErrInvalidParentCollegeID
	}

	params.FirstName = strings.TrimSpace(params.FirstName)

	if params.FirstName == "" {
		return repository.Parent{}, ErrInvalidParentFirstName
	}

	normalizeParentPointers(&params)

	// If password is provided, provision parent user account and assign PARENT role
	if params.Password != nil && strings.TrimSpace(*params.Password) != "" {
		pwd := strings.TrimSpace(*params.Password)
		if len(pwd) < 8 {
			return repository.Parent{}, errors.New("password must be at least 8 characters long")
		}

		if params.ConfirmPassword != nil && strings.TrimSpace(*params.ConfirmPassword) != "" {
			if pwd != strings.TrimSpace(*params.ConfirmPassword) {
				return repository.Parent{}, errors.New("password and confirm password do not match")
			}
		}

		if params.Email == nil || strings.TrimSpace(*params.Email) == "" {
			return repository.Parent{}, errors.New("email address is required to create parent portal login credentials")
		}

		email := strings.ToLower(strings.TrimSpace(*params.Email))

		hash, err := bcrypt.GenerateFromPassword([]byte(pwd), bcrypt.DefaultCost)
		if err != nil {
			return repository.Parent{}, fmt.Errorf("failed to hash parent password: %w", err)
		}

		var createdParent repository.Parent

		if s.db != nil {
			txErr := s.db.WithTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
				// 0. Concurrency-Safe Parent Quota Enforcement
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

				// 1. Check or insert into app.users
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

				// 2. Ensure PARENT role exists and assign user_roles
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

				// 3. Bind UserID and insert parent profile
				params.UserID = &userID
				created, err := s.repository.CreateParent(txCtx, params)
				if err != nil {
					return err
				}
				createdParent = created
				return nil
			})

			if txErr != nil {
				if errors.Is(txErr, repository.ErrConflict) {
					return repository.Parent{}, ErrParentConflict
				}
				return repository.Parent{}, txErr
			}

			return createdParent, nil
		}
	}

	parent, err := s.repository.CreateParent(ctx, params)
	if err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return repository.Parent{}, ErrParentConflict
		}
		return repository.Parent{}, err
	}

	return parent, nil
}

func (s *ParentService) UpdateParent(
	ctx context.Context,
	params repository.UpdateParentParams,
) (repository.Parent, error) {
	if params.CollegeID == uuid.Nil {
		return repository.Parent{}, ErrInvalidParentCollegeID
	}

	if params.ID == uuid.Nil {
		return repository.Parent{}, ErrInvalidParentID
	}

	params.FirstName = strings.TrimSpace(params.FirstName)

	if params.FirstName == "" {
		return repository.Parent{}, ErrInvalidParentFirstName
	}

	normalizeParentUpdatePointers(&params)

	parent, err := s.repository.UpdateParent(ctx, params)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return repository.Parent{}, ErrParentNotFound
		}
		if errors.Is(err, repository.ErrConflict) {
			return repository.Parent{}, ErrParentConflict
		}
		return repository.Parent{}, err
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
