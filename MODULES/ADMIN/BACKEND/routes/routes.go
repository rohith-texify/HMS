package routes

import (
	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/handlers"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/services"
)

// RegisterCollegeAdminRoutes registers all College Admin module routes.
// Symmetrically modeled on RegisterSuperAdminRoutes in MODULES/SUPER-ADMIN/BACKEND/routes/routes.go.
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

		// Dashboard & Analytics
		collegeAdmin.GET("/dashboard/summary", requireView, reportHandler.GetDashboardSummary)

		// Student Management
		collegeAdmin.GET("/students", requireView, studentHandler.ListStudents)
		collegeAdmin.GET("/students/:id", requireView, studentHandler.GetStudentByID)
		collegeAdmin.PATCH("/students/:id/status", requireManage, studentHandler.UpdateStudentStatus)
		collegeAdmin.GET("/students/:id/parents", requireView, studentHandler.ListStudentParents)

		// Hostel & Room Structure
		collegeAdmin.GET("/hostels", requireView, hostelHandler.ListHostels)
		collegeAdmin.GET("/hostels/:hostel_id/blocks", requireView, hostelHandler.ListBlocks)
		collegeAdmin.GET("/blocks/:block_id/floors", requireView, hostelHandler.ListFloors)
		collegeAdmin.GET("/floors/:floor_id/rooms", requireView, hostelHandler.ListRooms)
		collegeAdmin.GET("/rooms/:room_id/beds", requireView, hostelHandler.ListBeds)

		// Bed Allocations
		collegeAdmin.GET("/allocations", requireView, allocationHandler.ListBedAllocations)
		collegeAdmin.GET("/allocations/student/:student_id", requireView, allocationHandler.GetCurrentAllocation)

		// Curfew & Attendance
		collegeAdmin.GET("/attendance", requireView, attendanceHandler.ListStudentAttendance)
		collegeAdmin.GET("/attendance/summary", requireView, attendanceHandler.GetAttendanceSummary)

		// Leave Requests
		collegeAdmin.GET("/leaves", requireView, leaveHandler.ListLeaveRequests)
		collegeAdmin.GET("/leaves/summary", requireView, leaveHandler.GetLeaveSummary)

		// Complaints & Maintenance
		collegeAdmin.GET("/complaints", requireView, complaintHandler.ListComplaints)
		collegeAdmin.GET("/complaints/summary", requireView, complaintHandler.GetComplaintSummary)

		// Mess & Dining
		collegeAdmin.GET("/hostels/:hostel_id/mess/timings", requireView, messHandler.ListMealTimings)
		collegeAdmin.GET("/hostels/:hostel_id/mess/menus", requireView, messHandler.ListMealMenus)

		// Staff & Gate Assignments
		collegeAdmin.GET("/staff", requireView, staffHandler.ListStaff)
		collegeAdmin.GET("/gates", requireView, staffHandler.ListGates)
		collegeAdmin.GET("/security-assignments", requireView, staffHandler.ListSecurityAssignments)

		// Announcements & Notifications
		collegeAdmin.GET("/notifications", requireView, notificationHandler.ListNotifications)
	}
}
