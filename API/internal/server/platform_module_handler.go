package server

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/internal/service"
)

type PlatformModuleHandler struct {
	service *service.PlatformModuleService
}

func NewPlatformModuleHandler(
	svc *service.PlatformModuleService,
) *PlatformModuleHandler {
	return &PlatformModuleHandler{service: svc}
}

// ListModules handles GET /modules.
func (h *PlatformModuleHandler) ListModules(c *gin.Context) {
	params := service.ListModulesParams{
		Kind: c.Query("kind"),
	}

	if value := strings.TrimSpace(c.Query("is_active")); value != "" {
		active, err := strconv.ParseBool(value)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "INVALID_IS_ACTIVE",
					"message": "is_active must be true or false",
				},
			})
			return
		}
		params.IsActive = &active
	}

	if value := strings.TrimSpace(c.Query("limit")); value != "" {
		limit, err := strconv.Atoi(value)
		if err != nil || limit < 1 {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "INVALID_LIMIT",
					"message": "limit must be a positive integer",
				},
			})
			return
		}
		params.Limit = limit
	}

	if value := strings.TrimSpace(c.Query("offset")); value != "" {
		offset, err := strconv.Atoi(value)
		if err != nil || offset < 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "INVALID_OFFSET",
					"message": "offset must be zero or a positive integer",
				},
			})
			return
		}
		params.Offset = offset
	}

	result, err := h.service.ListModules(c.Request.Context(), params)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "MODULES_LIST_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result.Items,
		"meta": gin.H{
			"total":  result.Total,
			"limit":  result.Limit,
			"offset": result.Offset,
		},
	})
}

// GetModule handles GET /modules/:id.
func (h *PlatformModuleHandler) GetModule(c *gin.Context) {
	moduleID, err := uuid.Parse(c.Param("id"))
	if err != nil || moduleID == uuid.Nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_MODULE_ID",
				"message": "id must be a valid module UUID",
			},
		})
		return
	}

	module, err := h.service.GetModule(c.Request.Context(), moduleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) ||
			strings.Contains(err.Error(), "module not found") {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "MODULE_NOT_FOUND",
					"message": "module was not found",
				},
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "MODULE_FETCH_FAILED",
				"message": "failed to retrieve module",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    module,
	})
}
