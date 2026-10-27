package errors

// APIError represents a controlled HMS API error.
type APIError struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

// Error implements the error interface.
func (e *APIError) Error() string {
	return e.Message
}

// New creates a new API error.
func New(
	code string,
	message string,
) *APIError {
	return &APIError{
		Code:    code,
		Message: message,
	}
}

// NewWithDetails creates an API error with additional details.
func NewWithDetails(
	code string,
	message string,
	details interface{},
) *APIError {
	return &APIError{
		Code:    code,
		Message: message,
		Details: details,
	}
}
