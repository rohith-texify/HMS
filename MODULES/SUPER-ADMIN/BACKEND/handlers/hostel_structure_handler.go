package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
)

type HostelStructureHandler struct {
	service *services.HostelStructureService
}

func NewHostelStructureHandler(service *services.HostelStructureService) *HostelStructureHandler {
	return &HostelStructureHandler{
		service: service,
	}
}

func parseCollegeID(c *gin.Context) (uuid.UUID, error) {
	raw := c.Param("id")
	if raw == "" {
		raw = c.Param("college_id")
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, apierrors.New(apierrors.ValidationError, "invalid college id")
	}
	return id, nil
}

// GetOverview handles GET /super-admin/colleges/:id/hostel-structure/overview
func (h *HostelStructureHandler) GetOverview(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	overview, err := h.service.GetOverview(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, overview)
}

// GetHierarchy handles GET /super-admin/colleges/:id/hostel-structure/tree
func (h *HostelStructureHandler) GetHierarchy(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var targetHostelID *uuid.UUID
	if hidStr := c.Query("hostel_id"); hidStr != "" {
		if hid, err := uuid.Parse(hidStr); err == nil {
			targetHostelID = &hid
		}
	}

	tree, err := h.service.GetHierarchy(c.Request.Context(), collegeID, targetHostelID)
	if err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, tree)
}

// --- Hostel CRUD ---

func (h *HostelStructureHandler) CreateHostel(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var input models.Hostel
	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid request body"))
		return
	}

	created, err := h.service.CreateHostel(c.Request.Context(), collegeID, &input, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, created)
}

func (h *HostelStructureHandler) UpdateHostel(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}
	hostelID, err := uuid.Parse(c.Param("hostel_id"))
	if err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid hostel id"))
		return
	}
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var input models.Hostel
	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid request body"))
		return
	}

	updated, err := h.service.UpdateHostel(c.Request.Context(), collegeID, hostelID, &input, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, updated)
}

func (h *HostelStructureHandler) DeleteHostel(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}
	hostelID, err := uuid.Parse(c.Param("hostel_id"))
	if err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid hostel id"))
		return
	}
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	if err := h.service.DeleteHostel(c.Request.Context(), collegeID, hostelID, actorID, actorRole); err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, gin.H{"deleted": true})
}

// --- Block CRUD ---

func (h *HostelStructureHandler) CreateBlock(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var input models.Block
	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid request body"))
		return
	}

	created, err := h.service.CreateBlock(c.Request.Context(), collegeID, &input, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, created)
}

func (h *HostelStructureHandler) UpdateBlock(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}
	blockID, err := uuid.Parse(c.Param("block_id"))
	if err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid block id"))
		return
	}
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var input models.Block
	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid request body"))
		return
	}

	updated, err := h.service.UpdateBlock(c.Request.Context(), collegeID, blockID, &input, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, updated)
}

func (h *HostelStructureHandler) DeleteBlock(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}
	blockID, err := uuid.Parse(c.Param("block_id"))
	if err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid block id"))
		return
	}
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	if err := h.service.DeleteBlock(c.Request.Context(), collegeID, blockID, actorID, actorRole); err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, gin.H{"deleted": true})
}

// --- Floor CRUD ---

func (h *HostelStructureHandler) CreateFloor(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var input models.Floor
	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid request body"))
		return
	}

	created, err := h.service.CreateFloor(c.Request.Context(), collegeID, &input, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, created)
}

func (h *HostelStructureHandler) UpdateFloor(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}
	floorID, err := uuid.Parse(c.Param("floor_id"))
	if err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid floor id"))
		return
	}
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var input models.Floor
	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid request body"))
		return
	}

	updated, err := h.service.UpdateFloor(c.Request.Context(), collegeID, floorID, &input, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, updated)
}

func (h *HostelStructureHandler) DeleteFloor(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}
	floorID, err := uuid.Parse(c.Param("floor_id"))
	if err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid floor id"))
		return
	}
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	if err := h.service.DeleteFloor(c.Request.Context(), collegeID, floorID, actorID, actorRole); err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, gin.H{"deleted": true})
}

// --- Room CRUD ---

func (h *HostelStructureHandler) CreateRoom(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var input models.Room
	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid request body"))
		return
	}

	created, err := h.service.CreateRoom(c.Request.Context(), collegeID, &input, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, created)
}

