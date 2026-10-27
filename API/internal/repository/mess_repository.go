package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type MealType string

const (
	MealTypeBreakfast MealType = "BREAKFAST"
	MealTypeLunch     MealType = "LUNCH"
	MealTypeSnacks    MealType = "SNACKS"
	MealTypeDinner    MealType = "DINNER"
)

type MealTimingStatus string

const (
	MealTimingActive   MealTimingStatus = "ACTIVE"
	MealTimingInactive MealTimingStatus = "INACTIVE"
)

type MealTiming struct {
	ID        uuid.UUID        `json:"id"`
	CollegeID uuid.UUID        `json:"college_id"`
	HostelID  uuid.UUID        `json:"hostel_id"`
	MealType  MealType         `json:"meal_type"`
	StartTime time.Time        `json:"start_time"` // We map time directly; the DB driver handles it
	EndTime   time.Time        `json:"end_time"`
	Status    MealTimingStatus `json:"status"`
	CreatedBy uuid.UUID        `json:"created_by"`
	UpdatedBy *uuid.UUID       `json:"updated_by,omitempty"`
	CreatedAt time.Time        `json:"created_at"`
	UpdatedAt time.Time        `json:"updated_at"`
}

type MealMenuStatus string

const (
	MealMenuDraft     MealMenuStatus = "DRAFT"
	MealMenuPublished MealMenuStatus = "PUBLISHED"
	MealMenuCancelled MealMenuStatus = "CANCELLED"
)

type MealMenu struct {
	ID        uuid.UUID      `json:"id"`
	CollegeID uuid.UUID      `json:"college_id"`
	HostelID  uuid.UUID      `json:"hostel_id"`
	MenuDate  time.Time      `json:"menu_date"`
	MealType  MealType       `json:"meal_type"`
	Items     string         `json:"items"`
	Status    MealMenuStatus `json:"status"`
	CreatedBy uuid.UUID      `json:"created_by"`
	UpdatedBy *uuid.UUID     `json:"updated_by,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
}

type MessNoticeStatus string

const (
	MessNoticeDraft     MessNoticeStatus = "DRAFT"
	MessNoticePublished MessNoticeStatus = "PUBLISHED"
	MessNoticeExpired   MessNoticeStatus = "EXPIRED"
	MessNoticeCancelled MessNoticeStatus = "CANCELLED"
)

type MessNotice struct {
	ID          uuid.UUID        `json:"id"`
	CollegeID   uuid.UUID        `json:"college_id"`
	HostelID    uuid.UUID        `json:"hostel_id"`
	Title       string           `json:"title"`
	Content     string           `json:"content"`
	Status      MessNoticeStatus `json:"status"`
	PublishAt   *time.Time       `json:"publish_at,omitempty"`
	ExpiresAt   *time.Time       `json:"expires_at,omitempty"`
	PublishedBy *uuid.UUID       `json:"published_by,omitempty"`
	CreatedBy   uuid.UUID        `json:"created_by"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
}

