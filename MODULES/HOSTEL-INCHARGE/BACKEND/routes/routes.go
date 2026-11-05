package routes

import (
	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/MODULES/HOSTEL-INCHARGE/BACKEND/handlers"
	"github.com/yourusername/hostel-management-system/MODULES/HOSTEL-INCHARGE/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/HOSTEL-INCHARGE/BACKEND/services"
)

// RegisterInchargeRoutes registers all Hostel In-Charge backend routes.
// Mirrors the modular architectural pattern established in Super Admin.
func RegisterInchargeRoutes(
	router *gin.RouterGroup,
	db *database.Database,
	requireView gin.HandlerFunc,
	requireManage gin.HandlerFunc,
) {
	RegisterHostelInchargeRoutes(router, db, requireView, requireManage)
}

// RegisterHostelInchargeRoutes registers all Hostel In-Charge domain routes.
func RegisterHostelInchargeRoutes(
	router *gin.RouterGroup,
	db *database.Database,
	requireView gin.HandlerFunc,
	requireManage gin.HandlerFunc,
) {
	// Initialize incharge repository
	repo := repository.New(db)

	// Initialize incharge service
	inchargeService := services.NewInchargeService(db, repo)

	// Initialize incharge handler
	inchargeHandler := handlers.NewInchargeHandler(inchargeService)

	// Dedicated incharge workspace operations
	inchargeGroup := router.Group("/incharges")
	{
		inchargeGroup.GET("/status", requireView, func(c *gin.Context) {
			c.JSON(200, gin.H{
				"module":  "HOSTEL_INCHARGE",
				"status":  "operational",
				"version": "1.0.0",
			})
		})

		inchargeGroup.GET("/my-hostel", requireView, inchargeHandler.GetMyHostel)
		inchargeGroup.GET("/my-hostel/residents", requireView, inchargeHandler.ListResidents)
		inchargeGroup.GET("/my-hostel/vacant-beds", requireView, inchargeHandler.ListVacantBeds)
		inchargeGroup.GET("/unallocated-students", requireView, inchargeHandler.ListUnallocatedStudents)
		inchargeGroup.GET("/dashboard/summary", requireView, inchargeHandler.GetDashboardSummary)
		inchargeGroup.POST("/create-account", requireManage, inchargeHandler.CreateAccount)
		inchargeGroup.POST("/accounts", requireManage, inchargeHandler.CreateAccount)
	}

	// Incharge hostel assignments management
	router.GET("/hostels/:hostel_id/incharges", requireView, inchargeHandler.List)
	router.POST("/hostels/:hostel_id/incharges", requireManage, inchargeHandler.Create)
	router.GET("/hostels/:hostel_id/incharges/:assignment_id", requireView, inchargeHandler.Get)
	router.PUT("/hostels/:hostel_id/incharges/:assignment_id", requireManage, inchargeHandler.Update)
	router.DELETE("/hostels/:hostel_id/incharges/:assignment_id", requireManage, inchargeHandler.Delete)
}
