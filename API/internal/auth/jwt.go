package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type JWTService struct {
	Secret   string
	Issuer   string
	Audience string
	Duration time.Duration
}

func NewJWTService(
	secret string,
	issuer string,
	audience string,
	duration time.Duration,
) *JWTService {
	return &JWTService{
		Secret:   secret,
		Issuer:   issuer,
		Audience: audience,
		Duration: duration,
	}
}

func (s *JWTService) GenerateCollegeAccessToken(
	userID uuid.UUID,
	tenantID uuid.UUID,
	role string,
) (string, error) {
	if s.Secret == "" {
		return "", fmt.Errorf("JWT secret is not configured")
	}

	if userID == uuid.Nil {
		return "", fmt.Errorf("user ID is required")
	}

	if tenantID == uuid.Nil {
		return "", fmt.Errorf("tenant ID is required for college token")
	}

	if role == "" {
		return "", fmt.Errorf("role is required")
	}

	if s.Duration <= 0 {
		return "", fmt.Errorf("JWT duration must be greater than zero")
	}

	now := time.Now()
	expiresAt := now.Add(s.Duration)

	claims := NewCollegeClaims(
		userID,
		tenantID,
		role,
		s.Issuer,
		s.Audience,
		expiresAt,
	)

	token := jwt.NewWithClaims(
		jwt.SigningMethodHS256,
		claims,
	)

	signedToken, err := token.SignedString(
		[]byte(s.Secret),
	)
	if err != nil {
		return "", fmt.Errorf(
			"failed to sign college access token: %w",
			err,
		)
	}

	return signedToken, nil
}

func (s *JWTService) GeneratePlatformAccessToken(
	userID uuid.UUID,
	role string,
) (string, error) {
	if s.Secret == "" {
		return "", fmt.Errorf("JWT secret is not configured")
	}

	if userID == uuid.Nil {
		return "", fmt.Errorf("user ID is required")
	}

	if role == "" {
		return "", fmt.Errorf("role is required")
	}

	if s.Duration <= 0 {
		return "", fmt.Errorf("JWT duration must be greater than zero")
	}

	now := time.Now()
	expiresAt := now.Add(s.Duration)

	claims := NewPlatformClaims(
		userID,
		role,
		s.Issuer,
		s.Audience,
		expiresAt,
	)

	token := jwt.NewWithClaims(
		jwt.SigningMethodHS256,
		claims,
	)

	signedToken, err := token.SignedString(
		[]byte(s.Secret),
	)
	if err != nil {
		return "", fmt.Errorf(
			"failed to sign platform access token: %w",
			err,
		)
	}

	return signedToken, nil
}

func (s *JWTService) ValidateAccessToken(
	tokenString string,
) (*Claims, error) {
	if s.Secret == "" {
		return nil, fmt.Errorf("JWT secret is not configured")
	}

	if tokenString == "" {
		return nil, fmt.Errorf("access token is required")
	}

	token, err := jwt.ParseWithClaims(
		tokenString,
		&Claims{},
		func(token *jwt.Token) (interface{}, error) {
			if token.Method != jwt.SigningMethodHS256 {
				return nil, fmt.Errorf(
					"unexpected signing method: %v",
					token.Header["alg"],
				)
			}

			return []byte(s.Secret), nil
		},
		jwt.WithIssuer(s.Issuer),
		jwt.WithAudience(s.Audience),
	)

	if err != nil {
		return nil, fmt.Errorf(
			"invalid access token: %w",
			err,
		)
	}

	claims, ok := token.Claims.(*Claims)
	if !ok {
		return nil, fmt.Errorf(
			"invalid access token claims",
		)
	}

	if !token.Valid {
		return nil, fmt.Errorf(
			"invalid access token",
		)
	}

	if claims.Subject == "" {
		return nil, fmt.Errorf(
			"access token does not contain a user ID",
		)
	}

	switch claims.Scope {
	case ScopeCollege:
		if claims.TenantID == nil ||
			*claims.TenantID == uuid.Nil {
			return nil, fmt.Errorf(
				"college access token does not contain a valid tenant ID",
			)
		}

	case ScopePlatform:
		if claims.TenantID != nil {
			return nil, fmt.Errorf(
				"platform access token must not contain a tenant ID",
			)
		}

	default:
		return nil, fmt.Errorf(
			"access token contains an invalid scope",
		)
	}

	if claims.Role == "" {
		return nil, fmt.Errorf(
			"access token does not contain a role",
		)
	}

	return claims, nil
}
