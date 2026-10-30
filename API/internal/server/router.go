package server

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/yourusername/hostel-management-system/API/internal/auth"
	"github.com/yourusername/hostel-management-system/API/internal/config"
	"github.com/yourusername/hostel-management-system/API/internal/database"
	"github.com/yourusername/hostel-management-system/API/internal/middleware"
	"github.com/yourusername/hostel-management-system/API/internal/notifications/telegram"
	"github.com/yourusername/hostel-management-system/API/internal/geo"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
	"github.com/yourusername/hostel-management-system/API/internal/service"
	superadminroutes "github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/routes"
)

func NewRouter(
	logger *zap.Logger,
	db *database.Database,
	jwtService *auth.JWTService,
	cfg *config.Config,
	telegramClient *telegram.Client,
) *gin.Engine {
	router := gin.New()

	// Security: Explicitly trust no proxies by default unless configured
	router.SetTrustedProxies(nil)

	router.Use(middleware.RequestID())
	router.Use(middleware.Recovery(logger))
	router.Use(middleware.Logger(logger))
	router.Use(middleware.CORS(middleware.CORSConfig{
		AllowedOrigins: cfg.CORS.AllowedOrigins,
		AllowedMethods: []string{
			"GET",
			"POST",
			"PUT",
			"PATCH",
			"DELETE",
			"OPTIONS",
		},
		AllowedHeaders: []string{
			"Origin",
			"Content-Type",
			"Accept",
			"Authorization",
			"X-Request-ID",
			"X-Scope",
			"X-Tenant-ID",
		},
	}))

	// Enforce Rate Limiting globally across the API
	router.Use(middleware.RateLimit(cfg.RateLimit, telegramClient, logger))

	// Limit request body size to 1MB globally to prevent memory exhaustion
	router.Use(func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1<<20)
		c.Next()
	})

	// Add API security headers
	router.Use(func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Content-Security-Policy", "default-src 'none'")
		c.Next()
	})

	router.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"success": true,
			"service": "hms-backend",
			"status":  "healthy",
		})
	})
	router.HEAD("/", func(c *gin.Context) {
		c.Status(200)
	})

	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"success": true,
			"data": gin.H{
				"status": "ok",
			},
		})
	})

	router.GET("/health/db", func(c *gin.Context) {
		pingCtx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
		defer cancel()

		collegePool := db.GetCollegePool()
		platformPool := db.GetPlatformPool()

		collegeOK := collegePool != nil && collegePool.Ping(pingCtx) == nil
		platformOK := platformPool != nil && platformPool.Ping(pingCtx) == nil

		if !collegeOK || !platformOK {
			c.JSON(503, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "DATABASE_UNAVAILABLE",
					"message": "One or more database pools are unavailable",
				},
				"data": gin.H{
					"college_pool":  collegeOK,
					"platform_pool": platformOK,
				},
			})
			return
		}

		c.JSON(200, gin.H{
			"success": true,
			"data": gin.H{
				"status":        "ok",
				"database":      "connected",
				"college_pool":  "connected",
				"platform_pool": "connected",
			},
		})
	})

	repository := repository.New(db)

	authService := auth.NewService(
		repository,
		jwtService,
		logger,
	)

	authHandler := auth.NewHandler(authService)

	authRoutes := router.Group("/auth")
	{
		authRoutes.POST("/login", authHandler.Login)
	}

	geoPool := db.GetPlatformPool()
	if geoPool == nil {
		geoPool = db.GetCollegePool()
	}
	geoRepo := geo.NewRepository(geoPool)
	geoService := geo.NewService(geoRepo)
	geoHandler := geo.NewHandler(geoService)
	geo.RegisterRoutes(router.Group(""), geoHandler)


	authMiddleware := auth.NewMiddleware(jwtService)

	tenantStatusMiddleware := middleware.NewTenantStatusMiddleware(db.GetCollegePool())

	moduleEntitlementMiddleware :=
		middleware.NewModuleEntitlementMiddleware(db.GetCollegePool())

	applicationAccessMiddleware :=
		middleware.NewApplicationAccessMiddleware(db.GetCollegePool())

	permissionService := service.NewPermissionService(repository)
	permissionMiddleware :=
		middleware.NewPermissionMiddleware(permissionService)

	studentService := service.NewStudentService(repository)
	studentHandler := NewStudentHandler(studentService)

	emergencyContactService := service.NewEmergencyContactService(
		db,
		repository,
	)
	emergencyContactHandler := NewEmergencyContactHandler(emergencyContactService)

	staffService := service.NewStaffService(repository)
	staffHandler := NewPeopleStaffHandler(staffService)

	inchargeHostelService := service.NewInchargeHostelService(db, repository)
	inchargeHostelHandler := NewPeopleInchargeHostelHandler(
		inchargeHostelService,
	)

	securityAssignmentService := service.NewSecurityAssignmentService(
		repository,
	)
	securityAssignmentHandler := NewPeopleSecurityAssignmentHandler(
		securityAssignmentService,
	)

	studentParentService := service.NewStudentParentService(repository)
	studentParentHandler := NewStudentParentHandler(studentParentService)

	parentService := service.NewParentService(repository)
	parentHandler := NewParentHandler(parentService)

	hostelService := service.NewHostelService(repository)
	hostelHandler := NewHostelHandler(hostelService)

	blockService := service.NewBlockService(repository)
	blockHandler := NewBlockHandler(blockService)

	floorService := service.NewFloorService(repository)
	floorHandler := NewFloorHandler(floorService)

	roomService := service.NewRoomService(repository)
	roomHandler := NewRoomHandler(roomService)

	bedService := service.NewBedService(repository)
	bedHandler := NewBedHandler(bedService)

	bedAllocationService := service.NewBedAllocationService(db, repository)
	bedAllocationHandler := NewBedAllocationHandler(bedAllocationService)

	gateService := service.NewGateService(repository)
	gateHandler := NewGateHandler(gateService)

	attendanceService := service.NewAttendanceService(db, repository)
	attendanceHandler := NewAttendanceHandler(attendanceService)

	leaveService := service.NewLeaveService(db, repository)
	leaveHandler := NewLeaveHandler(leaveService)

	messService := service.NewMessService(db, repository)
	messHandler := NewMessHandler(messService)

	complaintService := service.NewComplaintService(db, repository)
	complaintHandler := NewComplaintHandler(complaintService)

	maintenanceService := service.NewMaintenanceService(db, repository)
	maintenanceHandler := NewMaintenanceHandler(maintenanceService)

	notificationService := service.NewNotificationService(db, repository)
	notificationHandler := NewNotificationHandler(notificationService)

	reportService := service.NewReportService(repository)
	reportHandler := NewReportHandler(reportService)

	bootstrapService := service.NewBootstrapService(db.GetPlatformPool())

	// Platform-protected routes.
	//
	// These routes use JWT authentication and platform-scope
	// authorization. SUPER_ADMIN tokens intentionally have
	// no tenant_id.
	platformProtected := router.Group("/")
	platformProtected.Use(
		authMiddleware.RequireAuth(),
		auth.RequirePlatformScope(),
	)
	{
		platformProtected.GET("/auth/me", func(c *gin.Context) {
			claimsValue, exists := c.Get(auth.ContextClaimsKey)
			if !exists {
				c.JSON(500, gin.H{
					"success": false,
					"error": gin.H{
						"code":    "INTERNAL_ERROR",
						"message": "authentication claims not found",
					},
				})
				return
			}

			claims, ok := claimsValue.(*auth.Claims)
			if !ok {
				c.JSON(500, gin.H{
					"success": false,
					"error": gin.H{
						"code":    "INTERNAL_ERROR",
						"message": "invalid authentication claims",
					},
				})
				return
			}

			var tenantID interface{}

			if claims.TenantID != nil {
				tenantID = claims.TenantID.String()
			}

			c.JSON(200, gin.H{
				"success": true,
				"data": gin.H{
					"user_id":   claims.Subject,
					"role":      claims.Role,
					"scope":     claims.Scope,
					"tenant_id": tenantID,
				},
			})
		})

		platformProtected.GET(
			"/me",
			PlatformMeHandler(),
		)

		platformProtected.GET(
			"/reports/overview",
			permissionMiddleware.RequirePermission("platform.view"),
			reportHandler.GetPlatformOverview,
		)

		platformProtected.GET(
			"/reports/activity",
			permissionMiddleware.RequirePermission("platform.view"),
			reportHandler.GetPlatformActivity,
		)

		// Canonical Super Admin module routes.
		// All business operations (colleges, approvals, modules, settings)
		// execute via the dedicated platform module and PlatformPool.
		superadminroutes.RegisterSuperAdminRoutes(
			platformProtected,
			db,
			permissionMiddleware.RequirePermission("platform.view"),
			permissionMiddleware.RequirePermission("platform.manage"),
		)
	}

	// College-protected routes.
	//
	// These routes require:
	// 1. Valid JWT authentication.
	// 2. COLLEGE scope.
	// 3. Valid tenant context derived from the JWT.
	collegeProtected := router.Group("/college")
	collegeProtected.Use(
		authMiddleware.RequireAuth(),
		auth.RequireCollegeScope(),
		middleware.TenantContextMiddleware(),
		tenantStatusMiddleware.RequireActiveTenant(),
		applicationAccessMiddleware.RequireActiveApplication(),
		middleware.TenantTransactionMiddleware(db.GetCollegePool()),
	)
	{
		collegeProtected.GET("/context", func(c *gin.Context) {
			tenantID, exists := c.Get(middleware.TenantIDContextKey)
			if !exists {
				c.JSON(500, gin.H{
					"success": false,
					"error": gin.H{
						"code":    "INTERNAL_ERROR",
						"message": "tenant context not found",
					},
				})
				return
			}

			c.JSON(200, gin.H{
				"success": true,
				"data": gin.H{
					"tenant_id": tenantID,
				},
			})
		})

		collegeProtected.GET("/bootstrap", func(c *gin.Context) {
			tenantValue, exists := c.Get(middleware.TenantIDContextKey)
			if !exists || tenantValue == nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"error": gin.H{
						"code":    "INTERNAL_ERROR",
						"message": "tenant context not found",
					},
				})
				return
			}

			var tenantID uuid.UUID
			switch v := tenantValue.(type) {
			case uuid.UUID:
				tenantID = v
			case string:
				parsed, err := uuid.Parse(v)
				if err != nil {
					c.JSON(http.StatusBadRequest, gin.H{
						"success": false,
						"error": gin.H{
							"code":    "INVALID_TENANT_ID",
							"message": "invalid tenant id in context",
						},
					})
					return
				}
				tenantID = parsed
			default:
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"error": gin.H{
						"code":    "INTERNAL_ERROR",
						"message": "unexpected tenant context type",
					},
				})
				return
			}

			cfg, err := bootstrapService.GetCollegeBootstrapConfig(c.Request.Context(), tenantID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"error": gin.H{
						"code":    "BOOTSTRAP_FAILED",
						"message": "failed to retrieve college bootstrap configuration",
					},
				})
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"data":    cfg,
			})
		})

		collegeProtected.GET(
			"/hostel-test",
			moduleEntitlementMiddleware.RequireModule("HOSTEL"),
			permissionMiddleware.RequirePermission("hostel.view"),
			func(c *gin.Context) {
				c.JSON(200, gin.H{
					"success": true,
					"data": gin.H{
						"module":     "HOSTEL",
						"permission": "hostel.view",
						"status":     "authorized",
					},
				})
			},
		)

		collegeProtected.GET(
			"/permission-test",
			permissionMiddleware.RequirePermission("hostel.view"),
			func(c *gin.Context) {
				c.JSON(200, gin.H{
					"success": true,
					"data": gin.H{
						"permission": "hostel.view",
						"status":     "authorized",
					},
				})
			},
		)

		collegeProtected.GET(
			"/rls-test",
			RLSContextTestHandler(db),
		)

		collegeProtected.GET(
			"/students",
			permissionMiddleware.RequirePermission("people.view"),
			studentHandler.ListStudents,
		)

		collegeProtected.POST(
			"/students",
			permissionMiddleware.RequirePermission("people.manage"),
			studentHandler.CreateStudent,
		)

		collegeProtected.GET(
			"/students/:student_id",
			permissionMiddleware.RequirePermission("people.view"),
			studentHandler.GetStudent,
		)

		collegeProtected.PUT(
			"/students/:student_id",
			permissionMiddleware.RequirePermission("people.manage"),
			studentHandler.UpdateStudent,
		)

		collegeProtected.PATCH(
			"/students/:student_id/status",
			permissionMiddleware.RequirePermission("people.manage"),
			studentHandler.UpdateStudentStatus,
		)

		collegeProtected.GET(
			"/parents",
			permissionMiddleware.RequirePermission("people.view"),
			parentHandler.ListParents,
		)

		collegeProtected.POST(
			"/parents",
			permissionMiddleware.RequirePermission("people.manage"),
			parentHandler.CreateParent,
		)

		collegeProtected.GET(
			"/parents/:parent_id",
			permissionMiddleware.RequirePermission("people.view"),
			parentHandler.GetParent,
		)

		collegeProtected.PUT(
			"/parents/:parent_id",
			permissionMiddleware.RequirePermission("people.manage"),
			parentHandler.UpdateParent,
		)

		collegeProtected.GET(
			"/students/:student_id/parents",
			permissionMiddleware.RequirePermission("people.view"),
			studentParentHandler.ListStudentParents,
		)

		collegeProtected.POST(
			"/students/:student_id/parents",
			permissionMiddleware.RequirePermission("people.manage"),
			studentParentHandler.CreateStudentParent,
		)

		collegeProtected.GET(
			"/students/:student_id/parents/:relationship_id",
			permissionMiddleware.RequirePermission("people.view"),
			studentParentHandler.GetStudentParent,
		)

		collegeProtected.PUT(
			"/students/:student_id/parents/:relationship_id",
			permissionMiddleware.RequirePermission("people.manage"),
			studentParentHandler.UpdateStudentParent,
		)

		collegeProtected.DELETE(
			"/students/:student_id/parents/:relationship_id",
			permissionMiddleware.RequirePermission("people.manage"),
			studentParentHandler.DeleteStudentParent,
		)

		collegeProtected.GET(
			"/students/:student_id/emergency-contacts",
			permissionMiddleware.RequirePermission("people.view"),
			emergencyContactHandler.ListEmergencyContacts,
		)

		collegeProtected.POST(
			"/students/:student_id/emergency-contacts",
			permissionMiddleware.RequirePermission("people.manage"),
			emergencyContactHandler.CreateEmergencyContact,
		)

		collegeProtected.GET(
			"/students/:student_id/emergency-contacts/:contact_id",
			permissionMiddleware.RequirePermission("people.view"),
			emergencyContactHandler.GetEmergencyContact,
		)

		collegeProtected.PUT(
			"/students/:student_id/emergency-contacts/:contact_id",
			permissionMiddleware.RequirePermission("people.manage"),
			emergencyContactHandler.UpdateEmergencyContact,
		)

		collegeProtected.DELETE(
			"/students/:student_id/emergency-contacts/:contact_id",
			permissionMiddleware.RequirePermission("people.manage"),
			emergencyContactHandler.DeleteEmergencyContact,
		)

		collegeProtected.GET(
			"/staff",
			permissionMiddleware.RequirePermission("people.view"),
			staffHandler.List,
		)

		collegeProtected.POST(
			"/staff",
			permissionMiddleware.RequirePermission("people.manage"),
			staffHandler.Create,
		)

		collegeProtected.GET(
			"/staff/:staff_id",
			permissionMiddleware.RequirePermission("people.view"),
			staffHandler.Get,
		)

		collegeProtected.PUT(
			"/staff/:staff_id",
			permissionMiddleware.RequirePermission("people.manage"),
			staffHandler.Update,
		)

		collegeProtected.PATCH(
			"/staff/:staff_id/status",
			permissionMiddleware.RequirePermission("people.manage"),
			staffHandler.UpdateStatus,
		)

		collegeProtected.GET(
			"/hostels",
			permissionMiddleware.RequirePermission("people.view"),
			hostelHandler.List,
		)

		collegeProtected.POST(
			"/hostels",
			permissionMiddleware.RequirePermission("people.manage"),
			hostelHandler.Create,
		)

		collegeProtected.GET(
			"/hostels/:hostel_id",
			permissionMiddleware.RequirePermission("people.view"),
			hostelHandler.Get,
		)

		collegeProtected.PUT(
			"/hostels/:hostel_id",
			permissionMiddleware.RequirePermission("people.manage"),
			hostelHandler.Update,
		)

		collegeProtected.PATCH(
			"/hostels/:hostel_id/status",
			permissionMiddleware.RequirePermission("people.manage"),
			hostelHandler.UpdateStatus,
		)

		collegeProtected.GET(
			"/hostels/:hostel_id/blocks",
			permissionMiddleware.RequirePermission("people.view"),
			blockHandler.List,
		)

		collegeProtected.POST(
			"/hostels/:hostel_id/blocks",
			permissionMiddleware.RequirePermission("people.manage"),
			blockHandler.Create,
		)

		collegeProtected.GET(
			"/hostels/:hostel_id/blocks/:block_id",
			permissionMiddleware.RequirePermission("people.view"),
			blockHandler.Get,
		)

		collegeProtected.PUT(
			"/hostels/:hostel_id/blocks/:block_id",
			permissionMiddleware.RequirePermission("people.manage"),
			blockHandler.Update,
		)

		collegeProtected.PATCH(
			"/hostels/:hostel_id/blocks/:block_id/status",
			permissionMiddleware.RequirePermission("people.manage"),
			blockHandler.UpdateStatus,
		)

		collegeProtected.GET(
			"/hostels/:hostel_id/blocks/:block_id/floors",
			permissionMiddleware.RequirePermission("people.view"),
			floorHandler.List,
		)

		collegeProtected.POST(
			"/hostels/:hostel_id/blocks/:block_id/floors",
			permissionMiddleware.RequirePermission("people.manage"),
			floorHandler.Create,
		)

		collegeProtected.GET(
			"/hostels/:hostel_id/blocks/:block_id/floors/:floor_id",
			permissionMiddleware.RequirePermission("people.view"),
			floorHandler.Get,
		)

		collegeProtected.PUT(
			"/hostels/:hostel_id/blocks/:block_id/floors/:floor_id",
			permissionMiddleware.RequirePermission("people.manage"),
			floorHandler.Update,
		)

		collegeProtected.PATCH(
			"/hostels/:hostel_id/blocks/:block_id/floors/:floor_id/status",
			permissionMiddleware.RequirePermission("people.manage"),
			floorHandler.UpdateStatus,
		)

		collegeProtected.GET(
			"/hostels/:hostel_id/blocks/:block_id/floors/:floor_id/rooms",
			permissionMiddleware.RequirePermission("people.view"),
			roomHandler.List,
		)

		collegeProtected.POST(
			"/hostels/:hostel_id/blocks/:block_id/floors/:floor_id/rooms",
			permissionMiddleware.RequirePermission("people.manage"),
			roomHandler.Create,
		)

		collegeProtected.GET(
			"/hostels/:hostel_id/blocks/:block_id/floors/:floor_id/rooms/:room_id",
			permissionMiddleware.RequirePermission("people.view"),
			roomHandler.Get,
		)

		collegeProtected.PUT(
			"/hostels/:hostel_id/blocks/:block_id/floors/:floor_id/rooms/:room_id",
			permissionMiddleware.RequirePermission("people.manage"),
			roomHandler.Update,
		)

		collegeProtected.PATCH(
			"/hostels/:hostel_id/blocks/:block_id/floors/:floor_id/rooms/:room_id/status",
			permissionMiddleware.RequirePermission("people.manage"),
			roomHandler.UpdateStatus,
		)

		collegeProtected.GET(
			"/hostels/:hostel_id/blocks/:block_id/floors/:floor_id/rooms/:room_id/beds",
			permissionMiddleware.RequirePermission("people.view"),
			bedHandler.List,
		)

		collegeProtected.POST(
			"/hostels/:hostel_id/blocks/:block_id/floors/:floor_id/rooms/:room_id/beds",
			permissionMiddleware.RequirePermission("people.manage"),
			bedHandler.Create,
		)

		collegeProtected.GET(
			"/hostels/:hostel_id/blocks/:block_id/floors/:floor_id/rooms/:room_id/beds/:bed_id",
			permissionMiddleware.RequirePermission("people.view"),
			bedHandler.Get,
		)

		collegeProtected.PUT(
			"/hostels/:hostel_id/blocks/:block_id/floors/:floor_id/rooms/:room_id/beds/:bed_id",
			permissionMiddleware.RequirePermission("people.manage"),
			bedHandler.Update,
		)

		collegeProtected.PATCH(
			"/hostels/:hostel_id/blocks/:block_id/floors/:floor_id/rooms/:room_id/beds/:bed_id/status",
			permissionMiddleware.RequirePermission("people.manage"),
			bedHandler.UpdateStatus,
		)

		collegeProtected.GET(
			"/bed-allocations",
			permissionMiddleware.RequirePermission("people.view"),
			bedAllocationHandler.List,
		)

		collegeProtected.POST(
			"/bed-allocations",
			permissionMiddleware.RequirePermission("people.manage"),
			bedAllocationHandler.Create,
		)

		collegeProtected.GET(
			"/bed-allocations/current",
			permissionMiddleware.RequirePermission("people.view"),
			bedAllocationHandler.GetCurrent,
		)

		collegeProtected.GET(
			"/bed-allocations/:allocation_id",
			permissionMiddleware.RequirePermission("people.view"),
			bedAllocationHandler.Get,
		)

		collegeProtected.PUT(
			"/bed-allocations/:allocation_id",
			permissionMiddleware.RequirePermission("people.manage"),
			bedAllocationHandler.Update,
		)

		collegeProtected.PATCH(
			"/bed-allocations/:allocation_id/release",
			permissionMiddleware.RequirePermission("people.manage"),
			bedAllocationHandler.Release,
		)

		collegeProtected.PATCH(
			"/bed-allocations/:allocation_id/transfer",
			permissionMiddleware.RequirePermission("people.manage"),
			bedAllocationHandler.Transfer,
		)

		collegeProtected.GET(
			"/gates",
			permissionMiddleware.RequirePermission("people.view"),
			gateHandler.List,
		)

		collegeProtected.POST(
			"/gates",
			permissionMiddleware.RequirePermission("people.manage"),
			gateHandler.Create,
		)

		collegeProtected.GET(
			"/gates/:gate_id",
			permissionMiddleware.RequirePermission("people.view"),
			gateHandler.Get,
		)

		collegeProtected.PUT(
			"/gates/:gate_id",
			permissionMiddleware.RequirePermission("people.manage"),
			gateHandler.Update,
		)

		collegeProtected.PATCH(
			"/gates/:gate_id/status",
			permissionMiddleware.RequirePermission("people.manage"),
			gateHandler.UpdateStatus,
		)

		collegeProtected.GET(
			"/hostels/:hostel_id/incharges",
			permissionMiddleware.RequirePermission("people.view"),
			inchargeHostelHandler.List,
		)

		collegeProtected.POST(
			"/hostels/:hostel_id/incharges",
			permissionMiddleware.RequirePermission("people.manage"),
			inchargeHostelHandler.Create,
		)

		collegeProtected.GET(
			"/hostels/:hostel_id/incharges/:assignment_id",
			permissionMiddleware.RequirePermission("people.view"),
			inchargeHostelHandler.Get,
		)

		collegeProtected.PUT(
			"/hostels/:hostel_id/incharges/:assignment_id",
			permissionMiddleware.RequirePermission("people.manage"),
			inchargeHostelHandler.Update,
		)

		collegeProtected.DELETE(
			"/hostels/:hostel_id/incharges/:assignment_id",
			permissionMiddleware.RequirePermission("people.manage"),
			inchargeHostelHandler.Delete,
		)

		collegeProtected.GET(
			"/security-assignments",
			permissionMiddleware.RequirePermission("people.view"),
			securityAssignmentHandler.List,
		)

		collegeProtected.POST(
			"/security-assignments",
			permissionMiddleware.RequirePermission("people.manage"),
			securityAssignmentHandler.Create,
		)

		collegeProtected.GET(
			"/security-assignments/:assignment_id",
			permissionMiddleware.RequirePermission("people.view"),
			securityAssignmentHandler.Get,
		)

		collegeProtected.PUT(
			"/security-assignments/:assignment_id",
			permissionMiddleware.RequirePermission("people.manage"),
			securityAssignmentHandler.Update,
		)

		collegeProtected.DELETE(
			"/security-assignments/:assignment_id",
			permissionMiddleware.RequirePermission("people.manage"),
			securityAssignmentHandler.Delete,
		)

		collegeProtected.POST(
			"/attendance/students",
			permissionMiddleware.RequirePermission("people.manage"),
			attendanceHandler.MarkStudentAttendance,
		)

		collegeProtected.POST(
			"/attendance/students/bulk",
			permissionMiddleware.RequirePermission("people.manage"),
			attendanceHandler.BulkMarkStudentAttendance,
		)

		collegeProtected.GET(
			"/attendance/students",
			permissionMiddleware.RequirePermission("people.view"),
			attendanceHandler.ListStudentAttendance,
		)

		collegeProtected.GET(
			"/attendance/students/:record_id",
			permissionMiddleware.RequirePermission("people.view"),
			attendanceHandler.GetStudentAttendance,
		)

		collegeProtected.GET(
			"/attendance/reports/summary",
			permissionMiddleware.RequirePermission("people.view"),
			attendanceHandler.GetAttendanceSummary,
		)

		collegeProtected.POST(
			"/attendance/corrections",
			permissionMiddleware.RequirePermission("people.manage"),
			attendanceHandler.SubmitAttendanceCorrection,
		)

		collegeProtected.PATCH(
			"/attendance/corrections/:correction_id/decision",
			permissionMiddleware.RequirePermission("people.manage"),
			attendanceHandler.ApproveAttendanceCorrection,
		)

		collegeProtected.POST(
			"/leaves",
			permissionMiddleware.RequirePermission("requests.manage"),
			leaveHandler.CreateLeaveRequest,
		)

		collegeProtected.GET(
			"/leaves",
			permissionMiddleware.RequirePermission("requests.view"),
			leaveHandler.ListLeaveRequests,
		)

		collegeProtected.GET(
			"/leaves/reports/summary",
			permissionMiddleware.RequirePermission("requests.view"),
			leaveHandler.GetLeaveSummary,
		)

		collegeProtected.GET(
			"/leaves/:leave_id",
			permissionMiddleware.RequirePermission("requests.view"),
			leaveHandler.GetLeaveRequest,
		)

		collegeProtected.POST(
			"/leaves/:leave_id/decision",
			permissionMiddleware.RequirePermission("requests.manage"),
			leaveHandler.ProcessDecision,
		)

		collegeProtected.POST(
			"/leaves/:leave_id/cancel",
			permissionMiddleware.RequirePermission("requests.manage"),
			leaveHandler.CancelLeaveRequest,
		)

		// Mess Operations
		collegeProtected.POST(
			"/hostels/:hostel_id/mess/timings",
			permissionMiddleware.RequirePermission("hostel.manage"),
			messHandler.CreateMealTiming,
		)

		collegeProtected.GET(
			"/hostels/:hostel_id/mess/timings",
			permissionMiddleware.RequirePermission("hostel.view"),
			messHandler.ListMealTimings,
		)

		collegeProtected.POST(
			"/hostels/:hostel_id/mess/menus",
			permissionMiddleware.RequirePermission("hostel.manage"),
			messHandler.CreateMealMenu,
		)

		collegeProtected.GET(
			"/hostels/:hostel_id/mess/menus",
			permissionMiddleware.RequirePermission("hostel.view"),
			messHandler.ListMealMenus,
		)

		collegeProtected.POST(
			"/mess/feedback",
			permissionMiddleware.RequirePermission("hostel.view"),
			messHandler.CreateFoodFeedback,
		)

		collegeProtected.GET(
			"/mess/today",
			permissionMiddleware.RequirePermission("hostel.view"),
			messHandler.GetTodayMenus,
		)

		// Complaints Operations
		collegeProtected.POST(
			"/complaints",
			permissionMiddleware.RequirePermission("requests.manage"), // or hostel.manage, sticking to existing
			complaintHandler.CreateComplaint,
		)
		collegeProtected.GET(
			"/complaints",
			permissionMiddleware.RequirePermission("requests.view"),
			complaintHandler.ListComplaints,
		)
		collegeProtected.GET(
			"/complaints/reports/summary",
			permissionMiddleware.RequirePermission("requests.view"),
			complaintHandler.GetComplaintSummary,
		)
		collegeProtected.GET(
			"/complaints/:complaint_id",
			permissionMiddleware.RequirePermission("requests.view"),
			complaintHandler.GetComplaint,
		)
		collegeProtected.PATCH(
			"/complaints/:complaint_id/status",
			permissionMiddleware.RequirePermission("requests.manage"),
			complaintHandler.UpdateComplaintStatus,
		)
		collegeProtected.PATCH(
			"/complaints/:complaint_id/assign",
			permissionMiddleware.RequirePermission("requests.manage"),
			complaintHandler.AssignComplaint,
		)
		collegeProtected.PATCH(
			"/complaints/:complaint_id/resolve",
			permissionMiddleware.RequirePermission("requests.manage"),
			complaintHandler.ResolveComplaint,
		)
		collegeProtected.GET(
			"/complaints/:complaint_id/updates",
			permissionMiddleware.RequirePermission("requests.view"),
			complaintHandler.ListComplaintUpdates,
		)

		// Maintenance Operations
		collegeProtected.POST(
			"/maintenance",
			permissionMiddleware.RequirePermission("hostel.manage"),
			maintenanceHandler.CreateMaintenance,
		)
		collegeProtected.GET(
			"/maintenance",
			permissionMiddleware.RequirePermission("hostel.view"),
			maintenanceHandler.ListMaintenance,
		)
		collegeProtected.GET(
			"/maintenance/:maintenance_id",
			permissionMiddleware.RequirePermission("hostel.view"),
			maintenanceHandler.GetMaintenance,
		)
		collegeProtected.PATCH(
			"/maintenance/:maintenance_id/resolve",
			permissionMiddleware.RequirePermission("hostel.manage"),
			maintenanceHandler.ResolveMaintenance,
		)

		// Notification Operations
		collegeProtected.POST(
			"/notifications",
			permissionMiddleware.RequirePermission("hostel.manage"), // Only managers can send broadcasts
			notificationHandler.CreateNotification,
		)
		collegeProtected.GET(
			"/notifications",
			// No explicit permission needed; users can see their own notifications.
			notificationHandler.ListNotifications,
		)
		collegeProtected.GET(
			"/notifications/unread-count",
			notificationHandler.GetUnreadCount,
		)
		collegeProtected.GET(
			"/notifications/:notification_id",
			notificationHandler.GetNotification,
		)
		collegeProtected.PATCH(
			"/notifications/read-all",
			notificationHandler.MarkAllAsRead,
		)
		collegeProtected.PATCH(
			"/notifications/:notification_id/read",
			notificationHandler.MarkAsRead,
		)

		// Reports Operations
		collegeProtected.GET(
			"/reports/overview",
			permissionMiddleware.RequirePermission("reports.view"),
			reportHandler.GetOverview,
		)
		collegeProtected.GET(
			"/reports/students",
			permissionMiddleware.RequirePermission("reports.view"),
			reportHandler.GetStudents,
		)
		collegeProtected.GET(
			"/reports/occupancy",
			permissionMiddleware.RequirePermission("reports.view"),
			reportHandler.GetOccupancy,
		)
		collegeProtected.GET(
			"/reports/allocations",
			permissionMiddleware.RequirePermission("reports.view"),
			reportHandler.GetAllocations,
		)
		collegeProtected.GET(
			"/reports/attendance",
			permissionMiddleware.RequirePermission("reports.view"),
			reportHandler.GetAttendance,
		)
		collegeProtected.GET(
			"/reports/leave",
			permissionMiddleware.RequirePermission("reports.view"),
			reportHandler.GetLeave,
		)
		collegeProtected.GET(
			"/reports/complaints",
			permissionMiddleware.RequirePermission("reports.view"),
			reportHandler.GetComplaints,
		)
		collegeProtected.GET(
			"/reports/maintenance",
			permissionMiddleware.RequirePermission("reports.view"),
			reportHandler.GetMaintenance,
		)
		collegeProtected.GET(
			"/reports/staff",
			permissionMiddleware.RequirePermission("reports.view"),
			reportHandler.GetStaff,
		)
	}

	return router
}
