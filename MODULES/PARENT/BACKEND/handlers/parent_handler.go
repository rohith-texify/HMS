package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/services"
)

// ParentHandler handles HTTP requests for parent profiles.
type ParentHandler struct {
	service *services.ParentService
}

// NewParentHandler constructs a ParentHandler.
func NewParentHandler(
	parentService *services.ParentService,
) *ParentHandler {
	return &ParentHandler{
		service: parentService,
	}
}

type parentRequest struct {
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

// ListParents handles GET /parents.
func (h *ParentHandler) ListParents(c *gin.Context) {
	collegeID, err := getTenantCollegeID(c)
	if err != nil {
		writeError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	limit := 50
	offset := 0

	if rawLimit := c.Query("limit"); rawLimit != "" {
		parsed, err := strconv.Atoi(rawLimit)
		if err != nil {
			writeError(c, http.StatusBadRequest, "invalid limit")
			return
		}
		limit = parsed
	}

	if rawOffset := c.Query("offset"); rawOffset != "" {
		parsed, err := strconv.Atoi(rawOffset)
		if err != nil {
			writeError(c, http.StatusBadRequest, "invalid offset")
			return
		}
		offset = parsed
	}

	parents, err := h.service.ListParents(c.Request.Context(), collegeID, limit, offset)
	if err != nil {
		respondParentError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": parents})
}

// GetParent handles GET /parents/:parent_id.
func (h *ParentHandler) GetParent(c *gin.Context) {
	collegeID, err := getTenantCollegeID(c)
	if err != nil {
		writeError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	parentID, err := uuid.Parse(strings.TrimSpace(c.Param("parent_id")))
	if err != nil {
		writeError(c, http.StatusBadRequest, "invalid parent id")
		return
	}

	parent, err := h.service.GetParentByID(c.Request.Context(), collegeID, parentID)
	if err != nil {
		respondParentError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": parent})
}

// CreateParent handles POST /parents.
func (h *ParentHandler) CreateParent(c *gin.Context) {
	collegeID, err := getTenantCollegeID(c)
	if err != nil {
		writeError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	var request parentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		writeError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	parent, err := h.service.CreateParent(
		c.Request.Context(),
		models.CreateParentParams{
			CollegeID:       collegeID,
			UserID:          request.UserID,
			FirstName:       request.FirstName,
			MiddleName:      request.MiddleName,
			LastName:        request.LastName,
			Relationship:    request.Relationship,
			Phone:           request.Phone,
			AlternatePhone:  request.AlternatePhone,
			Email:           request.Email,
			Password:        request.Password,
			ConfirmPassword: request.ConfirmPassword,
			Occupation:      request.Occupation,
			AddressLine1:    request.AddressLine1,
			AddressLine2:    request.AddressLine2,
			City:            request.City,
			State:           request.State,
			PostalCode:      request.PostalCode,
			Country:         request.Country,
		},
	)
	if err != nil {
		respondParentError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": parent})
}

// UpdateParent handles PUT /parents/:parent_id.
func (h *ParentHandler) UpdateParent(c *gin.Context) {
	collegeID, err := getTenantCollegeID(c)
	if err != nil {
		writeError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	parentID, err := uuid.Parse(strings.TrimSpace(c.Param("parent_id")))
	if err != nil {
		writeError(c, http.StatusBadRequest, "invalid parent id")
		return
	}

	var request parentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		writeError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	parent, err := h.service.UpdateParent(
		c.Request.Context(),
		models.UpdateParentParams{
			ID:             parentID,
			CollegeID:      collegeID,
			FirstName:      request.FirstName,
			MiddleName:     request.MiddleName,
			LastName:       request.LastName,
			Relationship:   request.Relationship,
			Phone:          request.Phone,
			AlternatePhone: request.AlternatePhone,
			Email:          request.Email,
			Occupation:     request.Occupation,
			AddressLine1:   request.AddressLine1,
			AddressLine2:   request.AddressLine2,
			City:           request.City,
			State:          request.State,
			PostalCode:     request.PostalCode,
			Country:        request.Country,
		},
	)
	if err != nil {
		respondParentError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": parent})
}

