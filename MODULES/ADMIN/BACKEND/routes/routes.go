package routes

import (
	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/handlers"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/services"
)

// RegisterCollegeAdminRoutes registers all College Admin module routes.
// Modeled directly on RegisterSuperAdminRoutes in MODULES/SUPER-ADMIN/BACKEND/routes/routes.go.
func RegisterCollegeAdminRoutes(
	router *gin.RouterGroup,
	db *database.Database,
	requireView gin.HandlerFunc,
	requireManage gin.HandlerFunc,
) {
	// Initialize repository
	repo := repository.New(db)

	// Initialize domain services
	studentService := services.NewStudentService(db, repo)
	hostelService := services.NewHostelService(db, repo)
	allocationService := services.NewAllocationService(db, repo)
	attendanceService := services.NewAttendanceService(db, repo)
	leaveService := services.NewLeaveService(db, repo)
	complaintService := services.NewComplaintService(db, repo)
	messService := services.NewMessService(db, repo)
	staffService := services.NewStaffService(db, repo)
	notificationService := services.NewNotificationService(db, repo)
	reportService := services.NewReportService(db, repo)

	// Initialize handlers
	studentHandler := handlers.NewStudentHandler(studentService)
	hostelHandler := handlers.NewHostelHandler(hostelService)
	allocationHandler := handlers.NewAllocationHandler(allocationService)
	attendanceHandler := handlers.NewAttendanceHandler(attendanceService)
	leaveHandler := handlers.NewLeaveHandler(leaveService)
	complaintHandler := handlers.NewComplaintHandler(complaintService)
	messHandler := handlers.NewMessHandler(messService)
	staffHandler := handlers.NewStaffHandler(staffService)
	notificationHandler := handlers.NewNotificationHandler(notificationService)
	reportHandler := handlers.NewReportHandler(reportService)

	_ = studentHandler
	_ = hostelHandler
	_ = allocationHandler
	_ = attendanceHandler
	_ = leaveHandler
	_ = complaintHandler
	_ = messHandler
	_ = staffHandler
	_ = notificationHandler
	_ = reportHandler

	// Canonical College Admin module routes group
	collegeAdmin := router.Group("/admin")
	{
		collegeAdmin.GET("/status", requireView, func(c *gin.Context) {
			c.JSON(200, gin.H{
				"module":  "COLLEGE_ADMIN",
				"status":  "operational",
				"version": "1.0.0",
			})
		})
	}
}
