package routes

import (
	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/handlers"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
)

// RegisterSuperAdminRoutes registers all Super Admin module routes.
// This function should be called from the main API router to integrate
// the Super Admin backend with the existing API.
func RegisterSuperAdminRoutes(
	router *gin.RouterGroup,
	db *database.Database,
	requireView gin.HandlerFunc,
	requireManage gin.HandlerFunc,
) {
	// Initialize repository
	repo := repository.New(db)

	// Initialize services
	collegeService := services.NewCollegeService(db, repo)
	approvalService := services.NewApprovalService(db, repo)
	moduleService := services.NewModuleService(db, repo)
	settingsService := services.NewSettingsService(db, repo)
	templateService := services.NewTemplateService(db, repo)
	applicationService := services.NewApplicationService(db, repo)
	dashboardService := services.NewDashboardService(db, repo)
	hostelStructureService := services.NewHostelStructureService(db, repo)
	staffService := services.NewStaffService(db, repo)
	roleService := services.NewRoleService(db, repo)
	permissionService := services.NewPermissionService(db, repo)
	accessControlService := services.NewAccessControlService(db, repo)
	systemSettingsService := services.NewSystemSettingsService(db, repo)
	auditService := services.NewAuditService(db, repo)
	changeManagementService := services.NewChangeManagementService(db, repo, approvalService)

	// Initialize handlers
	collegeHandler := handlers.NewCollegeHandler(collegeService)
	approvalHandler := handlers.NewApprovalHandler(approvalService)
	moduleHandler := handlers.NewModuleHandler(moduleService)
	settingsHandler := handlers.NewSettingsHandler(settingsService)
	templateHandler := handlers.NewTemplateHandler(templateService)
	applicationHandler := handlers.NewApplicationHandler(applicationService)
	dashboardHandler := handlers.NewDashboardHandler(dashboardService)
	hostelStructureHandler := handlers.NewHostelStructureHandler(hostelStructureService)
	staffHandler := handlers.NewStaffHandler(staffService)
	roleHandler := handlers.NewRoleHandler(roleService)
	permissionHandler := handlers.NewPermissionHandler(permissionService, roleService)
	accessControlHandler := handlers.NewAccessControlHandler(accessControlService)
	systemSettingsHandler := handlers.NewSystemSettingsHandler(systemSettingsService)
	auditHandler := handlers.NewAuditHandler(auditService)
	changeManagementHandler := handlers.NewChangeManagementHandler(changeManagementService)

	// Super Admin API routes group
	// Note: Auth and permission middleware should be applied at the router level
	// before calling this function
	superAdmin := router.Group("/super-admin")
	{
		// Dashboard Routes
		dashboard := superAdmin.Group("/dashboard")
		{
			dashboard.GET("", requireView, dashboardHandler.GetDashboard)
			dashboard.GET("/summary", requireView, dashboardHandler.GetDashboard)
		}

		// College Onboarding Pipeline Routes
		onboarding := superAdmin.Group("/onboarding")
		{
			onboarding.GET("", requireView, collegeHandler.ListOnboardingPipeline)
			onboarding.GET("/pipeline", requireView, collegeHandler.ListOnboardingPipeline)
		}

		// College Management Routes
		colleges := superAdmin.Group("/colleges")
		{
			colleges.GET("", requireView, collegeHandler.ListColleges)
			colleges.POST("", requireManage, collegeHandler.CreateCollege)
			colleges.GET("/:id", requireView, collegeHandler.GetCollege)
			colleges.PUT("/:id", requireManage, collegeHandler.UpdateCollege)
			colleges.PATCH("/:id", requireManage, collegeHandler.UpdateCollege)
			colleges.PUT("/:id/status", requireManage, collegeHandler.UpdateCollegeStatus)
			colleges.PATCH("/:id/status", requireManage, collegeHandler.UpdateCollegeStatus)

			// College administrator credentials management
			colleges.GET("/:id/admin", requireView, collegeHandler.GetCollegeAdmin)
			colleges.PUT("/:id/admin/password", requireManage, collegeHandler.UpdateCollegeAdminPassword)
			colleges.POST("/:id/admin/password", requireManage, collegeHandler.UpdateCollegeAdminPassword)

			// College administrator account management
			admins := colleges.Group("/:id/admins")
			{
				admins.GET("", requireView, collegeHandler.ListCollegeAdmins)
				admins.POST("/first", requireManage, collegeHandler.ProvisionFirstCollegeAdmin)
				admins.PATCH("/:admin_id", requireManage, collegeHandler.UpdateCollegeAdminProfile)
				admins.PUT("/:admin_id/status", requireManage, collegeHandler.UpdateCollegeAdminStatus)
				admins.POST("/:admin_id/unlock", requireManage, collegeHandler.UnlockCollegeAdminAccount)
				admins.POST("/:admin_id/revoke-sessions", requireManage, collegeHandler.RevokeCollegeAdminSessions)
				admins.GET("/:admin_id/login-history", requireView, collegeHandler.GetCollegeAdminLoginHistory)
			}

			// College onboarding checklist & readiness
			colleges.GET("/:id/onboarding", requireView, collegeHandler.GetCollegeOnboarding)
			colleges.PATCH("/:id/onboarding/:step_code", requireManage, collegeHandler.UpdateCollegeOnboarding)
			colleges.PUT("/:id/onboarding/:step_code", requireManage, collegeHandler.UpdateCollegeOnboarding)
			colleges.GET("/:id/readiness", requireView, collegeHandler.GetCollegeReadiness)
			colleges.POST("/:id/test-notification", requireManage, collegeHandler.TestCollegeNotification)

			// College-specific module management
			colleges.GET("/:id/modules", requireView, moduleHandler.ListCollegeModules)
			colleges.POST("/:id/modules", requireManage, moduleHandler.AssignCollegeModule)
			colleges.PUT("/:id/modules/:module_id", requireManage, moduleHandler.UpdateCollegeModule)
			colleges.PATCH("/:id/modules/:module_id", requireManage, moduleHandler.UpdateCollegeModule)
			colleges.PATCH("/modules/:module_id", requireManage, moduleHandler.UpdateCollegeModule) // legacy support
			colleges.POST("/:id/modules/:module_id/preview", requireView, moduleHandler.PreviewModuleImpact)
			colleges.POST("/:id/modules/:module_id/change", requireManage, moduleHandler.RequestModuleEntitlementChange)
			colleges.GET("/:id/modules/history", requireView, moduleHandler.ListModuleHistory)

			// College-specific entitlements
			colleges.GET("/:id/entitlements", requireView, moduleHandler.GetCollegeEntitlements)
			colleges.GET("/:id/entitlements/matrix", requireView, moduleHandler.GetCollegeEntitlementMatrix)
			colleges.PUT("/:id/entitlements", requireManage, moduleHandler.UpdateCollegeEntitlement)
			colleges.POST("/:id/apply-template", requireManage, templateHandler.ApplyTemplateToCollege)

			// College-specific feature / module access control (Module 12)
			colleges.GET("/:id/access-control/matrix", requireView, accessControlHandler.GetTenantAccessHierarchy)
			colleges.PUT("/:id/access-control/features/:module_id", requireManage, accessControlHandler.UpdateCollegeFeature)
			colleges.POST("/:id/access-control/evaluate", requireView, accessControlHandler.EvaluateWhyDenied)

			// College-specific settings
			colleges.GET("/:id/settings", requireView, settingsHandler.ListCollegeSettings)
			colleges.GET("/:id/settings/definitions", requireView, settingsHandler.ListSettingDefinitions)
			colleges.GET("/:id/settings/compare", requireView, settingsHandler.CompareCollegeSettings)
			colleges.GET("/:id/settings/history", requireView, settingsHandler.ListCollegeSettingsHistory)
			colleges.GET("/:id/settings/:key", requireView, settingsHandler.GetCollegeSetting)
			colleges.PUT("/:id/settings/:key", requireManage, settingsHandler.UpdateCollegeSetting)
			colleges.POST("/:id/settings/:key/reset", requireManage, settingsHandler.ResetCollegeSetting)
			colleges.POST("/:id/settings/:key/revert", requireManage, settingsHandler.RevertCollegeSetting)

			// College-specific applications management
			colleges.GET("/:id/applications", requireView, applicationHandler.ListCollegeApplications)
			colleges.GET("/:id/applications/:app_id", requireView, applicationHandler.GetCollegeApplication)
			colleges.POST("/:id/applications/:app_id/enable", requireManage, applicationHandler.EnableApplication)
			colleges.POST("/:id/applications/:app_id/disable", requireManage, applicationHandler.DisableApplication)
			colleges.POST("/:id/applications/:app_id/suspend", requireManage, applicationHandler.SuspendApplication)
			colleges.PUT("/:id/applications/:app_id/version", requireManage, applicationHandler.UpdateVersion)
			colleges.GET("/:id/applications/:app_id/history", requireView, applicationHandler.GetApplicationHistory)
			
			// College-specific hostel structure management
			hs := colleges.Group("/:id/hostel-structure")
			{
				hs.GET("/overview", requireView, hostelStructureHandler.GetOverview)
				hs.GET("/tree", requireView, hostelStructureHandler.GetHierarchy)
				hs.GET("/hostels", requireView, hostelStructureHandler.GetHierarchy)
				hs.POST("/hostels", requireManage, hostelStructureHandler.CreateHostel)
				hs.PUT("/hostels/:hostel_id", requireManage, hostelStructureHandler.UpdateHostel)
				hs.DELETE("/hostels/:hostel_id", requireManage, hostelStructureHandler.DeleteHostel)

				hs.POST("/blocks", requireManage, hostelStructureHandler.CreateBlock)
				hs.PUT("/blocks/:block_id", requireManage, hostelStructureHandler.UpdateBlock)
				hs.DELETE("/blocks/:block_id", requireManage, hostelStructureHandler.DeleteBlock)

				hs.POST("/floors", requireManage, hostelStructureHandler.CreateFloor)
				hs.PUT("/floors/:floor_id", requireManage, hostelStructureHandler.UpdateFloor)
				hs.DELETE("/floors/:floor_id", requireManage, hostelStructureHandler.DeleteFloor)

				hs.POST("/rooms", requireManage, hostelStructureHandler.CreateRoom)
				hs.PUT("/rooms/:room_id", requireManage, hostelStructureHandler.UpdateRoom)
				hs.DELETE("/rooms/:room_id", requireManage, hostelStructureHandler.DeleteRoom)

				hs.POST("/beds", requireManage, hostelStructureHandler.CreateBed)
				hs.PUT("/beds/:bed_id", requireManage, hostelStructureHandler.UpdateBed)
				hs.DELETE("/beds/:bed_id", requireManage, hostelStructureHandler.DeleteBed)

				hs.POST("/bulk/preview", requireView, hostelStructureHandler.PreviewBulk)
				hs.POST("/bulk/generate", requireManage, hostelStructureHandler.GenerateBulk)

				hs.GET("/csv/template", requireView, hostelStructureHandler.DownloadCSVTemplate)
				hs.POST("/csv/preview", requireView, hostelStructureHandler.PreviewCSV)
				hs.POST("/csv/import", requireManage, hostelStructureHandler.ImportCSV)

				hs.POST("/clone/preview", requireView, hostelStructureHandler.PreviewClone)
				hs.POST("/clone/apply", requireManage, hostelStructureHandler.ApplyClone)

				hs.GET("/policy", requireView, hostelStructureHandler.GetPolicy)
				hs.PUT("/policy", requireManage, hostelStructureHandler.UpdatePolicy)
				hs.POST("/lock", requireManage, hostelStructureHandler.ToggleLock)
				hs.GET("/audit", requireView, hostelStructureHandler.ListAudits)
			}
		}

		// Application Catalogue Routes
		applications := superAdmin.Group("/applications")
		{
			applications.GET("", requireView, applicationHandler.GetCatalogue)
			applications.GET("/catalogue", requireView, applicationHandler.GetCatalogue)
		}

		// Approval Workflow Routes
		approvals := superAdmin.Group("/approvals")
		{
			approvals.GET("", requireView, approvalHandler.ListApprovalRequests)
			approvals.POST("", requireManage, approvalHandler.CreateApprovalRequest)
			approvals.GET("/:id", requireView, approvalHandler.GetApprovalRequest)
			approvals.POST("/:id/execute", requireManage, approvalHandler.ExecuteApprovalRequest)
			approvals.POST("/:id/cancel", requireManage, approvalHandler.CancelApprovalRequest)
			approvals.POST("/steps/:step_id/decision", requireManage, approvalHandler.ProcessApprovalDecision)
		}

		// Module Catalogue Routes
		modules := superAdmin.Group("/modules")
		{
			modules.GET("", requireView, moduleHandler.ListModules)
			modules.POST("", requireManage, moduleHandler.CreateModule)
			modules.GET("/history", requireView, moduleHandler.ListModuleHistory)
			modules.GET("/:id", requireView, moduleHandler.GetModule)
			modules.PUT("/:id", requireManage, moduleHandler.UpdateModule)
			modules.PATCH("/:id", requireManage, moduleHandler.UpdateModule)
			modules.PATCH("/:id/status", requireManage, moduleHandler.ToggleModuleStatus)
			modules.DELETE("/:id", requireManage, moduleHandler.DeleteModule)
		}

		// Entitlement Templates Routes
		templates := superAdmin.Group("/entitlement-templates")
		{
			templates.GET("", requireView, templateHandler.ListTemplates)
			templates.POST("", requireManage, templateHandler.CreateTemplate)
			templates.GET("/:id", requireView, templateHandler.GetTemplate)
			templates.PUT("/:id", requireManage, templateHandler.UpdateTemplate)
			templates.PATCH("/:id", requireManage, templateHandler.UpdateTemplate)
			templates.DELETE("/:id", requireManage, templateHandler.DeleteTemplate)
			templates.POST("/:id/apply/:college_id", requireManage, templateHandler.ApplyTemplateToCollege)
		}

		// Company Staff / Super Admin Routes
		staff := superAdmin.Group("/staff")
		{
			staff.GET("", requireView, staffHandler.ListPlatformStaff)
			staff.GET("/:user_id", requireView, staffHandler.GetPlatformStaff)
			staff.PATCH("/:user_id", requireManage, staffHandler.UpdatePlatformStaffProfile)
			staff.PUT("/:user_id/status", requireManage, staffHandler.UpdatePlatformStaffStatus)
			staff.GET("/:user_id/pending-approvals", requireView, staffHandler.GetPlatformStaffPendingApprovals)
		}

		// Role Management Routes
		roles := superAdmin.Group("/roles")
		{
			roles.GET("", requireView, roleHandler.ListRoles)
			roles.GET("/permissions", requireView, roleHandler.ListPermissions)
			roles.GET("/templates", requireView, roleHandler.ListRoleTemplates)
			roles.GET("/:id", requireView, roleHandler.GetRole)
			roles.POST("", requireManage, roleHandler.CreateRole)
			roles.POST("/:id/clone", requireManage, roleHandler.CloneRole)
			roles.PUT("/:id", requireManage, roleHandler.UpdateRole)
			roles.PATCH("/:id", requireManage, roleHandler.UpdateRole)
			roles.PUT("/:id/permissions", requireManage, roleHandler.UpdateRolePermissions)
			roles.DELETE("/:id", requireManage, roleHandler.DeleteRole)
		}

		// Permission Management Routes (Module 11)
		permissions := superAdmin.Group("/permissions")
		{
			permissions.GET("", requireView, permissionHandler.ListPermissions)
			permissions.GET("/orphans", requireView, permissionHandler.ListOrphanPermissions)
			permissions.GET("/deprecation-status", requireView, permissionHandler.GetDeprecationStatus)
			permissions.GET("/:id", requireView, permissionHandler.GetPermission)
			permissions.GET("/:id/who-has-what", requireView, permissionHandler.GetPermissionWhoHasWhat)
		}

		// Feature / Module Access Control & Evaluation Routes (Module 12)
		accessControl := superAdmin.Group("/access-control")
		{
			accessControl.POST("/evaluate", requireView, accessControlHandler.GlobalEvaluateAccess)
		}

		// Company-Wide Platform System Configuration (Module 13)
		systemSettings := superAdmin.Group("/system-settings")
		{
			systemSettings.GET("", requireView, systemSettingsHandler.ListSettings)
			systemSettings.GET("/history", requireView, systemSettingsHandler.ListHistory)
			systemSettings.GET("/tenant-inheritance", requireView, systemSettingsHandler.GetTenantInheritanceOverview)
			systemSettings.GET("/maintenance", systemSettingsHandler.CheckMaintenanceStatus)
			systemSettings.GET("/:key", requireView, systemSettingsHandler.GetSetting)
			systemSettings.PUT("/:key", requireManage, systemSettingsHandler.UpdateSetting)
			systemSettings.POST("/:key/reset", requireManage, systemSettingsHandler.ResetSetting)
			systemSettings.POST("/:key/revert", requireManage, systemSettingsHandler.RevertSetting)
		}

		// Platform Audit Log & Activity Log (Module 14)
		auditLogs := superAdmin.Group("/audit-logs")
		{
			auditLogs.GET("", requireView, auditHandler.ListAuditLogs)
			auditLogs.POST("/verify-integrity", requireView, auditHandler.VerifyIntegrity)
			auditLogs.GET("/exports", requireView, auditHandler.ListExportRequests)
			auditLogs.POST("/exports", requireManage, auditHandler.RequestExport)
			auditLogs.POST("/exports/:id/decision", requireManage, auditHandler.ProcessExportDecision)
			auditLogs.GET("/:id", requireView, auditHandler.GetAuditLog)
		}

		// Configuration Change Management (Module 15)
		changeSets := superAdmin.Group("/change-sets")
		{
			changeSets.GET("", requireView, changeManagementHandler.ListChangeSets)
			changeSets.POST("", requireManage, changeManagementHandler.ProposeChangeSet)
			changeSets.POST("/rollback", requireManage, changeManagementHandler.ProposeRollback)
			changeSets.GET("/:id", requireView, changeManagementHandler.GetChangeSet)
			changeSets.POST("/:id/withdraw", requireManage, changeManagementHandler.WithdrawChangeSet)
		}
	}
}
