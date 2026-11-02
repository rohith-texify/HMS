package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/services"
)

// Handlers bundles all College Admin module handlers.
type Handlers struct {
	Student      *StudentHandler
	Hostel       *HostelHandler
	Allocation   *AllocationHandler
	Attendance   *AttendanceHandler
	Leave        *LeaveHandler
	Complaint    *ComplaintHandler
	Mess         *MessHandler
	Staff        *StaffHandler
	Notification *NotificationHandler
	Report       *ReportHandler
}

// StudentHandler handles resident student endpoints.
type StudentHandler struct {
	svc *services.StudentService
}

func NewStudentHandler(svc *services.StudentService) *StudentHandler {
	return &StudentHandler{svc: svc}
}

// HostelHandler handles hostel structure endpoints.
type HostelHandler struct {
	svc *services.HostelService
}

func NewHostelHandler(svc *services.HostelService) *HostelHandler {
	return &HostelHandler{svc: svc}
}

// AllocationHandler handles bed allocation endpoints.
type AllocationHandler struct {
	svc *services.AllocationService
}

func NewAllocationHandler(svc *services.AllocationService) *AllocationHandler {
	return &AllocationHandler{svc: svc}
}

// AttendanceHandler handles curfew roll-call endpoints.
type AttendanceHandler struct {
	svc *services.AttendanceService
}

func NewAttendanceHandler(svc *services.AttendanceService) *AttendanceHandler {
	return &AttendanceHandler{svc: svc}
}

// LeaveHandler handles student leave approval endpoints.
type LeaveHandler struct {
	svc *services.LeaveService
}

func NewLeaveHandler(svc *services.LeaveService) *LeaveHandler {
	return &LeaveHandler{svc: svc}
}

// ComplaintHandler handles maintenance service desk endpoints.
type ComplaintHandler struct {
	svc *services.ComplaintService
}

func NewComplaintHandler(svc *services.ComplaintService) *ComplaintHandler {
	return &ComplaintHandler{svc: svc}
}

// MessHandler handles dining and menu endpoints.
type MessHandler struct {
	svc *services.MessService
}

func NewMessHandler(svc *services.MessService) *MessHandler {
	return &MessHandler{svc: svc}
}

// StaffHandler handles staff directory and gate assignment endpoints.
type StaffHandler struct {
	svc *services.StaffService
}

func NewStaffHandler(svc *services.StaffService) *StaffHandler {
	return &StaffHandler{svc: svc}
}

// NotificationHandler handles notice broadcast endpoints.
type NotificationHandler struct {
	svc *services.NotificationService
}

func NewNotificationHandler(svc *services.NotificationService) *NotificationHandler {
	return &NotificationHandler{svc: svc}
}

// ReportHandler handles analytical report endpoints.
type ReportHandler struct {
	svc *services.ReportService
}

func NewReportHandler(svc *services.ReportService) *ReportHandler {
	return &ReportHandler{svc: svc}
}

// RespondSuccess writes a standardized success envelope.
func RespondSuccess(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

// RespondError writes a standardized error envelope.
func RespondError(c *gin.Context, code int, errCode, message string) {
	c.JSON(code, gin.H{
		"success": false,
		"error": gin.H{
			"code":    errCode,
			"message": message,
		},
	})
}

// ExtractTenantID helper extracts tenant UUID from gin context.
func ExtractTenantID(c *gin.Context) (uuid.UUID, bool) {
	val, exists := c.Get("tenant_id")
	if !exists {
		return uuid.Nil, false
	}
	switch v := val.(type) {
	case uuid.UUID:
		return v, true
	case string:
		u, err := uuid.Parse(v)
		return u, err == nil
	}
	return uuid.Nil, false
}

