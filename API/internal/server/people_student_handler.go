package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/auth"
	"github.com/yourusername/hostel-management-system/API/internal/middleware"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
	"github.com/yourusername/hostel-management-system/API/internal/service"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

// StudentHandler handles HTTP requests for the student domain.
type StudentHandler struct {
	service *service.StudentService
}

// NewStudentHandler creates a new StudentHandler.
func NewStudentHandler(studentService *service.StudentService) *StudentHandler {
	return &StudentHandler{
		service: studentService,
	}
}

// studentRequest represents the writable student fields accepted by the API.
type studentRequest struct {
	UserID             *uuid.UUID `json:"user_id"`
	AdmissionNumber    string     `json:"admission_number"`
	RegistrationNumber *string    `json:"registration_number"`
	RollNumber         *string    `json:"roll_number"`
	FirstName          string     `json:"first_name"`
	MiddleName         *string    `json:"middle_name"`
	LastName           *string    `json:"last_name"`
	DateOfBirth        *time.Time `json:"date_of_birth"`
	Gender             *string    `json:"gender"`
	BloodGroup         *string    `json:"blood_group"`
	Phone              *string    `json:"phone"`
	Email              *string    `json:"email"`
	AddressLine1       *string    `json:"address_line1"`
	AddressLine2       *string    `json:"address_line2"`
	City               *string    `json:"city"`
	State              *string    `json:"state"`
	PostalCode         *string    `json:"postal_code"`
	Country            *string    `json:"country"`
	DepartmentID       *uuid.UUID `json:"department_id"`
	ProgramID          *uuid.UUID `json:"program_id"`
	CourseID           *uuid.UUID `json:"course_id"`
	BatchID            *uuid.UUID `json:"batch_id"`
	AcademicYearID     *uuid.UUID `json:"academic_year_id"`
	SemesterID         *uuid.UUID `json:"semester_id"`
	AdmissionDate      *time.Time `json:"admission_date"`
}

// createStudentRequest represents the POST request body.
type createStudentRequest struct {
	studentRequest

	StudentStatus *string `json:"student_status"`
	HostelStatus  *string `json:"hostel_status"`

	Metadata map[string]interface{} `json:"metadata"`
}

// updateStudentRequest represents the PUT request body.
type updateStudentRequest struct {
	studentRequest
}

// updateStudentStatusRequest represents the PATCH status request body.
type updateStudentStatusRequest struct {
	Status string `json:"status"`
}

// ListStudents handles:
//
//	GET /college/students
func (h *StudentHandler) ListStudents(c *gin.Context) {
	if h.service == nil {
		writeStudentError(
			c,
			http.StatusInternalServerError,
			"student service unavailable",
		)
		return
	}

	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeStudentError(
			c,
			http.StatusUnauthorized,
			"tenant context is missing or invalid",
		)
		return
	}

	params := repository.ListStudentsParams{
		CollegeID: collegeID,
	}

	if value := strings.TrimSpace(c.Query("student_status")); value != "" {
		params.StudentStatus = &value
	}

	if value := strings.TrimSpace(c.Query("hostel_status")); value != "" {
		params.HostelStatus = &value
	}

	if value := strings.TrimSpace(c.Query("limit")); value != "" {
		limit, err := strconv.Atoi(value)
		if err != nil || limit < 0 {
			writeStudentError(
				c,
				http.StatusBadRequest,
				"invalid limit",
			)
			return
		}

		params.Limit = limit
	}

	if value := strings.TrimSpace(c.Query("offset")); value != "" {
		offset, err := strconv.Atoi(value)
		if err != nil || offset < 0 {
			writeStudentError(
				c,
				http.StatusBadRequest,
				"invalid offset",
			)
			return
		}

		params.Offset = offset
	}

	students, err := h.service.ListStudents(c.Request.Context(), params)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	response.OK(c, students)
}

