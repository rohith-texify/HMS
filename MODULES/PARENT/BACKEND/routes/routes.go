package routes

import (
	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/handlers"
	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/services"
)

// RegisterCollegeParentRoutes is an alias for RegisterParentRoutes.
func RegisterCollegeParentRoutes(
	router *gin.RouterGroup,
	db *database.Database,
	requireView gin.HandlerFunc,
	requireManage gin.HandlerFunc,
) {
	RegisterParentRoutes(router, db, requireView, requireManage)
}

// RegisterParentRoutes registers all Parent module and student-parent relationship routes.
func RegisterParentRoutes(
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

	// Parent profile endpoints
	router.GET("/parents", requireView, parentHandler.ListParents)
	router.POST("/parents", requireManage, parentHandler.CreateParent)
	router.GET("/parents/:parent_id", requireView, parentHandler.GetParent)
	router.PUT("/parents/:parent_id", requireManage, parentHandler.UpdateParent)

	// Student - Parent relationship association endpoints
	router.GET("/students/:student_id/parents", requireView, studentParentHandler.ListStudentParents)
	router.POST("/students/:student_id/parents", requireManage, studentParentHandler.CreateStudentParent)
	router.GET("/students/:student_id/parents/:relationship_id", requireView, studentParentHandler.GetStudentParent)
	router.PUT("/students/:student_id/parents/:relationship_id", requireManage, studentParentHandler.UpdateStudentParent)
	router.DELETE("/students/:student_id/parents/:relationship_id", requireManage, studentParentHandler.DeleteStudentParent)

	// Module operational status (supports both /parent/status and /parents/status)
	statusHandler := func(c *gin.Context) {
		c.JSON(200, gin.H{
			"module":  "PARENT",
			"status":  "operational",
			"version": "1.0.0",
		})
	}
	router.GET("/parent/status", requireView, statusHandler)
	router.GET("/parents/status", requireView, statusHandler)
}

