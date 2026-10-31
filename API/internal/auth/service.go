package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

type Service struct {
	repository *repository.Repository
	jwt        *JWTService
	logger     *zap.Logger
}

func NewService(
	repo *repository.Repository,
	jwtService *JWTService,
	logger *zap.Logger,
) *Service {
	return &Service{
		repository: repo,
		jwt:        jwtService,
		logger:     logger,
	}
}

type LoginRequest struct {
	Email     string
	Password  string
	IPAddress string
	UserAgent string
}

type LoginResult struct {
	UserID      uuid.UUID
	Email       string
	MFAEnabled  bool
	AccessToken string
	ExpiresAt   time.Time
	Membership  repository.AuthMembership
}

func (s *Service) recordLoginEvent(
	_ context.Context,
	result string,
	userID *uuid.UUID,
	collegeID *uuid.UUID,
	req LoginRequest,
) {
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		err := s.repository.RecordLoginEvent(
			bgCtx,
			repository.LoginEvent{
				UserID:    userID,
				CollegeID: collegeID,
				Result:    result,
				IPAddress: req.IPAddress,
				UserAgent: req.UserAgent,
			},
		)

		if err != nil && s.logger != nil {
			s.logger.Error(
				"failed to record login event",
				zap.String("result", result),
				zap.Error(err),
			)
		}
	}()
}

func (s *Service) Login(
	ctx context.Context,
	req LoginRequest,
) (*LoginResult, error) {
	email := strings.TrimSpace(strings.ToLower(req.Email))

	if email == "" {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"email is required",
		)
	}

	if req.Password == "" {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"password is required",
		)
	}

	identityStart := time.Now()
	identity, err := s.repository.FindAuthIdentityByEmail(
		ctx,
		email,
	)
	identityTime := time.Since(identityStart)
	
	if s.logger != nil {
		s.logger.Debug(
			"auth_timing_identity_lookup",
			zap.Duration("duration_ms", identityTime),
		)
	}
	
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			s.recordLoginEvent(ctx, "FAILED", nil, nil, req)
			return nil, apierrors.New(
				apierrors.Unauthorized,
				"invalid email or password",
			)
		}

		return nil, fmt.Errorf(
			"failed to load authentication identity: %w",
			err,
		)
	}

	if identity.UserStatus != "ACTIVE" {
		switch identity.UserStatus {
		case "LOCKED":
			userID := identity.UserID
			s.recordLoginEvent(ctx, "LOCKED", &userID, nil, req)
			return nil, apierrors.New(
				apierrors.Unauthorized,
				"user account is locked",
			)

		case "SUSPENDED":
			userID := identity.UserID
			s.recordLoginEvent(ctx, "BLOCKED", &userID, nil, req)
			return nil, apierrors.New(
				apierrors.Unauthorized,
				"user account is suspended",
			)

		case "DEACTIVATED":
			userID := identity.UserID
			s.recordLoginEvent(ctx, "BLOCKED", &userID, nil, req)
			return nil, apierrors.New(
				apierrors.Unauthorized,
				"user account is deactivated",
			)

		case "INVITED":
			userID := identity.UserID
			s.recordLoginEvent(ctx, "BLOCKED", &userID, nil, req)
			return nil, apierrors.New(
				apierrors.Unauthorized,
				"user account has not been activated",
			)

		default:
			return nil, apierrors.New(
				apierrors.Unauthorized,
				"user account is not active",
			)
		}
	}

	if identity.PasswordHash == nil ||
		strings.TrimSpace(*identity.PasswordHash) == "" {
		userID := identity.UserID
		s.recordLoginEvent(ctx, "FAILED", &userID, nil, req)
		return nil, apierrors.New(
			apierrors.Unauthorized,
			"invalid email or password",
		)
	}

	if err := bcrypt.CompareHashAndPassword(
		[]byte(*identity.PasswordHash),
		[]byte(req.Password),
	); err != nil {
		if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
			userID := identity.UserID
			s.recordLoginEvent(ctx, "FAILED", &userID, nil, req)
			return nil, apierrors.New(
				apierrors.Unauthorized,
				"invalid email or password",
			)
		}

		return nil, fmt.Errorf(
			"failed to verify password: %w",
			err,
		)
	}

	// MFA enforcement: never issue a normal access token
	// until the user's second factor has been verified.
	// The MFA verification flow is not implemented yet, so
	// fail closed for accounts with MFA enabled.
	if identity.MFAEnabled {
		return nil, apierrors.New(
			apierrors.Unauthorized,
			"MFA verification required; second-factor verification is not yet available",
		)
	}

	if len(identity.Memberships) == 0 {
		return nil, apierrors.New(
			apierrors.Forbidden,
			"user has no active role membership",
		)
	}

	membership, err := selectLoginMembership(
		identity.Memberships,
	)
	if err != nil {
		return nil, err
	}

	if membership.RoleScope == repositoryRoleScopeCollege {
		if membership.CollegeID == nil ||
			*membership.CollegeID == uuid.Nil {
			return nil, apierrors.New(
				apierrors.Forbidden,
				"college membership does not have a valid college",
			)
		}

		// Verify application is enabled and not suspended for this college
		if err := s.checkCollegeApplicationAccess(ctx, *membership.CollegeID, membership.RoleCode); err != nil {
			userID := identity.UserID
			s.recordLoginEvent(ctx, "BLOCKED", &userID, membership.CollegeID, req)
			return nil, err
		}

		accessToken, err := s.jwt.GenerateCollegeAccessToken(
			identity.UserID,
			*membership.CollegeID,
			membership.RoleCode,
		)
		if err != nil {
			return nil, fmt.Errorf(
				"failed to generate college access token: %w",
				err,
			)
		}

		userID := identity.UserID
		s.recordLoginEvent(
			ctx,
			"SUCCESS",
			&userID,
			membership.CollegeID,
			req,
		)

		return &LoginResult{
			UserID:      identity.UserID,
			Email:       valueOrEmpty(identity.Email),
			MFAEnabled:  identity.MFAEnabled,
			AccessToken: accessToken,
			ExpiresAt:   time.Now().Add(s.jwt.Duration),
			Membership:  membership,
		}, nil
	}

	if membership.RoleScope == repositoryRoleScopePlatform {
		if membership.RoleCode != "SUPER_ADMIN" {
			return nil, apierrors.New(
				apierrors.Forbidden,
				"unsupported platform role",
			)
		}

		accessToken, err := s.jwt.GeneratePlatformAccessToken(
			identity.UserID,
			membership.RoleCode,
		)
		if err != nil {
			return nil, fmt.Errorf(
				"failed to generate platform access token: %w",
				err,
			)
		}

		userID := identity.UserID
		s.recordLoginEvent(
			ctx,
			"SUCCESS",
			&userID,
			nil,
			req,
		)

		return &LoginResult{
			UserID:      identity.UserID,
			Email:       valueOrEmpty(identity.Email),
			MFAEnabled:  identity.MFAEnabled,
			AccessToken: accessToken,
			ExpiresAt:   time.Now().Add(s.jwt.Duration),
			Membership:  membership,
		}, nil
	}

	return nil, apierrors.New(
		apierrors.Forbidden,
		"unsupported role scope",
	)
}

