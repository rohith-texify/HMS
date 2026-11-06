package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	apiresponse "github.com/yourusername/hostel-management-system/API/pkg/response"
	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/services"
)

type ParentHandler struct {
	service *services.ParentService
}

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

func (h *ParentHandler) ListParents(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		writeParentError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	limit := 50
	offset := 0

	if rawLimit := c.Query("limit"); rawLimit != "" {
		parsed, err := strconv.Atoi(rawLimit)
		if err != nil {
			writeParentError(c, http.StatusBadRequest, "invalid limit")
			return
		}
		limit = parsed
	}

	if rawOffset := c.Query("offset"); rawOffset != "" {
		parsed, err := strconv.Atoi(rawOffset)
		if err != nil {
			writeParentError(c, http.StatusBadRequest, "invalid offset")
			return
		}
		offset = parsed
	}

	parents, err := h.service.ListParents(c.Request.Context(), collegeID, limit, offset)
	if err != nil {
		h.writeError(c, err)
		return
	}

	apiresponse.OK(c, parents)
}

func (h *ParentHandler) GetParent(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		writeParentError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	parentID, err := uuid.Parse(strings.TrimSpace(c.Param("parent_id")))
	if err != nil {
		writeParentError(c, http.StatusBadRequest, "invalid parent id")
		return
	}

	parent, err := h.service.GetParentByID(c.Request.Context(), collegeID, parentID)
	if err != nil {
		h.writeError(c, err)
		return
	}

	apiresponse.OK(c, parent)
}

func (h *ParentHandler) CreateParent(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		writeParentError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	var request parentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		writeParentError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	parent, err := h.service.CreateParent(
		c.Request.Context(),
		repository.CreateParentParams{
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
		h.writeError(c, err)
		return
	}

	apiresponse.Created(c, parent)
}

func (h *ParentHandler) UpdateParent(c *gin.Context) {
	collegeID, ok := getTenantID(c)
	if !ok {
		writeParentError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	parentID, err := uuid.Parse(strings.TrimSpace(c.Param("parent_id")))
	if err != nil {
		writeParentError(c, http.StatusBadRequest, "invalid parent id")
		return
	}

	var request parentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		writeParentError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	parent, err := h.service.UpdateParent(
		c.Request.Context(),
		repository.UpdateParentParams{
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
		h.writeError(c, err)
		return
	}

	apiresponse.OK(c, parent)
}

func (h *ParentHandler) writeError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, services.ErrInvalidParentID),
		errors.Is(err, services.ErrInvalidParentCollegeID),
		errors.Is(err, services.ErrInvalidParentFirstName),
		errors.Is(err, services.ErrInvalidParentPagination):

		writeParentError(c, http.StatusBadRequest, err.Error())

	case errors.Is(err, services.ErrParentNotFound):
		writeParentError(c, http.StatusNotFound, "parent not found")

	case errors.Is(err, services.ErrParentConflict):
		writeParentError(c, http.StatusConflict, "parent conflict")

	default:
		writeParentError(c, http.StatusInternalServerError, "internal server error")
	}
}

func writeParentError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"success": false, "error": gin.H{"message": message}})
}

