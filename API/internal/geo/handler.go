package geo

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// GetDistricts handles GET /geo/districts
func (h *Handler) GetDistricts(c *gin.Context) {
	districts, err := h.service.GetDistricts(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "INTERNAL_ERROR", "message": err.Error()}})
		return
	}
	response.OK(c, districts)
}

// GetSubdistricts handles GET /geo/subdistricts?district_code=...
func (h *Handler) GetSubdistricts(c *gin.Context) {
	districtCode := c.Query("district_code")
	if districtCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": "district_code is required"}})
		return
	}

	subdistricts, err := h.service.GetSubdistrictsByDistrict(c.Request.Context(), districtCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "INTERNAL_ERROR", "message": err.Error()}})
		return
	}
	response.OK(c, subdistricts)
}

// GetBlocks handles GET /geo/blocks?district_code=...
func (h *Handler) GetBlocks(c *gin.Context) {
	districtCode := c.Query("district_code")
	if districtCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": "district_code is required"}})
		return
	}

	blocks, err := h.service.GetBlocksByDistrict(c.Request.Context(), districtCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "INTERNAL_ERROR", "message": err.Error()}})
		return
	}
	response.OK(c, blocks)
}

// GetVillages handles GET /geo/villages?district_code=...&subdistrict_code=...&block_code=...&search=...&limit=...&offset=...
func (h *Handler) GetVillages(c *gin.Context) {
	districtCode := c.Query("district_code")
	subdistrictCode := c.Query("subdistrict_code")
	blockCode := c.Query("block_code")
	search := c.Query("search")

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	villages, total, err := h.service.GetVillages(c.Request.Context(), districtCode, subdistrictCode, blockCode, search, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "INTERNAL_ERROR", "message": err.Error()}})
		return
	}
	response.WithMeta(c, http.StatusOK, villages, gin.H{
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetUrbanLocalBodies handles GET /geo/urban-local-bodies?district_code=...
func (h *Handler) GetUrbanLocalBodies(c *gin.Context) {
	districtCode := c.Query("district_code")
	if districtCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": "district_code is required"}})
		return
	}

	ulbs, err := h.service.GetUrbanLocalBodiesByDistrict(c.Request.Context(), districtCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "INTERNAL_ERROR", "message": err.Error()}})
		return
	}
	response.OK(c, ulbs)
}

// GetUrbanWards handles GET /geo/urban-wards?local_body_code=...
func (h *Handler) GetUrbanWards(c *gin.Context) {
	localBodyCode := c.Query("local_body_code")
	if localBodyCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": "local_body_code is required"}})
		return
	}

	wards, err := h.service.GetUrbanWardsByLocalBody(c.Request.Context(), localBodyCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "INTERNAL_ERROR", "message": err.Error()}})
		return
	}
	response.OK(c, wards)
}

// GetUrbanCityAreas handles GET /geo/urban-city-areas?district_code=...&city_code=...
func (h *Handler) GetUrbanCityAreas(c *gin.Context) {
	districtCode := c.Query("district_code")
	cityCode := c.Query("city_code")

	areas, err := h.service.GetUrbanCityAreas(c.Request.Context(), districtCode, cityCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "INTERNAL_ERROR", "message": err.Error()}})
		return
	}
	response.OK(c, areas)
}

// GetRuralHierarchy handles GET /geo/rural-hierarchy?district_code=...&block_code=...&limit=...&offset=...
func (h *Handler) GetRuralHierarchy(c *gin.Context) {
	districtCode := c.Query("district_code")
	blockCode := c.Query("block_code")

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	hierarchy, total, err := h.service.GetRuralHierarchy(c.Request.Context(), districtCode, blockCode, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "INTERNAL_ERROR", "message": err.Error()}})
		return
	}
	response.WithMeta(c, http.StatusOK, hierarchy, gin.H{
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}
