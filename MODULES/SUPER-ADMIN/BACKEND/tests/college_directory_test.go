package tests

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
)

// TestListCollegesParams_Validation verifies search query length and pagination limits.
func TestListCollegesParams_Validation(t *testing.T) {
	// 1. Valid params
	validParams := &models.ListCollegesParams{
		Status: "ACTIVE",
		Search: "National Institute",
		Limit:  50,
		Offset: 0,
	}
	if err := validators.ValidateListCollegesParams(validParams); err != nil {
		t.Fatalf("expected valid params to pass, got: %v", err)
	}

	// 2. Search exceeding 100 characters must be rejected
	longSearch := strings.Repeat("A", 101)
	invalidParams := &models.ListCollegesParams{
		Search: longSearch,
		Limit:  20,
	}
	err := validators.ValidateListCollegesParams(invalidParams)
	if err == nil {
		t.Fatalf("expected search length > 100 to fail validation, got nil")
	}
	apiErr, ok := err.(*apierrors.APIError)
	if !ok || apiErr.Code != apierrors.ValidationError {
		t.Fatalf("expected ValidationError, got: %v", err)
	}

	// 3. Search <= 100 characters must pass
	exactSearch := strings.Repeat("B", 100)
	exactParams := &models.ListCollegesParams{
		Search: exactSearch,
		Limit:  20,
	}
	if err := validators.ValidateListCollegesParams(exactParams); err != nil {
		t.Fatalf("expected search length 100 to pass, got: %v", err)
	}

	// 4. Invalid status must be rejected
	invalidStatusParams := &models.ListCollegesParams{
		Status: "DELETED",
	}
	if err := validators.ValidateListCollegesParams(invalidStatusParams); err == nil {
		t.Fatalf("expected invalid status to be rejected, got nil")
	}

	// 5. Negative limit must be rejected
	negLimitParams := &models.ListCollegesParams{
		Limit: -5,
	}
	if err := validators.ValidateListCollegesParams(negLimitParams); err == nil {
		t.Fatalf("expected negative limit to be rejected, got nil")
	}

	// 6. Limit exceeding 100 must be rejected
	excessLimitParams := &models.ListCollegesParams{
		Limit: 150,
	}
	if err := validators.ValidateListCollegesParams(excessLimitParams); err == nil {
		t.Fatalf("expected limit > 100 to be rejected, got nil")
	}

	// 7. Negative offset must be rejected
	negOffsetParams := &models.ListCollegesParams{
		Offset: -1,
	}
	if err := validators.ValidateListCollegesParams(negOffsetParams); err == nil {
		t.Fatalf("expected negative offset to be rejected, got nil")
	}
}

// TestCollegeService_ListColleges_FailClosed verifies fail-closed error handling when unconfigured.
func TestCollegeService_ListColleges_FailClosed(t *testing.T) {
	ctx := context.Background()

	// Nil service
	var nilSvc *services.CollegeService
	_, _, err := nilSvc.ListColleges(ctx, models.ListCollegesParams{Search: "test"})
	if err == nil {
		t.Fatalf("expected error from nil service, got nil")
	}
	apiErr, ok := err.(*apierrors.APIError)
	if !ok || apiErr.Code != apierrors.InternalError {
		t.Fatalf("expected InternalError code, got: %v", err)
	}

	// Unconfigured service (nil repo)
	unconfSvc := services.NewCollegeService(nil, nil)
	_, _, err = unconfSvc.ListColleges(ctx, models.ListCollegesParams{Search: "test"})
	if err == nil {
		t.Fatalf("expected error from unconfigured service, got nil")
	}
}

// TestCollegeService_GetCollege_NilID verifies that querying with Nil UUID returns ValidationError.
func TestCollegeService_GetCollege_NilID(t *testing.T) {
	ctx := context.Background()
	svc := services.NewCollegeService(nil, nil)

	_, err := svc.GetCollege(ctx, uuid.Nil)
	if err == nil {
		t.Fatalf("expected validation error for uuid.Nil, got nil")
	}
}