const (
	repositoryRoleScopeCollege  = "COLLEGE"
	repositoryRoleScopePlatform = "PLATFORM"
)

func selectLoginMembership(
	memberships []repository.AuthMembership,
) (repository.AuthMembership, error) {
	if len(memberships) == 1 {
		return memberships[0], nil
	}

	var platformMemberships []repository.AuthMembership
	var collegeMemberships []repository.AuthMembership

	for _, membership := range memberships {
		switch membership.RoleScope {
		case repositoryRoleScopePlatform:
			platformMemberships = append(
				platformMemberships,
				membership,
			)

		case repositoryRoleScopeCollege:
			collegeMemberships = append(
				collegeMemberships,
				membership,
			)
		}
	}

	// Priority 1: If user has SUPER_ADMIN (platform scope), always select it
	if len(platformMemberships) >= 1 {
		for _, m := range platformMemberships {
			if m.RoleCode == "SUPER_ADMIN" {
				return m, nil
			}
		}
		// Fallback to first platform membership if SUPER_ADMIN not found
		if len(platformMemberships) > 0 {
			return platformMemberships[0], nil
		}
	}

	// Priority 2: If only college memberships, select the first one
	if len(collegeMemberships) > 0 {
		return collegeMemberships[0], nil
	}

	// Should not reach here
	return repository.AuthMembership{}, apierrors.New(
		apierrors.Forbidden,
		"no valid active membership found",
	)
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}

	return *value
}

// checkCollegeApplicationAccess verifies that the application mapped to the given role is enabled
// and not suspended for the college in platform.college_settings.
func (s *Service) checkCollegeApplicationAccess(
	ctx context.Context,
	collegeID uuid.UUID,
	roleCode string,
) error {
	appID := models.MapRoleToAppID(roleCode)
	if appID == "" || s.repository == nil || s.repository.Pool == nil {
		return nil
	}

	var status string
	err := s.repository.Pool.QueryRow(
		ctx,
		`SELECT setting_value->>'status' FROM platform.college_settings WHERE college_id = $1 AND setting_key = $2`,
		collegeID,
		"app_config."+appID,
	).Scan(&status)

	if err != nil {
		// No explicit override, default is enabled
		return nil
	}

	if status == models.AppStatusDisabled {
		return apierrors.New(
			apierrors.Forbidden,
			"This application is currently disabled for this institution",
		)
	}

	if status == models.AppStatusSuspended {
		return apierrors.New(
			apierrors.Forbidden,
			"This application has been temporarily suspended by system administration",
		)
	}

	return nil
}
