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
	// Initialize incharge repository
	repo := repository.New(db)

	// Initialize incharge service
	inchargeService := services.NewInchargeService(db, repo)

	// Initialize incharge handler
	inchargeHandler := handlers.NewInchargeHandler(inchargeService)

	// Incharge operations & dashboard context
	router.GET("/incharges/my-hostel", requireView, inchargeHandler.GetMyHostel)
	router.GET("/incharges/my-hostel/residents", requireView, inchargeHandler.ListResidents)
	router.GET("/incharges/my-hostel/vacant-beds", requireView, inchargeHandler.ListVacantBeds)
	router.GET("/incharges/unallocated-students", requireView, inchargeHandler.ListUnallocatedStudents)
	router.POST("/incharges/accounts", requireManage, inchargeHandler.CreateAccount)

	// Incharge hostel assignments management
	router.GET("/hostels/:hostel_id/incharges", requireView, inchargeHandler.List)
	router.POST("/hostels/:hostel_id/incharges", requireManage, inchargeHandler.Create)
	router.GET("/hostels/:hostel_id/incharges/:assignment_id", requireView, inchargeHandler.Get)
	router.PUT("/hostels/:hostel_id/incharges/:assignment_id", requireManage, inchargeHandler.Update)
	router.DELETE("/hostels/:hostel_id/incharges/:assignment_id", requireManage, inchargeHandler.Delete)
}
