package geo

import "github.com/gin-gonic/gin"

// RegisterRoutes registers geo lookup routes on the provided router group
func RegisterRoutes(r *gin.RouterGroup, h *Handler) {
	geoGroup := r.Group("/geo")
	{
		geoGroup.GET("/districts", h.GetDistricts)
		geoGroup.GET("/subdistricts", h.GetSubdistricts)
		geoGroup.GET("/blocks", h.GetBlocks)
		geoGroup.GET("/villages", h.GetVillages)
		geoGroup.GET("/urban-local-bodies", h.GetUrbanLocalBodies)
		geoGroup.GET("/urban-wards", h.GetUrbanWards)
		geoGroup.GET("/urban-city-areas", h.GetUrbanCityAreas)
		geoGroup.GET("/rural-hierarchy", h.GetRuralHierarchy)
	}
}
