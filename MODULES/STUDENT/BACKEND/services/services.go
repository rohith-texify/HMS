package services

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/MODULES/STUDENT/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/STUDENT/BACKEND/repository"
)

var (
	ErrUnauthorizedStudent = errors.New("authenticated user is not associated with an enrolled student record")
	ErrInvalidDateRange    = errors.New("end date must be after start date")
	ErrPastDateNotAllowed  = errors.New("cannot request leave or pass for past dates")
)

// StudentService handles business logic for the Student Self-Service Portal.
type StudentService struct {
	db   *database.Database
	repo *repository.Repository
}

// NewStudentService creates a new StudentService instance.
func NewStudentService(db *database.Database, repo *repository.Repository) *StudentService {
	return &StudentService{
		db:   db,
		repo: repo,
	}
}

// resolveStudent verifies and returns the student identity associated with the authenticated user.
func (s *StudentService) resolveStudent(ctx context.Context, collegeID, userID uuid.UUID, userEmail string) (*models.StudentProfile, error) {
	student, err := s.repo.GetStudentByUserID(ctx, collegeID, userID, userEmail)
	if err != nil {
		if errors.Is(err, repository.ErrStudentNotFound) {
			return nil, ErrUnauthorizedStudent
		}
		return nil, fmt.Errorf("resolve student identity failed: %w", err)
	}
	return student, nil
}

// GetProfile retrieves the authenticated student's profile, academic details, room allocation, guardians, emergency contacts, and permitted documents.
func (s *StudentService) GetProfile(ctx context.Context, collegeID, userID uuid.UUID, userEmail string) (*models.StudentProfile, error) {
	student, err := s.resolveStudent(ctx, collegeID, userID, userEmail)
	if err != nil {
		return nil, err
	}

	// Attach active room allotment if available
	room, _ := s.repo.GetCurrentBedAllocation(ctx, collegeID, student.ID)
	student.CurrentRoom = room

	// Attach verified guardians
	guardians, _ := s.repo.ListStudentGuardians(ctx, collegeID, student.ID)
	student.Guardians = guardians

	// Attach authorized emergency contacts
	contacts, _ := s.repo.ListEmergencyContacts(ctx, collegeID, student.ID)
	student.EmergencyContacts = contacts
	if len(contacts) > 0 && student.EmergencyContact == nil {
		for _, c := range contacts {
			if c.IsPrimary {
				student.EmergencyContact = &c.Phone
				break
			}
		}
		if student.EmergencyContact == nil {
			student.EmergencyContact = &contacts[0].Phone
		}
	}

	// Attach permitted documents
	docs, _ := s.repo.ListStudentDocuments(ctx, collegeID, student.ID)
	student.Documents = docs

	return student, nil
}

// ListGuardians returns authorized guardians for the student.
func (s *StudentService) ListGuardians(ctx context.Context, collegeID, userID uuid.UUID, userEmail string) ([]models.GuardianInfo, error) {
	student, err := s.resolveStudent(ctx, collegeID, userID, userEmail)
	if err != nil {
		return nil, err
	}
	return s.repo.ListStudentGuardians(ctx, collegeID, student.ID)
}

// ListEmergencyContacts returns emergency contacts for the student.
func (s *StudentService) ListEmergencyContacts(ctx context.Context, collegeID, userID uuid.UUID, userEmail string) ([]models.EmergencyContactInfo, error) {
	student, err := s.resolveStudent(ctx, collegeID, userID, userEmail)
	if err != nil {
		return nil, err
	}
	return s.repo.ListEmergencyContacts(ctx, collegeID, student.ID)
}

// ListDocuments returns permitted documents associated with the student.
func (s *StudentService) ListDocuments(ctx context.Context, collegeID, userID uuid.UUID, userEmail string) ([]models.StudentDocumentInfo, error) {
	student, err := s.resolveStudent(ctx, collegeID, userID, userEmail)
	if err != nil {
		return nil, err
	}
	return s.repo.ListStudentDocuments(ctx, collegeID, student.ID)
}

// GetCurrentRoom retrieves active room & bed assignment for the student.
func (s *StudentService) GetCurrentRoom(ctx context.Context, collegeID, userID uuid.UUID, userEmail string) (*models.BedAllocation, error) {
	student, err := s.resolveStudent(ctx, collegeID, userID, userEmail)
	if err != nil {
		return nil, err
	}

	return s.repo.GetCurrentBedAllocation(ctx, collegeID, student.ID)
}

