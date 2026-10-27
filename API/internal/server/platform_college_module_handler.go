package server

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/auth"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
	"github.com/yourusername/hostel-management-system/API/internal/service"
)

type PlatformCollegeModuleHandler struct {
	service *service.PlatformCollegeModuleService
}

func NewPlatformCollegeModuleHandler(
	svc *service.PlatformCollegeModuleService,
) *PlatformCollegeModuleHandler {
	return &PlatformCollegeModuleHandler{
		service: svc,
	}
}

func (h *PlatformCollegeModuleHandler) ListCollegeModules(
	c *gin.Context,
) {
	collegeIDParam := c.Param("college_id")

	collegeID, err := uuid.Parse(collegeIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_COLLEGE_ID",
				"message": "college_id must be a valid UUID",
			},
		})
		return
	}

	modules, err := h.service.ListCollegeModules(
		c.Request.Context(),
		collegeID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "COLLEGE_MODULES_FETCH_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"modules": modules,
		},
	})
}

type AssignCollegeModuleRequest struct {
	ModuleID      string  `json:"module_id"`
	Status        string  `json:"status"`
	Mode          string  `json:"mode"`
	EffectiveFrom *string `json:"effective_from,omitempty"`
	EffectiveTo   *string `json:"effective_to,omitempty"`
	ChangeReason  *string `json:"change_reason,omitempty"`
}

func (h *PlatformCollegeModuleHandler) AssignCollegeModule(c *gin.Context) {
	collegeID, err := uuid.Parse(c.Param("college_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_COLLEGE_ID",
				"message": "college_id must be a valid UUID",
			},
		})
		return
	}

	var req AssignCollegeModuleRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_REQUEST",
				"message": err.Error(),
			},
		})
		return
	}

	moduleID, err := uuid.Parse(req.ModuleID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_MODULE_ID",
				"message": "module_id must be a valid UUID",
			},
		})
		return
	}

	var effectiveFrom *time.Time

	if req.EffectiveFrom != nil && *req.EffectiveFrom != "" {
		value, err := time.Parse(time.RFC3339, *req.EffectiveFrom)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "INVALID_EFFECTIVE_FROM",
					"message": "effective_from must be RFC3339",
				},
			})
			return
		}

		effectiveFrom = &value
	}

	var effectiveTo *time.Time

	if req.EffectiveTo != nil && *req.EffectiveTo != "" {
		value, err := time.Parse(time.RFC3339, *req.EffectiveTo)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "INVALID_EFFECTIVE_TO",
					"message": "effective_to must be RFC3339",
				},
			})
			return
		}

		effectiveTo = &value
	}

	userIDVal, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "UNAUTHORIZED",
				"message": "authentication claims are missing",
			},
		})
		return
	}

	changedBy, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_USER_ID",
				"message": "authenticated user ID is invalid",
			},
		})
		return
	}

	var changeReason *string

	if req.ChangeReason != nil {
		value := strings.TrimSpace(*req.ChangeReason)

		if value != "" {
			changeReason = &value
		}
	}

	module, err := h.service.AssignCollegeModule(
		c.Request.Context(),
		collegeID,
		service.AssignCollegeModuleRequest{
			ModuleID:      moduleID,
			Status:        req.Status,
			Mode:          req.Mode,
			EffectiveFrom: effectiveFrom,
			EffectiveTo:   effectiveTo,
			ChangeReason:  changeReason,
			ChangedBy:     changedBy,
		},
	)

	if err != nil {
		if errors.Is(err, repository.ErrConflict) {
			c.JSON(http.StatusConflict, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "COLLEGE_MODULE_ALREADY_ASSIGNED",
					"message": "module is already assigned to this college",
				},
			})
			return
		}

		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "COLLEGE_MODULE_ASSIGNMENT_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data": gin.H{
			"module": module,
		},
	})
}

func (h *PlatformCollegeModuleHandler) GetCollegeEntitlements(
	c *gin.Context,
) {
	collegeID, err := uuid.Parse(c.Param("college_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_COLLEGE_ID",
				"message": "college_id must be a valid UUID",
			},
		})
		return
	}

	modules, err := h.service.ListCollegeModules(
		c.Request.Context(),
		collegeID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "COLLEGE_ENTITLEMENTS_FETCH_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"college_id":   collegeID,
			"entitlements": modules,
		},
	})
}

func (h *PlatformCollegeModuleHandler) UpdateCollegeEntitlement(
	c *gin.Context,
) {
	collegeID, err := uuid.Parse(c.Param("college_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_COLLEGE_ID",
				"message": "college_id must be a valid UUID",
			},
		})
		return
	}

	var req AssignCollegeModuleRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_REQUEST",
				"message": err.Error(),
			},
		})
		return
	}

	moduleID, err := uuid.Parse(req.ModuleID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_MODULE_ID",
				"message": "module_id must be a valid UUID",
			},
		})
		return
	}

	if req.EffectiveFrom == nil || strings.TrimSpace(*req.EffectiveFrom) == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_EFFECTIVE_FROM",
				"message": "effective_from is required",
			},
		})
		return
	}

	effectiveFrom, err := time.Parse(
		time.RFC3339,
		strings.TrimSpace(*req.EffectiveFrom),
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_EFFECTIVE_FROM",
				"message": "effective_from must be RFC3339",
			},
		})
		return
	}

	var effectiveTo *time.Time

	if req.EffectiveTo != nil &&
		strings.TrimSpace(*req.EffectiveTo) != "" {

		value, err := time.Parse(
			time.RFC3339,
			strings.TrimSpace(*req.EffectiveTo),
		)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "INVALID_EFFECTIVE_TO",
					"message": "effective_to must be RFC3339",
				},
			})
			return
		}

		effectiveTo = &value
	}

	userIDVal, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "UNAUTHORIZED",
				"message": "authentication user ID is missing",
			},
		})
		return
	}

	changedBy, ok := userIDVal.(uuid.UUID)
	if !ok || changedBy == uuid.Nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_USER_ID",
				"message": "authenticated user ID is invalid",
			},
		})
		return
	}

	var changeReason *string

	if req.ChangeReason != nil {
		value := strings.TrimSpace(*req.ChangeReason)

		if value != "" {
			changeReason = &value
		}
	}

	module, err := h.service.UpdateCollegeEntitlement(
		c.Request.Context(),
		collegeID,
		service.AssignCollegeModuleRequest{
			ModuleID:      moduleID,
			Status:        req.Status,
			Mode:          req.Mode,
			EffectiveFrom: &effectiveFrom,
			EffectiveTo:   effectiveTo,
			ChangeReason:  changeReason,
			ChangedBy:     changedBy,
		},
	)

	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "COLLEGE_ENTITLEMENT_NOT_FOUND",
					"message": "module entitlement was not found for this college",
				},
			})
			return
		}

		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "COLLEGE_ENTITLEMENT_UPDATE_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"entitlement": module,
		},
	})
}