func (h *HostelStructureHandler) UpdateRoom(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}
	roomID, err := uuid.Parse(c.Param("room_id"))
	if err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid room id"))
		return
	}
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var input models.Room
	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid request body"))
		return
	}

	updated, err := h.service.UpdateRoom(c.Request.Context(), collegeID, roomID, &input, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, updated)
}

func (h *HostelStructureHandler) DeleteRoom(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}
	roomID, err := uuid.Parse(c.Param("room_id"))
	if err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid room id"))
		return
	}
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	if err := h.service.DeleteRoom(c.Request.Context(), collegeID, roomID, actorID, actorRole); err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, gin.H{"deleted": true})
}

// --- Bed CRUD ---

func (h *HostelStructureHandler) CreateBed(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var input models.Bed
	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid request body"))
		return
	}

	created, err := h.service.CreateBed(c.Request.Context(), collegeID, &input, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, created)
}

func (h *HostelStructureHandler) UpdateBed(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}
	bedID, err := uuid.Parse(c.Param("bed_id"))
	if err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid bed id"))
		return
	}
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var input models.Bed
	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid request body"))
		return
	}

	updated, err := h.service.UpdateBed(c.Request.Context(), collegeID, bedID, &input, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, updated)
}

func (h *HostelStructureHandler) DeleteBed(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}
	bedID, err := uuid.Parse(c.Param("bed_id"))
	if err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid bed id"))
		return
	}
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	if err := h.service.DeleteBed(c.Request.Context(), collegeID, bedID, actorID, actorRole); err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, gin.H{"deleted": true})
}

// --- Bulk Generation ---

func (h *HostelStructureHandler) PreviewBulk(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var input models.BulkGenerationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid request body"))
		return
	}

	preview, err := h.service.ValidateAndPreviewBulk(c.Request.Context(), collegeID, &input)
	if err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, preview)
}

func (h *HostelStructureHandler) GenerateBulk(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var input models.BulkGenerationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid request body"))
		return
	}

	created, err := h.service.GenerateBulkStructure(c.Request.Context(), collegeID, &input, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, created)
}

// --- CSV Import ---

func (h *HostelStructureHandler) DownloadCSVTemplate(c *gin.Context) {
	data := h.service.GetCSVTemplate()
	c.Header("Content-Disposition", "attachment; filename=hostel_structure_template.csv")
	c.Data(http.StatusOK, "text/csv; charset=utf-8", data)
}

func (h *HostelStructureHandler) PreviewCSV(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	file, _, err := c.Request.FormFile("file")
	if err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "file is required"))
		return
	}
	defer file.Close()

	result, _, err := h.service.ValidateCSV(c.Request.Context(), collegeID, file)
	if err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, result)
}

func (h *HostelStructureHandler) ImportCSV(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	file, _, err := c.Request.FormFile("file")
	if err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "file is required"))
		return
	}
	defer file.Close()

	result, err := h.service.ImportCSV(c.Request.Context(), collegeID, file, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, result)
}

// --- Structure Cloning ---

func (h *HostelStructureHandler) PreviewClone(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var input models.CloneStructureInput
	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid request body"))
		return
	}

	preview, err := h.service.PreviewClone(c.Request.Context(), collegeID, &input)
	if err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, preview)
}

func (h *HostelStructureHandler) ApplyClone(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var input models.CloneStructureInput
	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid request body"))
		return
	}

	applied, err := h.service.ApplyClone(c.Request.Context(), collegeID, &input, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, applied)
}

// --- Policy & Locking ---

func (h *HostelStructureHandler) GetPolicy(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	policy, err := h.service.GetPolicy(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, policy)
}

func (h *HostelStructureHandler) UpdatePolicy(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var policy models.StructureEditPolicy
	if err := c.ShouldBindJSON(&policy); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid request body"))
		return
	}

	saved, err := h.service.UpdatePolicy(c.Request.Context(), collegeID, &policy, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, saved)
}

func (h *HostelStructureHandler) ToggleLock(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var input models.LockToggleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "invalid request body"))
		return
	}

	if err := h.service.ToggleLock(c.Request.Context(), collegeID, &input, actorID, actorRole); err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, gin.H{"locked": input.Lock})
}

func (h *HostelStructureHandler) ListAudits(c *gin.Context) {
	collegeID, err := parseCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	limit := 30
	if lStr := c.Query("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil {
			limit = l
		}
	}

	list, err := h.service.ListAudits(c.Request.Context(), collegeID, limit)
	if err != nil {
		respondError(c, err)
		return
	}
	response.OK(c, list)
}
