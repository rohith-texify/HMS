package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/models"
)

// ListMealTimings returns dining serving hours for a hostel.
func (r *Repository) ListMealTimings(ctx context.Context, collegeID, hostelID uuid.UUID) ([]models.MealTiming, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, college_id, hostel_id, meal_type, start_time, end_time, created_at
		FROM app.meal_timings
		WHERE college_id = $1 AND hostel_id = $2
		ORDER BY start_time ASC
	`

	rows, err := db.Query(ctx, query, collegeID, hostelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var timings []models.MealTiming
	for rows.Next() {
		var t models.MealTiming
		if err := rows.Scan(
			&t.ID, &t.CollegeID, &t.HostelID, &t.MealType,
			&t.StartTime, &t.EndTime, &t.CreatedAt,
		); err != nil {
			return nil, err
		}
		timings = append(timings, t)
	}
	return timings, nil
}

// ListMealMenus returns dining menu schedules for a hostel.
func (r *Repository) ListMealMenus(ctx context.Context, collegeID, hostelID uuid.UUID) ([]models.MealMenu, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, college_id, hostel_id, day_of_week, meal_type, menu_items, created_at
		FROM app.meal_menus
		WHERE college_id = $1 AND hostel_id = $2
		ORDER BY day_of_week ASC
	`

	rows, err := db.Query(ctx, query, collegeID, hostelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var menus []models.MealMenu
	for rows.Next() {
		var m models.MealMenu
		if err := rows.Scan(
			&m.ID, &m.CollegeID, &m.HostelID, &m.DayOfWeek,
			&m.MealType, &m.MenuItems, &m.CreatedAt,
		); err != nil {
			return nil, err
		}
		menus = append(menus, m)
	}
	return menus, nil
}

