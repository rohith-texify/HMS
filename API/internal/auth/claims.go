package auth

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	ClaimTenantID = "tenant_id"
	ClaimRole     = "role"
	ClaimScope    = "scope"
)

const (
	ScopeCollege  = "COLLEGE"
	ScopePlatform = "PLATFORM"
)

type Claims struct {
	TenantID *uuid.UUID `json:"tenant_id,omitempty"`
	Role     string     `json:"role"`
	Scope    string     `json:"scope"`

	jwt.RegisteredClaims
}

func NewCollegeClaims(
	userID uuid.UUID,
	tenantID uuid.UUID,
	role string,
	issuer string,
	audience string,
	expiresAt time.Time,
) *Claims {
	now := time.Now()

	return &Claims{
		TenantID: &tenantID,
		Role:     role,
		Scope:    ScopeCollege,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			Issuer:    issuer,
			Audience:  jwt.ClaimStrings{audience},
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
		},
	}
}

func NewPlatformClaims(
	userID uuid.UUID,
	role string,
	issuer string,
	audience string,
	expiresAt time.Time,
) *Claims {
	now := time.Now()

	return &Claims{
		TenantID: nil,
		Role:     role,
		Scope:    ScopePlatform,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			Issuer:    issuer,
			Audience:  jwt.ClaimStrings{audience},
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
		},
	}
}
