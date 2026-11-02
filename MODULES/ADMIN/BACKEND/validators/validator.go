package validators

import (
	"errors"
	"strings"

	"github.com/google/uuid"
)

// ValidateUUID parses and validates a UUID string.
func ValidateUUID(idStr, fieldName string) (uuid.UUID, error) {
	trimmed := strings.TrimSpace(idStr)
	if trimmed == "" {
		return uuid.Nil, errors.New(fieldName + " is required")
	}
	id, err := uuid.Parse(trimmed)
	if err != nil {
		return uuid.Nil, errors.New("invalid " + fieldName + " format")
	}
	return id, nil
}

// ValidateRequiredString checks that a string is non-empty.
func ValidateRequiredString(val, fieldName string) error {
	if strings.TrimSpace(val) == "" {
		return errors.New(fieldName + " cannot be empty")
	}
	return nil
}

