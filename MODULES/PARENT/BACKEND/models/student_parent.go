package models

import (
	"time"

	"github.com/google/uuid"
)

// StudentParent represents an association link between a student and a parent.
type StudentParent struct {
	ID                      uuid.UUID `json:"id"`
	CollegeID               uuid.UUID `json:"college_id"`
	StudentID               uuid.UUID `json:"student_id"`
	ParentID                uuid.UUID `json:"parent_id"`
	Relationship            string    `json:"relationship"`
	IsPrimary               bool      `json:"is_primary"`
	CanReceiveNotifications bool      `json:"can_receive_notifications"`
	CanPickupStudent        bool      `json:"can_pickup_student"`
	CreatedAt               time.Time `json:"created_at"`
	UpdatedAt               time.Time `json:"updated_at"`
}

// ListStudentParentsParams defines parameters for listing parents associated with a student.
type ListStudentParentsParams struct {
	CollegeID uuid.UUID
	StudentID uuid.UUID
	Limit     int
	Offset    int
}

// CreateStudentParentParams defines fields for associating a parent with a student.
type CreateStudentParentParams struct {
	CollegeID               uuid.UUID
	StudentID               uuid.UUID
	ParentID                uuid.UUID
	Relationship            string
	IsPrimary               bool
	CanReceiveNotifications bool
	CanPickupStudent        bool
}

// UpdateStudentParentParams defines fields for modifying a student-parent association.
type UpdateStudentParentParams struct {
	CollegeID               uuid.UUID
	StudentID               uuid.UUID
	ID                      uuid.UUID
	Relationship            string
	IsPrimary               bool
	CanReceiveNotifications bool
	CanPickupStudent        bool
}

