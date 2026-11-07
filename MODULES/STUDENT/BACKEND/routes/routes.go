package routes

import (
	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/MODULES/STUDENT/BACKEND/handlers"
	"github.com/yourusername/hostel-management-system/MODULES/STUDENT/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/STUDENT/BACKEND/services"
)

// RegisterStudentRoutes registers all Student Self-Service backend endpoints.
// Mirrors the modular architectural pattern established in Super-Admin and Hostel-Incharge.
func RegisterStudentRoutes(
	router *gin.RouterGroup,
	db *database.Database,
	requireAuth gin.HandlerFunc,
) {
	// Initialize student repository
	repo := repository.New(db)

	// Initialize student service
	studentService := services.NewStudentService(db, repo)

	// Initialize student handler
	studentHandler := handlers.NewStudentHandler(studentService)

	// Dedicated student self-service routes under /college/student
	studentGroup := router.Group("/student")
	{
		studentGroup.GET("/status", requireAuth, func(c *gin.Context) {
			c.JSON(200, gin.H{
				"module":  "STUDENT",
				"status":  "operational",
				"version": "1.0.0",
			})
		})

		// Profile, accommodation, guardians, contacts, and documents
		studentGroup.GET("/profile", requireAuth, studentHandler.GetProfile)
		studentGroup.GET("/room-allocation", requireAuth, studentHandler.GetCurrentRoom)
		studentGroup.GET("/guardians", requireAuth, studentHandler.ListGuardians)
		studentGroup.GET("/emergency-contacts", requireAuth, studentHandler.ListEmergencyContacts)
		studentGroup.GET("/documents", requireAuth, studentHandler.ListDocuments)

		// Gate passes & QR verification data
		studentGroup.GET("/gate-passes", requireAuth, studentHandler.ListGatePasses)
		studentGroup.POST("/gate-passes", requireAuth, studentHandler.RequestGatePass)

		// Attendance records & stats
		studentGroup.GET("/attendance", requireAuth, studentHandler.GetAttendanceSummary)

		// Leaves
		studentGroup.GET("/leaves", requireAuth, studentHandler.ListLeaves)
		studentGroup.POST("/leaves", requireAuth, studentHandler.ApplyLeave)

		// Complaints & grievances
		studentGroup.GET("/complaints", requireAuth, studentHandler.ListComplaints)
		studentGroup.POST("/complaints", requireAuth, studentHandler.FileComplaint)

		// Mess & dining
		studentGroup.GET("/mess/today", requireAuth, studentHandler.GetTodayMessMenu)

		// Home dashboard summary
		studentGroup.GET("/dashboard/summary", requireAuth, studentHandler.GetDashboardSummary)
	}
}

