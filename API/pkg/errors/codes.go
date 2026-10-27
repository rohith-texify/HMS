package errors

// Standard HMS API error codes.
//
// These codes are part of the public API contract.
// Clients should use the code rather than parsing the message.
const (
	// Authentication / authorization.
	Unauthorized     = "UNAUTHORIZED"
	Forbidden        = "FORBIDDEN"
	PermissionDenied = "PERMISSION_DENIED"

	// Request validation.
	ValidationError = "VALIDATION_ERROR"

	// Resource errors.
	NotFound = "NOT_FOUND"
	Conflict = "CONFLICT"

	// Tenant lifecycle.
	TenantSuspended = "TENANT_SUSPENDED"
	TenantInactive  = "TENANT_INACTIVE"

	// Application entitlement.
	AppDisabled     = "APP_DISABLED"
	ModuleDisabled  = "MODULE_DISABLED"
	FeatureDisabled = "FEATURE_DISABLED"

	// Infrastructure / operational.
	RateLimited        = "RATE_LIMITED"
	InternalError      = "INTERNAL_ERROR"
	ServiceUnavailable = "SERVICE_UNAVAILABLE"
)
