package routes

import (
	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/handlers"
	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/services"
)

// RegisterParentRoutes registers all Parent module routes into the router group.
// Symmetrically modeled on RegisterSuperAdminRoutes and RegisterInchargeRoutes.
func RegisterParentRoutes(
	router *gin.RouterGroup,
	db *database.Database,
	requireView gin.HandlerFunc,
	requireManage gin.HandlerFunc,
) {
	RegisterCollegeParentRoutes(router, db, requireView, requireManage)
}

// RegisterCollegeParentRoutes sets up the repository, services, handlers and route mappings.
func RegisterCollegeParentRoutes(
	router *gin.RouterGroup,
	db *database.Database,
	requireView gin.HandlerFunc,
	requireManage gin.HandlerFunc,
) {
	// Initialize repository
	repo := repository.New(db)

	// Initialize domain services
	parentService := services.NewParentService(db, repo)
	studentParentService := services.NewStudentParentService(repo)

	// Initialize handlers
	parentHandler := handlers.NewParentHandler(parentService)
	studentParentHandler := handlers.NewStudentParentHandler(studentParentService)

	// Parent module status & operational routes
	parentGroup := router.Group("/parents")
	{
		parentGroup.GET("/status", requireView, func(c *gin.Context) {
			c.JSON(200, gin.H{
				"module":  "PARENT",
				"status":  "operational",
				"version": "1.0.0",
			})
		})

		parentGroup.GET("", requireView, parentHandler.ListParents)
		parentGroup.POST("", requireManage, parentHandler.CreateParent)
		parentGroup.GET("/:parent_id", requireView, parentHandler.GetParent)
		parentGroup.PUT("/:parent_id", requireManage, parentHandler.UpdateParent)
	}

	// Student-Parent relationship mapping routes
	studentParents := router.Group("/students/:student_id/parents")
	{
		studentParents.GET("", requireView, studentParentHandler.ListStudentParents)
		studentParents.POST("", requireManage, studentParentHandler.CreateStudentParent)
		studentParents.GET("/:relationship_id", requireView, studentParentHandler.GetStudentParent)
		studentParents.PUT("/:relationship_id", requireManage, studentParentHandler.UpdateStudentParent)
		studentParents.DELETE("/:relationship_id", requireManage, studentParentHandler.DeleteStudentParent)
	}
}

