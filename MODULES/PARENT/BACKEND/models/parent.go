package models

import (
	"time"

	"github.com/google/uuid"
)

// Parent represents a parent or guardian record in the HMS college ecosystem.
type Parent struct {
	ID             uuid.UUID  `json:"id"`
	CollegeID      uuid.UUID  `json:"college_id"`
	UserID         *uuid.UUID `json:"user_id,omitempty"`
	FirstName      string     `json:"first_name"`
	MiddleName     *string    `json:"middle_name,omitempty"`
	LastName       *string    `json:"last_name,omitempty"`
	Relationship   *string    `json:"relationship,omitempty"`
	Phone          *string    `json:"phone,omitempty"`
	AlternatePhone *string    `json:"alternate_phone,omitempty"`
	Email          *string    `json:"email,omitempty"`
	Occupation     *string    `json:"occupation,omitempty"`
	AddressLine1   *string    `json:"address_line1,omitempty"`
	AddressLine2   *string    `json:"address_line2,omitempty"`
	City           *string    `json:"city,omitempty"`
	State          *string    `json:"state,omitempty"`
	PostalCode     *string    `json:"postal_code,omitempty"`
	Country        *string    `json:"country,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// ListParentsParams defines the query filtering and pagination for listing parents.
type ListParentsParams struct {
	CollegeID uuid.UUID
	Limit     int
	Offset    int
}

// CreateParentParams defines fields required to create a parent, including optional auth credentials.
type CreateParentParams struct {
	CollegeID       uuid.UUID
	UserID          *uuid.UUID
	FirstName       string
	MiddleName      *string
	LastName        *string
	Relationship    *string
	Phone           *string
	AlternatePhone  *string
	Email           *string
	Password        *string
	ConfirmPassword *string
	Occupation      *string
	AddressLine1    *string
	AddressLine2    *string
	City            *string
	State           *string
	PostalCode      *string
	Country         *string
}

// UpdateParentParams defines the modifiable fields of an existing parent profile.
type UpdateParentParams struct {
	ID             uuid.UUID
	CollegeID      uuid.UUID
	FirstName      string
	MiddleName     *string
	LastName       *string
	Relationship   *string
	Phone          *string
	AlternatePhone *string
	Email          *string
	Occupation     *string
	AddressLine1   *string
	AddressLine2   *string
	City           *string
	State          *string
	PostalCode     *string
	Country        *string
}

// Type aliases for API compatibility
type CreateParentInput = CreateParentParams
type UpdateParentInput = UpdateParentParams