// CreateStudent handles:
//
//	POST /college/students
func (h *StudentHandler) CreateStudent(c *gin.Context) {
	if h.service == nil {
		writeStudentError(
			c,
			http.StatusInternalServerError,
			"student service unavailable",
		)
		return
	}

	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeStudentError(
			c,
			http.StatusUnauthorized,
			"tenant context is missing or invalid",
		)
		return
	}

	var request createStudentRequest

	if err := c.ShouldBindJSON(&request); err != nil {
		writeStudentError(
			c,
			http.StatusBadRequest,
			"invalid request body",
		)
		return
	}

	metadata := []byte(`{}`)

	if request.Metadata != nil {
		var err error

		metadata, err = marshalMetadata(request.Metadata)
		if err != nil {
			writeStudentError(
				c,
				http.StatusBadRequest,
				"invalid metadata",
			)
			return
		}
	}

	params := repository.CreateStudentParams{
		CollegeID:          collegeID,
		UserID:             request.UserID,
		AdmissionNumber:    request.AdmissionNumber,
		RegistrationNumber: request.RegistrationNumber,
		RollNumber:         request.RollNumber,
		FirstName:          request.FirstName,
		MiddleName:         request.MiddleName,
		LastName:           request.LastName,
		DateOfBirth:        request.DateOfBirth,
		Gender:             request.Gender,
		BloodGroup:         request.BloodGroup,
		Phone:              request.Phone,
		Email:              request.Email,
		AddressLine1:       request.AddressLine1,
		AddressLine2:       request.AddressLine2,
		City:               request.City,
		State:              request.State,
		PostalCode:         request.PostalCode,
		Country:            request.Country,
		DepartmentID:       request.DepartmentID,
		ProgramID:          request.ProgramID,
		CourseID:           request.CourseID,
		BatchID:            request.BatchID,
		AcademicYearID:     request.AcademicYearID,
		SemesterID:         request.SemesterID,
		AdmissionDate:      request.AdmissionDate,
		StudentStatus:      request.StudentStatus,
		HostelStatus:       request.HostelStatus,
		Metadata:           metadata,
	}

	student, err := h.service.CreateStudent(
		c.Request.Context(),
		params,
	)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	response.Created(c, student)
}

// GetStudent handles:
//
//	GET /college/students/:student_id
func (h *StudentHandler) GetStudent(c *gin.Context) {
	if h.service == nil {
		writeStudentError(
			c,
			http.StatusInternalServerError,
			"student service unavailable",
		)
		return
	}

	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeStudentError(
			c,
			http.StatusUnauthorized,
			"tenant context is missing or invalid",
		)
		return
	}

	studentID, err := uuid.Parse(
		strings.TrimSpace(c.Param("student_id")),
	)
	if err != nil {
		writeStudentError(
			c,
			http.StatusBadRequest,
			"invalid student_id",
		)
		return
	}

	student, err := h.service.GetStudentByID(
		c.Request.Context(),
		collegeID,
		studentID,
	)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	response.OK(c, student)
}

// UpdateStudent handles:
//
//	PUT /college/students/:student_id
func (h *StudentHandler) UpdateStudent(c *gin.Context) {
	if h.service == nil {
		writeStudentError(
			c,
			http.StatusInternalServerError,
			"student service unavailable",
		)
		return
	}

	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeStudentError(
			c,
			http.StatusUnauthorized,
			"tenant context is missing or invalid",
		)
		return
	}

	studentID, err := uuid.Parse(
		strings.TrimSpace(c.Param("student_id")),
	)
	if err != nil {
		writeStudentError(
			c,
			http.StatusBadRequest,
			"invalid student_id",
		)
		return
	}

	var request updateStudentRequest

	if err := c.ShouldBindJSON(&request); err != nil {
		writeStudentError(
			c,
			http.StatusBadRequest,
			"invalid request body",
		)
		return
	}

	params := repository.UpdateStudentParams{
		UserID:             request.UserID,
		AdmissionNumber:    request.AdmissionNumber,
		RegistrationNumber: request.RegistrationNumber,
		RollNumber:         request.RollNumber,
		FirstName:          request.FirstName,
		MiddleName:         request.MiddleName,
		LastName:           request.LastName,
		DateOfBirth:        request.DateOfBirth,
		Gender:             request.Gender,
		BloodGroup:         request.BloodGroup,
		Phone:              request.Phone,
		Email:              request.Email,
		AddressLine1:       request.AddressLine1,
		AddressLine2:       request.AddressLine2,
		City:               request.City,
		State:              request.State,
		PostalCode:         request.PostalCode,
		Country:            request.Country,
		DepartmentID:       request.DepartmentID,
		ProgramID:          request.ProgramID,
		CourseID:           request.CourseID,
		BatchID:            request.BatchID,
		AcademicYearID:     request.AcademicYearID,
		SemesterID:         request.SemesterID,
		AdmissionDate:      request.AdmissionDate,
	}

	student, err := h.service.UpdateStudent(
		c.Request.Context(),
		collegeID,
		studentID,
		params,
	)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	response.OK(c, student)
}

// UpdateStudentStatus handles:
//
//	PATCH /college/students/:student_id/status
func (h *StudentHandler) UpdateStudentStatus(c *gin.Context) {
	if h.service == nil {
		writeStudentError(
			c,
			http.StatusInternalServerError,
			"student service unavailable",
		)
		return
	}

	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeStudentError(
			c,
			http.StatusUnauthorized,
			"tenant context is missing or invalid",
		)
		return
	}

	studentID, err := uuid.Parse(
		strings.TrimSpace(c.Param("student_id")),
	)
	if err != nil {
		writeStudentError(
			c,
			http.StatusBadRequest,
			"invalid student_id",
		)
		return
	}

	var request updateStudentStatusRequest

	if err := c.ShouldBindJSON(&request); err != nil {
		writeStudentError(
			c,
			http.StatusBadRequest,
			"invalid request body",
		)
		return
	}

	request.Status = strings.ToUpper(
		strings.TrimSpace(request.Status),
	)

	if request.Status == "" {
		writeStudentError(
			c,
			http.StatusBadRequest,
			"status is required",
		)
		return
	}

	student, err := h.service.UpdateStudentStatus(
		c.Request.Context(),
		collegeID,
		studentID,
		request.Status,
	)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	response.OK(c, student)
}

