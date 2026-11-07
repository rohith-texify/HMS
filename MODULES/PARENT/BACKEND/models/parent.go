package models

import (
	"time"

	"github.com/google/uuid"
)

// Parent represents a parent or guardian record in app.parents.
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

// StudentParent represents an association between a student and parent in app.student_parents.
type StudentParent struct {
	ID                      uuid.UUID `json:"id"`
	CollegeID               uuid.UUID `json:"college_id"`
	StudentID               uuid.UUID `json:"student_id"`
	ParentID                uuid.UUID `json:"parent_id"`
	Relationship            string    `json:"relationship"`
	IsPrimary               bool      `json:"is_primary"`
	CanReceiveNotifications bool      `json:"can_receive_notifications"`
	CanPickupStudent        bool      `json:"can_pickup_student"`
	CreatedAt               time.Time `json:"created_at"`
	UpdatedAt               time.Time `json:"updated_at"`
}

// CreateParentInput represents the payload to create a parent profile.
type CreateParentInput struct {
	CollegeID       uuid.UUID  `json:"college_id"`
	UserID          *uuid.UUID `json:"user_id,omitempty"`
	FirstName       string     `json:"first_name"`
	MiddleName      *string    `json:"middle_name,omitempty"`
	LastName        *string    `json:"last_name,omitempty"`
	Relationship    *string    `json:"relationship,omitempty"`
	Phone           *string    `json:"phone,omitempty"`
	AlternatePhone  *string    `json:"alternate_phone,omitempty"`
	Email           *string    `json:"email,omitempty"`
	Password        *string    `json:"password,omitempty"`
	ConfirmPassword *string    `json:"confirm_password,omitempty"`
	Occupation      *string    `json:"occupation,omitempty"`
	AddressLine1    *string    `json:"address_line1,omitempty"`
	AddressLine2    *string    `json:"address_line2,omitempty"`
	City            *string    `json:"city,omitempty"`
	State           *string    `json:"state,omitempty"`
	PostalCode      *string    `json:"postal_code,omitempty"`
	Country         *string    `json:"country,omitempty"`
}

// UpdateParentInput represents the payload to update a parent profile.
type UpdateParentInput struct {
	ID             uuid.UUID `json:"id"`
	CollegeID      uuid.UUID `json:"college_id"`
	FirstName      string    `json:"first_name"`
	MiddleName     *string   `json:"middle_name,omitempty"`
	LastName       *string   `json:"last_name,omitempty"`
	Relationship   *string   `json:"relationship,omitempty"`
	Phone          *string   `json:"phone,omitempty"`
	AlternatePhone *string   `json:"alternate_phone,omitempty"`
	Email          *string   `json:"email,omitempty"`
	Occupation     *string   `json:"occupation,omitempty"`
	AddressLine1   *string   `json:"address_line1,omitempty"`
	AddressLine2   *string   `json:"address_line2,omitempty"`
	City           *string   `json:"city,omitempty"`
	State          *string   `json:"state,omitempty"`
	PostalCode     *string   `json:"postal_code,omitempty"`
	Country        *string   `json:"country,omitempty"`
}

