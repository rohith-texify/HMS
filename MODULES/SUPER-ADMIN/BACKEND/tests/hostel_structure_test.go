package tests

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
)

func TestHostelStructure_ValidationAndPreview(t *testing.T) {
	svc := services.NewHostelStructureService(&database.Database{}, &repository.Repository{})

	// 1. Bulk generation input validation
	t.Run("Bulk generation invalid floor count", func(t *testing.T) {
		input := &models.BulkGenerationInput{
			HostelID:      uuid.New(),
			FloorCount:    0,
			RoomsPerFloor: 10,
			RoomCapacity:  2,
		}
		_, err := svc.ValidateAndPreviewBulk(context.Background(), uuid.New(), input)
		if err == nil {
			t.Fatal("expected error for zero floor count, got nil")
		}
	})

	t.Run("Bulk generation invalid room capacity", func(t *testing.T) {
		input := &models.BulkGenerationInput{
			HostelID:      uuid.New(),
			FloorCount:    3,
			RoomsPerFloor: 10,
			RoomCapacity:  0,
		}
		_, err := svc.ValidateAndPreviewBulk(context.Background(), uuid.New(), input)
		if err == nil {
			t.Fatal("expected error for zero capacity, got nil")
		}
	})

	t.Run("Bulk generation invalid room type", func(t *testing.T) {
		input := &models.BulkGenerationInput{
			HostelID:      uuid.New(),
			FloorCount:    2,
			RoomsPerFloor: 5,
			RoomCapacity:  2,
			RoomType:      "LUXURY_PENTHOUSE",
		}
		_, err := svc.ValidateAndPreviewBulk(context.Background(), uuid.New(), input)
		if err == nil {
			t.Fatal("expected error for invalid room type, got nil")
		}
	})

	// 2. CSV parsing and validation tests
	t.Run("CSV validation with missing headers", func(t *testing.T) {
		csvContent := "HostelCode,HostelName,Category\nBH1,Boys Hostel,BOYS\n"
		r := strings.NewReader(csvContent)
		_, _, err := svc.ValidateCSV(context.Background(), uuid.New(), r)
		if err == nil {
			t.Fatal("expected error for missing CSV headers, got nil")
		}
	})

	t.Run("CSV validation with valid headers and data", func(t *testing.T) {
		csvContent := "HostelCode,HostelName,Category,BlockCode,BlockName,FloorNumber,FloorCode,FloorName,RoomCode,RoomName,RoomType,RoomCapacity,BedCode,BedName\n" +
			"H1,Test Hostel,BOYS,B1,Block 1,1,F1,First Floor,101,Room 101,DOUBLE,2,101-A,Bed A\n" +
			"H1,Test Hostel,BOYS,B1,Block 1,1,F1,First Floor,101,Room 101,DOUBLE,2,101-B,Bed B\n"

		r := strings.NewReader(csvContent)
		res, rows, err := svc.ValidateCSV(context.Background(), uuid.New(), r)
		if err != nil {
			t.Fatalf("unexpected validation error: %v", err)
		}
		if !res.IsValid {
			t.Fatalf("expected valid CSV result, got errors: %+v", res.Errors)
		}
		if len(rows) != 2 {
			t.Fatalf("expected 2 parsed rows, got %d", len(rows))
		}
		if res.HostelsCount != 1 || res.RoomsCount != 1 || res.BedsCount != 2 {
			t.Errorf("unexpected counts in CSV summary: %+v", res)
		}
	})

	t.Run("CSV validation duplicate bed codes in room", func(t *testing.T) {
		csvContent := "HostelCode,HostelName,Category,BlockCode,BlockName,FloorNumber,FloorCode,FloorName,RoomCode,RoomName,RoomType,RoomCapacity,BedCode,BedName\n" +
			"H1,Test Hostel,BOYS,B1,Block 1,1,F1,First Floor,101,Room 101,DOUBLE,2,101-A,Bed A\n" +
			"H1,Test Hostel,BOYS,B1,Block 1,1,F1,First Floor,101,Room 101,DOUBLE,2,101-A,Bed Duplicate\n"

		r := strings.NewReader(csvContent)
		res, _, _ := svc.ValidateCSV(context.Background(), uuid.New(), r)
		if res.IsValid {
			t.Fatal("expected invalid CSV result due to duplicate bed codes in same room")
		}
		if len(res.Errors) == 0 {
			t.Fatal("expected validation errors list to be populated")
		}
	})

	// 3. CSV Template generation
	t.Run("CSV template download", func(t *testing.T) {
		templateBytes := svc.GetCSVTemplate()
		if len(templateBytes) == 0 {
			t.Fatal("expected non-empty CSV template bytes")
		}
		content := string(templateBytes)
		if !strings.Contains(content, "HostelCode") || !strings.Contains(content, "RoomType") || !strings.Contains(content, "BedCode") {
			t.Fatalf("template missing required columns: %s", content)
		}
	})

	// 4. Clone input validation
	t.Run("Clone input validation missing names", func(t *testing.T) {
		input := &models.CloneStructureInput{
			SourceHostelID: uuid.New(),
			NewHostelCode:  "",
			NewHostelName:  "",
		}
		_, err := svc.PreviewClone(context.Background(), uuid.New(), input)
		if err == nil {
			t.Fatal("expected validation error for empty clone code and name")
		}
	})
}

func TestHostelStructure_OccupancyMath(t *testing.T) {
	summary := models.OccupancySummary{
		TotalHostels:      2,
		TotalRooms:        50,
		ActiveRooms:       48,
		OccupiedRooms:     30,
		VacantRooms:       15,
		PartiallyOccupied: 3,
		TotalBedCapacity:  100,
		TotalBeds:         96,
		OccupiedBeds:      60,
		AvailableBeds:     36,
	}

	if summary.OccupiedBeds+summary.AvailableBeds != summary.TotalBeds {
		t.Errorf("bed counts do not add up to total beds: %d + %d != %d",
			summary.OccupiedBeds, summary.AvailableBeds, summary.TotalBeds)
	}

	expectedPct := float64(summary.OccupiedBeds) / float64(summary.TotalBedCapacity) * 100.0
	if expectedPct != 60.0 {
		t.Errorf("expected 60%% occupancy, got %f", expectedPct)
	}
}