// ListGatePasses returns all gate passes belonging to the authenticated student.
func (s *StudentService) ListGatePasses(ctx context.Context, collegeID, userID uuid.UUID, userEmail string) ([]models.GatePass, error) {
	student, err := s.resolveStudent(ctx, collegeID, userID, userEmail)
	if err != nil {
		return nil, err
	}

	return s.repo.ListGatePasses(ctx, collegeID, student.ID)
}

// RequestGatePass validates and creates a new gate pass request.
func (s *StudentService) RequestGatePass(
	ctx context.Context,
	collegeID, userID uuid.UUID,
	userEmail string,
	req models.CreateGatePassRequest,
) (*models.GatePass, error) {
	student, err := s.resolveStudent(ctx, collegeID, userID, userEmail)
	if err != nil {
		return nil, err
	}

	if req.ValidUntil.Before(req.ValidFrom) {
		return nil, ErrInvalidDateRange
	}

	gatePass := &models.GatePass{
		ID:          uuid.New(),
		CollegeID:   collegeID,
		StudentID:   student.ID,
		PassType:    req.PassType,
		Reason:      req.Reason,
		Destination: req.Destination,
		ValidFrom:   req.ValidFrom,
		ValidUntil:  req.ValidUntil,
	}

	if err := s.repo.CreateGatePass(ctx, gatePass); err != nil {
		return nil, fmt.Errorf("failed to create gate pass: %w", err)
	}

	return gatePass, nil
}

// GetAttendanceSummary returns attendance percentages and recent logs for the student.
func (s *StudentService) GetAttendanceSummary(ctx context.Context, collegeID, userID uuid.UUID, userEmail string) (*models.AttendanceSummary, error) {
	student, err := s.resolveStudent(ctx, collegeID, userID, userEmail)
	if err != nil {
		return nil, err
	}

	return s.repo.GetAttendanceSummary(ctx, collegeID, student.ID)
}

// ListLeaves returns all leave applications submitted by the student.
func (s *StudentService) ListLeaves(ctx context.Context, collegeID, userID uuid.UUID, userEmail string) ([]models.LeaveRequest, error) {
	student, err := s.resolveStudent(ctx, collegeID, userID, userEmail)
	if err != nil {
		return nil, err
	}

	return s.repo.ListLeaves(ctx, collegeID, student.ID)
}

// ApplyLeave validates and creates a new leave application.
func (s *StudentService) ApplyLeave(
	ctx context.Context,
	collegeID, userID uuid.UUID,
	userEmail string,
	req models.CreateLeaveRequest,
) (*models.LeaveRequest, error) {
	student, err := s.resolveStudent(ctx, collegeID, userID, userEmail)
	if err != nil {
		return nil, err
	}

	if req.EndDate.Before(req.StartDate) {
		return nil, ErrInvalidDateRange
	}

	consentStatus := "NOT_REQUIRED"
	if req.ParentConsent {
		consentStatus = "PENDING"
	}

	leave := &models.LeaveRequest{
		ID:                  uuid.New(),
		CollegeID:           collegeID,
		StudentID:           student.ID,
		LeaveType:           req.LeaveType,
		StartDate:           req.StartDate,
		EndDate:             req.EndDate,
		Reason:              req.Reason,
		ParentConsentStatus: consentStatus,
	}

	if err := s.repo.CreateLeave(ctx, leave); err != nil {
		return nil, fmt.Errorf("failed to apply leave: %w", err)
	}

	return leave, nil
}

// ListComplaints returns all grievances logged by the student.
func (s *StudentService) ListComplaints(ctx context.Context, collegeID, userID uuid.UUID, userEmail string) ([]models.Complaint, error) {
	student, err := s.resolveStudent(ctx, collegeID, userID, userEmail)
	if err != nil {
		return nil, err
	}

	return s.repo.ListComplaints(ctx, collegeID, student.ID)
}

// FileComplaint creates a new maintenance grievance for the student.
func (s *StudentService) FileComplaint(
	ctx context.Context,
	collegeID, userID uuid.UUID,
	userEmail string,
	req models.CreateComplaintRequest,
) (*models.Complaint, error) {
	student, err := s.resolveStudent(ctx, collegeID, userID, userEmail)
	if err != nil {
		return nil, err
	}

	room, _ := s.repo.GetCurrentBedAllocation(ctx, collegeID, student.ID)
	var hostelID, roomID *uuid.UUID
	if room != nil {
		hostelID = &room.HostelID
		roomID = &room.RoomID
	}

	complaint := &models.Complaint{
		ID:          uuid.New(),
		CollegeID:   collegeID,
		StudentID:   student.ID,
		HostelID:    hostelID,
		RoomID:      roomID,
		Category:    req.Category,
		Title:       req.Title,
		Description: req.Description,
		Priority:    req.Priority,
	}

	if err := s.repo.CreateComplaint(ctx, complaint); err != nil {
		return nil, fmt.Errorf("failed to file complaint: %w", err)
	}

	return complaint, nil
}

