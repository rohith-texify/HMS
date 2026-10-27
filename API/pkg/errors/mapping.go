package errors

import "net/http"

// HTTPStatus returns the HTTP status associated with an HMS API error.
func HTTPStatus(err *APIError) int {
	switch err.Code {

	case Unauthorized:
		return http.StatusUnauthorized

	case Forbidden, PermissionDenied:
		return http.StatusForbidden

	case ValidationError:
		return http.StatusBadRequest

	case NotFound:
		return http.StatusNotFound

	case Conflict:
		return http.StatusConflict

	case TenantSuspended,
		TenantInactive,
		AppDisabled,
		ModuleDisabled,
		FeatureDisabled:
		return http.StatusForbidden

	case RateLimited:
		return http.StatusTooManyRequests

	case ServiceUnavailable:
		return http.StatusServiceUnavailable

	case InternalError:
		return http.StatusInternalServerError

	default:
		return http.StatusInternalServerError
	}
}
