package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/yourusername/hostel-management-system/API/internal/database"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

var (
	ErrInvalidMealType  = errors.New("invalid meal type")
	ErrInvalidTimeRange = errors.New("start time must be before end time")
	ErrInvalidRating    = errors.New("rating must be between 1 and 5")
)

type MessService struct {
	db   *database.Database
	repo *repository.Repository
}

func NewMessService(db *database.Database, repo *repository.Repository) *MessService {
	return &MessService{
		db:   db,
		repo: repo,
	}
}

type CreateMealTimingRequest struct {
	HostelID  uuid.UUID `json:"hostel_id" binding:"required"`
	MealType  string    `json:"meal_type" binding:"required"`
	StartTime time.Time `json:"start_time" binding:"required"`
	EndTime   time.Time `json:"end_time" binding:"required"`
}

type CreateMealMenuRequest struct {
	HostelID uuid.UUID `json:"hostel_id" binding:"required"`
	MenuDate time.Time `json:"menu_date" binding:"required"`
	MealType string    `json:"meal_type" binding:"required"`
	Items    string    `json:"items" binding:"required"`
}

type CreateFoodFeedbackRequest struct {
	StudentID uuid.UUID `json:"student_id" binding:"required"`
	MenuID    uuid.UUID `json:"menu_id" binding:"required"`
	Rating    int16     `json:"rating" binding:"required"`
	Comment   *string   `json:"comment"`
}

func isValidMealType(t string) bool {
	switch repository.MealType(t) {
	case repository.MealTypeBreakfast, repository.MealTypeLunch, repository.MealTypeSnacks, repository.MealTypeDinner:
		return true
	}
	return false
}

func (s *MessService) CreateMealTiming(ctx context.Context, collegeID, createdBy uuid.UUID, req CreateMealTimingRequest) (*repository.MealTiming, error) {
	if !isValidMealType(req.MealType) {
		return nil, ErrInvalidMealType
	}
	// start time must be before end time
	if req.StartTime.After(req.EndTime) || req.StartTime.Equal(req.EndTime) {
		return nil, ErrInvalidTimeRange
	}

	mt := &repository.MealTiming{
		CollegeID: collegeID,
		HostelID:  req.HostelID,
		MealType:  repository.MealType(req.MealType),
		StartTime: req.StartTime,
		EndTime:   req.EndTime,
		Status:    repository.MealTimingActive,
		CreatedBy: createdBy,
	}

	if err := s.repo.CreateMealTiming(ctx, mt); err != nil {
		return nil, err
	}
	return mt, nil
}

func (s *MessService) ListMealTimings(ctx context.Context, collegeID, hostelID uuid.UUID) ([]repository.MealTiming, error) {
	return s.repo.ListMealTimings(ctx, collegeID, hostelID)
}

func (s *MessService) CreateMealMenu(ctx context.Context, collegeID, createdBy uuid.UUID, req CreateMealMenuRequest) (*repository.MealMenu, error) {
	if !isValidMealType(req.MealType) {
		return nil, ErrInvalidMealType
	}

	m := &repository.MealMenu{
		CollegeID: collegeID,
		HostelID:  req.HostelID,
		MenuDate:  req.MenuDate,
		MealType:  repository.MealType(req.MealType),
		Items:     req.Items,
		Status:    repository.MealMenuPublished, // Or DRAFT depending on requirements
		CreatedBy: createdBy,
	}

	if err := s.repo.CreateMealMenu(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *MessService) ListMealMenus(ctx context.Context, collegeID, hostelID uuid.UUID) ([]repository.MealMenu, error) {
	return s.repo.ListMealMenus(ctx, collegeID, hostelID)
}

func (s *MessService) CreateFoodFeedback(ctx context.Context, collegeID uuid.UUID, req CreateFoodFeedbackRequest) (*repository.FoodFeedback, error) {
	if req.Rating < 1 || req.Rating > 5 {
		return nil, ErrInvalidRating
	}

	f := &repository.FoodFeedback{
		CollegeID: collegeID,
		StudentID: req.StudentID,
		MenuID:    req.MenuID,
		Rating:    req.Rating,
		Comment:   req.Comment,
	}

	if err := s.repo.CreateFoodFeedback(ctx, f); err != nil {
		return nil, err
	}
	return f, nil
}

func (s *MessService) GetTodayMenus(ctx context.Context, collegeID uuid.UUID) ([]repository.TodayMealMenu, error) {
	return s.repo.GetTodayMenus(ctx, collegeID)
}