type FoodFeedback struct {
	ID        uuid.UUID `json:"id"`
	CollegeID uuid.UUID `json:"college_id"`
	StudentID uuid.UUID `json:"student_id"`
	MenuID    uuid.UUID `json:"menu_id"`
	Rating    int16     `json:"rating"`
	Comment   *string   `json:"comment,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type TodayMealMenu struct {
	MealMenuID uuid.UUID `json:"meal_menu_id"`
	CollegeID  uuid.UUID `json:"college_id"`
	HostelID   uuid.UUID `json:"hostel_id"`
	HostelCode string    `json:"hostel_code"`
	HostelName string    `json:"hostel_name"`
	MenuDate   time.Time `json:"menu_date"`
	MealType   string    `json:"meal_type"`
	Items      string    `json:"items"`
	Status     string    `json:"status"`
}

var ErrMessNotFound = ErrNotFound

// --- Meal Timings ---

func (r *Repository) CreateMealTiming(ctx context.Context, mt *MealTiming) error {
	query := `
		INSERT INTO app.meal_timings (college_id, hostel_id, meal_type, start_time, end_time, status, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
		RETURNING id, created_at, updated_at
	`
	err := r.Executor(ctx).QueryRow(ctx, query,
		mt.CollegeID, mt.HostelID, mt.MealType, mt.StartTime, mt.EndTime, mt.Status, mt.CreatedBy,
	).Scan(&mt.ID, &mt.CreatedAt, &mt.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create meal timing: %w", err)
	}
	return nil
}

func (r *Repository) GetMealTiming(ctx context.Context, collegeID, id uuid.UUID) (*MealTiming, error) {
	query := `
		SELECT id, college_id, hostel_id, meal_type, start_time, end_time, status, created_by, updated_by, created_at, updated_at
		FROM app.meal_timings
		WHERE college_id = $1 AND id = $2
	`
	var mt MealTiming
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID, id).Scan(
		&mt.ID, &mt.CollegeID, &mt.HostelID, &mt.MealType, &mt.StartTime, &mt.EndTime, &mt.Status, &mt.CreatedBy, &mt.UpdatedBy, &mt.CreatedAt, &mt.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrMessNotFound
		}
		return nil, err
	}
	return &mt, nil
}

func (r *Repository) ListMealTimings(ctx context.Context, collegeID, hostelID uuid.UUID) ([]MealTiming, error) {
	query := `
		SELECT id, college_id, hostel_id, meal_type, start_time, end_time, status, created_by, updated_by, created_at, updated_at
		FROM app.meal_timings
		WHERE college_id = $1 AND hostel_id = $2
	`
	rows, err := r.Executor(ctx).Query(ctx, query, collegeID, hostelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var timings []MealTiming
	for rows.Next() {
		var mt MealTiming
		if err := rows.Scan(&mt.ID, &mt.CollegeID, &mt.HostelID, &mt.MealType, &mt.StartTime, &mt.EndTime, &mt.Status, &mt.CreatedBy, &mt.UpdatedBy, &mt.CreatedAt, &mt.UpdatedAt); err != nil {
			return nil, err
		}
		timings = append(timings, mt)
	}
	return timings, nil
}

// --- Meal Menus ---

func (r *Repository) CreateMealMenu(ctx context.Context, m *MealMenu) error {
	query := `
		INSERT INTO app.meal_menus (college_id, hostel_id, menu_date, meal_type, items, status, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
		RETURNING id, created_at, updated_at
	`
	err := r.Executor(ctx).QueryRow(ctx, query,
		m.CollegeID, m.HostelID, m.MenuDate, m.MealType, m.Items, m.Status, m.CreatedBy,
	).Scan(&m.ID, &m.CreatedAt, &m.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create meal menu: %w", err)
	}
	return nil
}

func (r *Repository) GetMealMenu(ctx context.Context, collegeID, id uuid.UUID) (*MealMenu, error) {
	query := `
		SELECT id, college_id, hostel_id, menu_date, meal_type, items, status, created_by, updated_by, created_at, updated_at
		FROM app.meal_menus
		WHERE college_id = $1 AND id = $2
	`
	var m MealMenu
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID, id).Scan(
		&m.ID, &m.CollegeID, &m.HostelID, &m.MenuDate, &m.MealType, &m.Items, &m.Status, &m.CreatedBy, &m.UpdatedBy, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrMessNotFound
		}
		return nil, err
	}
	return &m, nil
}

func (r *Repository) ListMealMenus(ctx context.Context, collegeID, hostelID uuid.UUID) ([]MealMenu, error) {
	query := `
		SELECT id, college_id, hostel_id, menu_date, meal_type, items, status, created_by, updated_by, created_at, updated_at
		FROM app.meal_menus
		WHERE college_id = $1 AND hostel_id = $2
		ORDER BY menu_date DESC
	`
	rows, err := r.Executor(ctx).Query(ctx, query, collegeID, hostelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var menus []MealMenu
	for rows.Next() {
		var m MealMenu
		if err := rows.Scan(&m.ID, &m.CollegeID, &m.HostelID, &m.MenuDate, &m.MealType, &m.Items, &m.Status, &m.CreatedBy, &m.UpdatedBy, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		menus = append(menus, m)
	}
	return menus, nil
}

// --- Food Feedback ---

func (r *Repository) CreateFoodFeedback(ctx context.Context, f *FoodFeedback) error {
	query := `
		INSERT INTO app.food_feedback (college_id, student_id, menu_id, rating, comment, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, now(), now())
		RETURNING id, created_at, updated_at
	`
	err := r.Executor(ctx).QueryRow(ctx, query,
		f.CollegeID, f.StudentID, f.MenuID, f.Rating, f.Comment,
	).Scan(&f.ID, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create food feedback: %w", err)
	}
	return nil
}

// --- Today's Menu View ---

func (r *Repository) GetTodayMenus(ctx context.Context, collegeID uuid.UUID) ([]TodayMealMenu, error) {
	query := `
		SELECT meal_menu_id, college_id, hostel_id, hostel_code, hostel_name, menu_date, meal_type, items, status
		FROM app.v_today_meal_menus
		WHERE college_id = $1
	`
	rows, err := r.Executor(ctx).Query(ctx, query, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []TodayMealMenu
	for rows.Next() {
		var m TodayMealMenu
		if err := rows.Scan(&m.MealMenuID, &m.CollegeID, &m.HostelID, &m.HostelCode, &m.HostelName, &m.MenuDate, &m.MealType, &m.Items, &m.Status); err != nil {
			return nil, err
		}
		list = append(list, m)
	}
	return list, nil
}