// collegeIDFromContext retrieves the verified tenant ID written by
// TenantContextMiddleware.
//
// The handler never accepts college_id from the HTTP request.
func collegeIDFromContext(c *gin.Context) (uuid.UUID, bool) {
	value, exists := c.Get(middleware.TenantIDContextKey)
	if !exists || value == nil {
		return uuid.Nil, false
	}

	switch tenantID := value.(type) {
	case uuid.UUID:
		if tenantID == uuid.Nil {
			return uuid.Nil, false
		}

		return tenantID, true

	case *uuid.UUID:
		if tenantID == nil || *tenantID == uuid.Nil {
			return uuid.Nil, false
		}

		return *tenantID, true

	case string:
		parsed, err := uuid.Parse(strings.TrimSpace(tenantID))
		if err != nil || parsed == uuid.Nil {
			return uuid.Nil, false
		}

		return parsed, true

	default:
		return uuid.Nil, false
	}
}

// authenticatedUserIDFromContext retrieves the authenticated user ID.
//
// This helper is currently kept available for future audit/actor handling.
// The student service itself deliberately receives tenant identity separately.
func authenticatedUserIDFromContext(c *gin.Context) (uuid.UUID, bool) {
	value, exists := c.Get(auth.ContextUserIDKey)
	if !exists || value == nil {
		return uuid.Nil, false
	}

	switch userID := value.(type) {
	case uuid.UUID:
		if userID == uuid.Nil {
			return uuid.Nil, false
		}

		return userID, true

	case *uuid.UUID:
		if userID == nil || *userID == uuid.Nil {
			return uuid.Nil, false
		}

		return *userID, true

	case string:
		parsed, err := uuid.Parse(strings.TrimSpace(userID))
		if err != nil || parsed == uuid.Nil {
			return uuid.Nil, false
		}

		return parsed, true

	default:
		return uuid.Nil, false
	}
}

// marshalMetadata converts request metadata into JSON bytes.
func marshalMetadata(metadata map[string]interface{}) ([]byte, error) {
	if metadata == nil {
		return []byte(`{}`), nil
	}

	return jsonMarshal(metadata)
}

// jsonMarshal is kept behind a small helper so the handler's request
// processing remains easy to test/change.
func jsonMarshal(value interface{}) ([]byte, error) {
	return json.Marshal(value)
}

// handleServiceError maps known domain errors to HTTP responses.
func (h *StudentHandler) handleServiceError(
	c *gin.Context,
	err error,
) {
	switch {
	case errors.Is(err, service.ErrInvalidCollegeID):
		writeStudentError(
			c,
			http.StatusUnauthorized,
			"invalid tenant context",
		)

	case errors.Is(err, service.ErrInvalidStudentID):
		writeStudentError(
			c,
			http.StatusBadRequest,
			"invalid student id",
		)

	case errors.Is(err, service.ErrInvalidAdmissionNumber):
		writeStudentError(
			c,
			http.StatusBadRequest,
			"admission_number is required",
		)

	case errors.Is(err, service.ErrInvalidFirstName):
		writeStudentError(
			c,
			http.StatusBadRequest,
			"first_name is required",
		)

	case errors.Is(err, service.ErrInvalidStudentStatus):
		writeStudentError(
			c,
			http.StatusBadRequest,
			"invalid student status",
		)

	case errors.Is(err, service.ErrInvalidHostelStatus):
		writeStudentError(
			c,
			http.StatusBadRequest,
			"invalid hostel status",
		)

	case errors.Is(err, service.ErrInvalidPagination):
		writeStudentError(
			c,
			http.StatusBadRequest,
			"invalid pagination parameters",
		)

	case errors.Is(err, service.ErrInvalidStudentMetadata):
		writeStudentError(
			c,
			http.StatusBadRequest,
			"invalid student metadata",
		)

	case errors.Is(err, service.ErrStudentNotFound):
		writeStudentError(
			c,
			http.StatusNotFound,
			"student not found",
		)

	case errors.Is(err, service.ErrStudentConflict):
		writeStudentError(
			c,
			http.StatusConflict,
			"student already exists",
		)

	default:
		writeStudentError(
			c,
			http.StatusInternalServerError,
			"internal server error",
		)
	}
}

// writeStudentError writes an API error response.
//
// We intentionally use a small local error payload rather than introducing
// another response abstraction or changing the existing response package.
func writeStudentError(
	c *gin.Context,
	status int,
	message string,
) {
	c.JSON(status, gin.H{
		"success": false,
		"error": gin.H{
			"message": message,
		},
	})
}
