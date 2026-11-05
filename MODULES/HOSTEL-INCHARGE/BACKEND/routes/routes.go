package routes

import (
	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/MODULES/HOSTEL-INCHARGE/BACKEND/handlers"
	"github.com/yourusername/hostel-management-system/MODULES/HOSTEL-INCHARGE/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/HOSTEL-INCHARGE/BACKEND/services"
)

// RegisterHostelInchargeRoutes registers all Hostel In-Charge domain routes.
// Modeled symmetrically on RegisterCollegeAdminRoutes and RegisterSuperAdminRoutes.
func RegisterHostelInchargeRoutes(
	router *gin.RouterGroup,
	db *database.Database,
	requireView gin.HandlerFunc,
	requireManage gin.HandlerFunc,
) {
	// Initialize repository
	repo := repository.New(db)

	// Initialize domain services
	inchargeService := services.NewInchargeService(db, repo)

	// Initialize handlers
	inchargeHandler := handlers.NewInchargeHandler(inchargeService)

	// Dedicated Hostel In-Charge module group: /college/incharges
	inchargeGroup := router.Group("/incharges")
	{
		// Module health check & status
		inchargeGroup.GET("/status", requireView, func(c *gin.Context) {
			c.JSON(200, gin.H{
				"module":  "HOSTEL_INCHARGE",
				"status":  "operational",
				"version": "1.0.0",
			})
		})

		// Assigned Hostel Operations
		inchargeGroup.GET("/my-hostel", requireView, inchargeHandler.GetMyHostel)
		inchargeGroup.GET("/my-hostel/residents", requireView, inchargeHandler.ListResidents)
		inchargeGroup.GET("/my-hostel/vacant-beds", requireView, inchargeHandler.ListVacantBeds)
		inchargeGroup.GET("/unallocated-students", requireView, inchargeHandler.ListUnallocatedStudents)
		inchargeGroup.GET("/dashboard/summary", requireView, inchargeHandler.GetDashboardSummary)

		// Account provisioning
		inchargeGroup.POST("/create-account", requireManage, inchargeHandler.CreateAccount)
	}
}