// GetTodayMessMenu returns daily mess items.
func (s *StudentService) GetTodayMessMenu(ctx context.Context, collegeID uuid.UUID) (*models.TodayMessMenu, error) {
	return s.repo.GetTodayMessMenu(ctx, collegeID)
}

// GetDashboardSummary aggregates all essential metrics for the student home screen.
func (s *StudentService) GetDashboardSummary(ctx context.Context, collegeID, userID uuid.UUID, userEmail string) (*models.DashboardSummary, error) {
	student, err := s.resolveStudent(ctx, collegeID, userID, userEmail)
	if err != nil {
		return nil, err
	}

	room, _ := s.repo.GetCurrentBedAllocation(ctx, collegeID, student.ID)
	student.CurrentRoom = room

	passes, _ := s.repo.ListGatePasses(ctx, collegeID, student.ID)
	leaves, _ := s.repo.ListLeaves(ctx, collegeID, student.ID)
	complaints, _ := s.repo.ListComplaints(ctx, collegeID, student.ID)
	attendance, _ := s.repo.GetAttendanceSummary(ctx, collegeID, student.ID)
	todayMeals, _ := s.repo.GetTodayMessMenu(ctx, collegeID)

	var activePass *models.GatePass
	for i := range passes {
		if passes[i].Status == "APPROVED" || passes[i].Status == "REQUESTED" {
			activePass = &passes[i]
			break
		}
	}

	var activeLeave *models.LeaveRequest
	now := time.Now()
	for i := range leaves {
		if (leaves[i].Status == "APPROVED" || leaves[i].Status == "PENDING") && leaves[i].EndDate.After(now) {
			activeLeave = &leaves[i]
			break
		}
	}

	openComplaintsCount := 0
	for _, c := range complaints {
		if c.Status == "PENDING" || c.Status == "IN_PROGRESS" || c.Status == "ASSIGNED" {
			openComplaintsCount++
		}
	}

	var attPct *float64
	if attendance != nil && attendance.TotalSessions > 0 {
		pct := attendance.AttendancePercentage
		attPct = &pct
	}

	// Compile real student activities from actual database records
	var activities []models.StudentActivity

	for _, p := range passes {
		activities = append(activities, models.StudentActivity{
			ID:          p.ID.String(),
			Type:        "GATE_PASS",
			Title:       fmt.Sprintf("Gate Pass %s", p.PassNumber),
			Description: fmt.Sprintf("Type: %s • %s", p.PassType, p.Reason),
			Timestamp:   p.CreatedAt,
			Status:      p.Status,
		})
	}

	for _, l := range leaves {
		activities = append(activities, models.StudentActivity{
			ID:          l.ID.String(),
			Type:        "LEAVE",
			Title:       fmt.Sprintf("Leave Application (%s)", l.LeaveType),
			Description: fmt.Sprintf("%s to %s • %s", l.StartDate.Format("02 Jan"), l.EndDate.Format("02 Jan"), l.Reason),
			Timestamp:   l.CreatedAt,
			Status:      l.Status,
		})
	}

	for _, c := range complaints {
		activities = append(activities, models.StudentActivity{
			ID:          c.ID.String(),
			Type:        "COMPLAINT",
			Title:       fmt.Sprintf("[%s] %s", c.Category, c.Title),
			Description: c.Description,
			Timestamp:   c.CreatedAt,
			Status:      c.Status,
		})
	}

	// Sort chronologically descending
	sort.Slice(activities, func(i, j int) bool {
		return activities[i].Timestamp.After(activities[j].Timestamp)
	})

	if len(activities) > 10 {
		activities = activities[:10]
	}
	if activities == nil {
		activities = []models.StudentActivity{}
	}

	summary := &models.DashboardSummary{
		Profile:           *student,
		CurrentRoom:       room,
		ActiveGatePass:    activePass,
		ActiveLeave:       activeLeave,
		AttendanceSummary: attendance,
		AttendancePercent: attPct,
		OpenComplaints:    openComplaintsCount,
		TodayMeals:        todayMeals,
		RecentPasses:      passes,
		RecentLeaves:      leaves,
		RecentComplaints:  complaints,
		RecentActivities:  activities,
	}

	return summary, nil
}

