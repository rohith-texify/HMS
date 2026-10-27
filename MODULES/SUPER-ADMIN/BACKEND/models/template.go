package models

import (
	"time"

	"github.com/google/uuid"
)

// EntitlementTemplate represents an entitlement plan template from platform.entitlement_templates.
type EntitlementTemplate struct {
	TemplateID   uuid.UUID `json:"template_id" db:"template_id"`
	TemplateCode string    `json:"template_code" db:"template_code"`
	Name         string    `json:"name" db:"name"`
	Description  *string   `json:"description,omitempty" db:"description"`
	Version      int       `json:"version" db:"version"`
	IsActive     bool      `json:"is_active" db:"is_active"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// CreateTemplateRequest represents the payload for creating a new entitlement template.
type CreateTemplateRequest struct {
	TemplateCode string  `json:"template_code" binding:"required"`
	Name         string  `json:"name" binding:"required"`
	Description  *string `json:"description,omitempty"`
	Version      int     `json:"version,omitempty"`
	IsActive     *bool   `json:"is_active,omitempty"`
}

// UpdateTemplateRequest represents the payload for updating an existing entitlement template.
type UpdateTemplateRequest struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	Version     *int    `json:"version,omitempty"`
	IsActive    *bool   `json:"is_active,omitempty"`
}

// ListTemplatesParams represents query parameters for listing entitlement templates.
type ListTemplatesParams struct {
	IsActive *bool `form:"is_active"`
	Limit    int   `form:"limit" binding:"omitempty,min=1,max=100"`
	Offset   int   `form:"offset" binding:"omitempty,min=0"`
}

// ApplyTemplateRequest represents a request to apply an entitlement template to a college.
type ApplyTemplateRequest struct {
	CollegeID  uuid.UUID `json:"college_id,omitempty" binding:"omitempty"`
	TemplateID uuid.UUID `json:"template_id" binding:"required"`
}
