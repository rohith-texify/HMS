package handlers

import (
	"errors"

	"github.com/gin-gonic/gin"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
	"github.com/yourusername/hostel-management-system/MODULES/STUDENT/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/STUDENT/BACKEND/services"
)

// StudentHandler handles HTTP requests for student self-service capabilities.
type StudentHandler struct {
	service *services.StudentService
}

// NewStudentHandler instantiates a new StudentHandler.
func NewStudentHandler(service *services.StudentService) *StudentHandler {
	return &StudentHandler{service: service}
}

// GetProfile handles GET /college/student/profile.
func (h *StudentHandler) GetProfile(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userEmail := getAuthenticatedEmail(c)

	profile, err := h.service.GetProfile(c.Request.Context(), collegeID, userID, userEmail)
	if err != nil {
		if errors.Is(err, services.ErrUnauthorizedStudent) {
			response.Error(c, apierrors.New(apierrors.NotFound, "No student profile is enrolled under this login account."))
			return
		}
		response.Error(c, apierrors.New(apierrors.InternalError, err.Error()))
		return
	}

	response.OK(c, profile)
}

// GetCurrentRoom handles GET /college/student/room-allocation.
func (h *StudentHandler) GetCurrentRoom(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userEmail := getAuthenticatedEmail(c)

	room, err := h.service.GetCurrentRoom(c.Request.Context(), collegeID, userID, userEmail)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.InternalError, err.Error()))
		return
	}

	if room == nil {
		response.OK(c, gin.H{
			"allocated": false,
			"message":   "No active hostel room is currently allotted to your student account.",
		})
		return
	}

	response.OK(c, room)
}

// ListGuardians handles GET /college/student/guardians.
func (h *StudentHandler) ListGuardians(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userEmail := getAuthenticatedEmail(c)

	guardians, err := h.service.ListGuardians(c.Request.Context(), collegeID, userID, userEmail)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.InternalError, err.Error()))
		return
	}

	response.OK(c, guardians)
}

// ListEmergencyContacts handles GET /college/student/emergency-contacts.
func (h *StudentHandler) ListEmergencyContacts(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userEmail := getAuthenticatedEmail(c)

	contacts, err := h.service.ListEmergencyContacts(c.Request.Context(), collegeID, userID, userEmail)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.InternalError, err.Error()))
		return
	}

	response.OK(c, contacts)
}

// ListDocuments handles GET /college/student/documents.
func (h *StudentHandler) ListDocuments(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userEmail := getAuthenticatedEmail(c)

	docs, err := h.service.ListDocuments(c.Request.Context(), collegeID, userID, userEmail)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.InternalError, err.Error()))
		return
	}

	response.OK(c, docs)
}

// ListGatePasses handles GET /college/student/gate-passes.
func (h *StudentHandler) ListGatePasses(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userEmail := getAuthenticatedEmail(c)

	passes, err := h.service.ListGatePasses(c.Request.Context(), collegeID, userID, userEmail)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.InternalError, err.Error()))
		return
	}

	response.OK(c, passes)
}

// RequestGatePass handles POST /college/student/gate-passes.
func (h *StudentHandler) RequestGatePass(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userEmail := getAuthenticatedEmail(c)

	var req models.CreateGatePassRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apierrors.New(apierrors.ValidationError, "Invalid gate pass request payload: "+err.Error()))
		return
	}

	gatePass, err := h.service.RequestGatePass(c.Request.Context(), collegeID, userID, userEmail, req)
	if err != nil {
		if errors.Is(err, services.ErrInvalidDateRange) {
			response.Error(c, apierrors.New(apierrors.ValidationError, err.Error()))
			return
		}
		response.Error(c, apierrors.New(apierrors.InternalError, err.Error()))
		return
	}

	response.Created(c, gatePass)
}

// GetAttendanceSummary handles GET /college/student/attendance.
func (h *StudentHandler) GetAttendanceSummary(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userEmail := getAuthenticatedEmail(c)

	summary, err := h.service.GetAttendanceSummary(c.Request.Context(), collegeID, userID, userEmail)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.InternalError, err.Error()))
		return
	}

	response.OK(c, summary)
}

// ListLeaves handles GET /college/student/leaves.
func (h *StudentHandler) ListLeaves(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userEmail := getAuthenticatedEmail(c)

	leaves, err := h.service.ListLeaves(c.Request.Context(), collegeID, userID, userEmail)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.InternalError, err.Error()))
		return
	}

	response.OK(c, leaves)
}

// ApplyLeave handles POST /college/student/leaves.
func (h *StudentHandler) ApplyLeave(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userEmail := getAuthenticatedEmail(c)

	var req models.CreateLeaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apierrors.New(apierrors.ValidationError, "Invalid leave request payload: "+err.Error()))
		return
	}

	leave, err := h.service.ApplyLeave(c.Request.Context(), collegeID, userID, userEmail, req)
	if err != nil {
		if errors.Is(err, services.ErrInvalidDateRange) {
			response.Error(c, apierrors.New(apierrors.ValidationError, err.Error()))
			return
		}
		response.Error(c, apierrors.New(apierrors.InternalError, err.Error()))
		return
	}

	response.Created(c, leave)
}

// ListComplaints handles GET /college/student/complaints.
func (h *StudentHandler) ListComplaints(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userEmail := getAuthenticatedEmail(c)

	complaints, err := h.service.ListComplaints(c.Request.Context(), collegeID, userID, userEmail)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.InternalError, err.Error()))
		return
	}

	response.OK(c, complaints)
}

// FileComplaint handles POST /college/student/complaints.
func (h *StudentHandler) FileComplaint(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userEmail := getAuthenticatedEmail(c)

	var req models.CreateComplaintRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apierrors.New(apierrors.ValidationError, "Invalid complaint payload: "+err.Error()))
		return
	}

	complaint, err := h.service.FileComplaint(c.Request.Context(), collegeID, userID, userEmail, req)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.InternalError, err.Error()))
		return
	}

	response.Created(c, complaint)
}

// GetTodayMessMenu handles GET /college/student/mess/today.
func (h *StudentHandler) GetTodayMessMenu(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	menu, err := h.service.GetTodayMessMenu(c.Request.Context(), collegeID)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.InternalError, err.Error()))
		return
	}

	response.OK(c, menu)
}

// GetDashboardSummary handles GET /college/student/dashboard/summary.
func (h *StudentHandler) GetDashboardSummary(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		response.Error(c, apierrors.New(apierrors.Unauthorized, err.Error()))
		return
	}

	userEmail := getAuthenticatedEmail(c)

	summary, err := h.service.GetDashboardSummary(c.Request.Context(), collegeID, userID, userEmail)
	if err != nil {
		if errors.Is(err, services.ErrUnauthorizedStudent) {
			response.Error(c, apierrors.New(apierrors.NotFound, "No student profile is enrolled under this login account."))
			return
		}
		response.Error(c, apierrors.New(apierrors.InternalError, err.Error()))
		return
	}

	response.OK(c, summary)
}

