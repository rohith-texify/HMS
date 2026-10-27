package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/middleware"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
	"github.com/yourusername/hostel-management-system/API/internal/service"
	apiresponse "github.com/yourusername/hostel-management-system/API/pkg/response"
)

type GateHandler struct {
	service *service.GateService
}

func NewGateHandler(service *service.GateService) *GateHandler {
	return &GateHandler{
		service: service,
	}
}

func getCollegeIDFromContext(c *gin.Context) (uuid.UUID, bool) {
	value, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		return uuid.Nil, false
	}

	collegeID, ok := value.(uuid.UUID)
	return collegeID, ok && collegeID != uuid.Nil
}

func (h *GateHandler) List(c *gin.Context) {
	collegeID, ok := getCollegeIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	gates, err := h.service.ListGates(c.Request.Context(), collegeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	apiresponse.OK(c, gates)
}

func (h *GateHandler) Create(c *gin.Context) {
	collegeID, ok := getCollegeIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	var input service.CreateGateInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request body",
		})
		return
	}

	gate, err := h.service.CreateGate(
		c.Request.Context(),
		collegeID,
		input,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	apiresponse.Created(c, gate)
}

func (h *GateHandler) Get(c *gin.Context) {
	collegeID, ok := getCollegeIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	gateID, err := uuid.Parse(c.Param("gate_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid gate_id",
		})
		return
	}

	gate, err := h.service.GetGate(
		c.Request.Context(),
		collegeID,
		gateID,
	)
	if err != nil {
		if err == repository.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "gate not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	apiresponse.OK(c, gate)
}

func (h *GateHandler) Update(c *gin.Context) {
	collegeID, ok := getCollegeIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	gateID, err := uuid.Parse(c.Param("gate_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid gate_id",
		})
		return
	}

	var input service.UpdateGateInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request body",
		})
		return
	}

	gate, err := h.service.UpdateGate(
		c.Request.Context(),
		collegeID,
		gateID,
		input,
	)
	if err != nil {
		if err == repository.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "gate not found",
			})
			return
		}

		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	apiresponse.OK(c, gate)
}

func (h *GateHandler) UpdateStatus(c *gin.Context) {
	collegeID, ok := getCollegeIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	gateID, err := uuid.Parse(c.Param("gate_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid gate_id",
		})
		return
	}

	var input service.UpdateGateStatusInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request body",
		})
		return
	}

	gate, err := h.service.UpdateGateStatus(
		c.Request.Context(),
		collegeID,
		gateID,
		input,
	)
	if err != nil {
		if err == repository.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "gate not found",
			})
			return
		}

		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	apiresponse.OK(c, gate)
}
