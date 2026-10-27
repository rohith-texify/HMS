BEGIN;

-- ============================================================================
-- HMS - 901 INDEXES
-- ============================================================================
-- Purpose:
--   Production indexes for the frozen HMS PostgreSQL schema.
--
-- IMPORTANT:
--   - This migration creates indexes only.
--   - No tables are created.
--   - No columns are added or modified.
--   - All indexes target columns that exist in the frozen schema.
--
-- Run order:
--   After 900_security.sql
--   Before 902_views.sql
-- ============================================================================


-- ============================================================================
-- 1. PLATFORM - COLLEGES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_colleges_status
    ON platform.colleges(status);

CREATE INDEX IF NOT EXISTS idx_colleges_name
    ON platform.colleges(name);


-- ============================================================================
-- 2. PLATFORM - USERS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_status
    ON app.users(status);

CREATE INDEX IF NOT EXISTS idx_users_last_login_at
    ON app.users(last_login_at);


-- ============================================================================
-- 3. PLATFORM - USER ROLES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user
    ON platform.user_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_role
    ON platform.user_roles(role_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_college_status
    ON platform.user_roles(college_id, status);

CREATE INDEX IF NOT EXISTS idx_user_roles_expires_at
    ON platform.user_roles(expires_at);


-- ============================================================================
-- 4. PLATFORM - ROLES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_roles_scope
    ON platform.roles(scope);

CREATE INDEX IF NOT EXISTS idx_roles_system
    ON platform.roles(is_system_role);


-- ============================================================================
-- 5. PLATFORM - MODULES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_modules_parent
    ON platform.modules(parent_id);

CREATE INDEX IF NOT EXISTS idx_modules_active
    ON platform.modules(is_active);


-- ============================================================================
-- 6. PLATFORM - PERMISSIONS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_permissions_module
    ON platform.permissions(module_id);

CREATE INDEX IF NOT EXISTS idx_permissions_scope
    ON platform.permissions(scope_type);


-- ============================================================================
-- 7. PLATFORM - ROLE PERMISSIONS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_role_permissions_permission
    ON platform.role_permissions(permission_id);


-- ============================================================================
-- 8. PLATFORM - COLLEGE MODULES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_college_modules_college_status
    ON platform.college_modules(college_id, status);

CREATE INDEX IF NOT EXISTS idx_college_modules_module
    ON platform.college_modules(module_id);

CREATE INDEX IF NOT EXISTS idx_college_modules_effective
    ON platform.college_modules(effective_from, effective_to);


-- ============================================================================
-- 9. PLATFORM - COLLEGE SETTINGS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_college_settings_college
    ON platform.college_settings(college_id);

CREATE INDEX IF NOT EXISTS idx_college_settings_key
    ON platform.college_settings(college_id, setting_key);


-- ============================================================================
-- 10. PLATFORM - COLLEGE ONBOARDING
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_college_onboarding_college
    ON platform.college_onboarding(college_id);

CREATE INDEX IF NOT EXISTS idx_college_onboarding_status
    ON platform.college_onboarding(college_id, status);


-- ============================================================================
-- 11. PLATFORM - APPROVAL REQUESTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_approval_requests_college_status
    ON platform.approval_requests(college_id, status);

CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_by
    ON platform.approval_requests(requested_by);

CREATE INDEX IF NOT EXISTS idx_approval_requests_expires_at
    ON platform.approval_requests(expires_at);


-- ============================================================================
-- 12. PLATFORM - APPROVAL STEPS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_approval_steps_request
    ON platform.approval_steps(request_id);

CREATE INDEX IF NOT EXISTS idx_approval_steps_approver
    ON platform.approval_steps(approver_id);

CREATE INDEX IF NOT EXISTS idx_approval_steps_decision
    ON platform.approval_steps(decision);


-- ============================================================================
-- 13. PLATFORM - AUDIT LOGS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_college_created
    ON platform.audit_logs(college_id, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
    ON platform.audit_logs(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
    ON platform.audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_module_action
    ON platform.audit_logs(module, action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON platform.audit_logs(created_at);


-- ============================================================================
-- 14. PLATFORM - LOGIN EVENTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_login_events_user
    ON platform.login_events(user_id);

CREATE INDEX IF NOT EXISTS idx_login_events_college_event
    ON platform.login_events(college_id, event_at);

CREATE INDEX IF NOT EXISTS idx_login_events_result
    ON platform.login_events(result);


-- ============================================================================
-- 15. PLATFORM - SUPPORT ACCESS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_support_access_college
    ON platform.support_access_grants(college_id);

CREATE INDEX IF NOT EXISTS idx_support_access_grantee
    ON platform.support_access_grants(grantee_id);

CREATE INDEX IF NOT EXISTS idx_support_access_active
    ON platform.support_access_grants(
        college_id,
        starts_at,
        expires_at
    );


-- ============================================================================
-- 16. PLATFORM - DEVICE TOKENS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_device_tokens_user
    ON platform.device_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_device_tokens_active
    ON platform.device_tokens(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_device_tokens_last_seen
    ON platform.device_tokens(last_seen_at);


-- ============================================================================
-- 17. ACADEMIC - DEPARTMENTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_departments_college_status
    ON app.departments(college_id, status);

CREATE INDEX IF NOT EXISTS idx_departments_head
    ON app.departments(head_user_id);


-- ============================================================================
-- 18. ACADEMIC - PROGRAMS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_programs_college_status
    ON app.programs(college_id, status);

CREATE INDEX IF NOT EXISTS idx_programs_department
    ON app.programs(department_id);


-- ============================================================================
-- 19. ACADEMIC - COURSES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_courses_college_status
    ON app.courses(college_id, status);

CREATE INDEX IF NOT EXISTS idx_courses_department
    ON app.courses(department_id);

CREATE INDEX IF NOT EXISTS idx_courses_program
    ON app.courses(program_id);


-- ============================================================================
-- 20. ACADEMIC - ACADEMIC YEARS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_academic_years_college_status
    ON app.academic_years(college_id, status);

CREATE INDEX IF NOT EXISTS idx_academic_years_current
    ON app.academic_years(college_id, is_current);


-- ============================================================================
-- 21. ACADEMIC - SEMESTERS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_semesters_college_status
    ON app.semesters(college_id, status);

CREATE INDEX IF NOT EXISTS idx_semesters_academic_year
    ON app.semesters(academic_year_id);


-- ============================================================================
-- 22. ACADEMIC - BATCHES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_batches_college_status
    ON app.batches(college_id, status);

CREATE INDEX IF NOT EXISTS idx_batches_program
    ON app.batches(program_id);

CREATE INDEX IF NOT EXISTS idx_batches_academic_year
    ON app.batches(academic_year_id);


-- ============================================================================
-- 23. HOSTEL - HOSTELS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_hostels_college_status
    ON app.hostels(college_id, status);


-- ============================================================================
-- 24. HOSTEL - BLOCKS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_blocks_college_status
    ON app.blocks(college_id, status);

CREATE INDEX IF NOT EXISTS idx_blocks_hostel
    ON app.blocks(hostel_id);


-- ============================================================================
-- 25. HOSTEL - FLOORS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_floors_college_status
    ON app.floors(college_id, status);

CREATE INDEX IF NOT EXISTS idx_floors_hostel
    ON app.floors(hostel_id);

CREATE INDEX IF NOT EXISTS idx_floors_block
    ON app.floors(block_id);


-- ============================================================================
-- 26. HOSTEL - ROOMS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_rooms_college_status
    ON app.rooms(college_id, status);

CREATE INDEX IF NOT EXISTS idx_rooms_hostel
    ON app.rooms(hostel_id);

CREATE INDEX IF NOT EXISTS idx_rooms_block
    ON app.rooms(block_id);

CREATE INDEX IF NOT EXISTS idx_rooms_floor
    ON app.rooms(floor_id);


-- ============================================================================
-- 27. HOSTEL - BEDS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_beds_college_status
    ON app.beds(college_id, status);

CREATE INDEX IF NOT EXISTS idx_beds_hostel
    ON app.beds(hostel_id);

CREATE INDEX IF NOT EXISTS idx_beds_block
    ON app.beds(block_id);

CREATE INDEX IF NOT EXISTS idx_beds_floor
    ON app.beds(floor_id);

CREATE INDEX IF NOT EXISTS idx_beds_room
    ON app.beds(room_id);


-- ============================================================================
-- 28. HOSTEL - BED ALLOCATIONS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bed_allocations_college_status
    ON app.bed_allocations(college_id, status);

CREATE INDEX IF NOT EXISTS idx_bed_allocations_bed
    ON app.bed_allocations(bed_id);

CREATE INDEX IF NOT EXISTS idx_bed_allocations_student
    ON app.bed_allocations(student_id);

CREATE INDEX IF NOT EXISTS idx_bed_allocations_active
    ON app.bed_allocations(
        student_id,
        status,
        allocated_at
    );


-- ============================================================================
-- 29. HOSTEL - ROOM MAINTENANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_room_maintenance_college_status
    ON app.room_maintenance(college_id, status);

CREATE INDEX IF NOT EXISTS idx_room_maintenance_room
    ON app.room_maintenance(room_id);

CREATE INDEX IF NOT EXISTS idx_room_maintenance_started
    ON app.room_maintenance(started_at);


-- ============================================================================
-- 30. HOSTEL - GATES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_gates_college_status
    ON app.gates(college_id, status);

CREATE INDEX IF NOT EXISTS idx_gates_hostel
    ON app.gates(hostel_id);


-- ============================================================================
-- 31. PEOPLE - STUDENTS
-- ============================================================================

-- students uses student_status, not status.
CREATE INDEX IF NOT EXISTS idx_students_college_status
    ON app.students(college_id, student_status);

CREATE INDEX IF NOT EXISTS idx_students_user
    ON app.students(user_id);

CREATE INDEX IF NOT EXISTS idx_students_department
    ON app.students(department_id);

CREATE INDEX IF NOT EXISTS idx_students_program
    ON app.students(program_id);

CREATE INDEX IF NOT EXISTS idx_students_course
    ON app.students(course_id);

CREATE INDEX IF NOT EXISTS idx_students_batch
    ON app.students(batch_id);

CREATE INDEX IF NOT EXISTS idx_students_academic_year
    ON app.students(academic_year_id);

CREATE INDEX IF NOT EXISTS idx_students_semester
    ON app.students(semester_id);

CREATE INDEX IF NOT EXISTS idx_students_hostel_status
    ON app.students(college_id, hostel_status);


-- ============================================================================
-- 32. PEOPLE - PARENTS
-- ============================================================================

-- parents has no generic status column.
CREATE INDEX IF NOT EXISTS idx_parents_college
    ON app.parents(college_id);

CREATE INDEX IF NOT EXISTS idx_parents_user
    ON app.parents(user_id);


-- ============================================================================
-- 33. PEOPLE - STUDENT PARENTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_student_parents_student
    ON app.student_parents(student_id);

CREATE INDEX IF NOT EXISTS idx_student_parents_parent
    ON app.student_parents(parent_id);


-- ============================================================================
-- 34. PEOPLE - EMERGENCY CONTACTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_student
    ON app.emergency_contacts(student_id);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_primary
    ON app.emergency_contacts(
        student_id,
        is_primary
    );


-- ============================================================================
-- 35. PEOPLE - STAFF
-- ============================================================================

-- staff_profiles uses employment_status, not status.
CREATE INDEX IF NOT EXISTS idx_staff_profiles_college_status
    ON app.staff_profiles(college_id, employment_status);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_user
    ON app.staff_profiles(user_id);


-- ============================================================================
-- 36. PEOPLE - INCHARGE HOSTELS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_incharge_hostels_college
    ON app.incharge_hostels(college_id);

CREATE INDEX IF NOT EXISTS idx_incharge_hostels_staff
    ON app.incharge_hostels(staff_id);

CREATE INDEX IF NOT EXISTS idx_incharge_hostels_hostel
    ON app.incharge_hostels(hostel_id);

-- Actual columns are assigned_from / assigned_until.
CREATE INDEX IF NOT EXISTS idx_incharge_hostels_active
    ON app.incharge_hostels(
        hostel_id,
        assigned_from,
        assigned_until
    );


-- ============================================================================
-- 37. PEOPLE - SECURITY ASSIGNMENTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_security_assignments_college
    ON app.security_assignments(college_id);

CREATE INDEX IF NOT EXISTS idx_security_assignments_staff
    ON app.security_assignments(staff_id);

CREATE INDEX IF NOT EXISTS idx_security_assignments_gate
    ON app.security_assignments(gate_id);

-- Actual columns are assigned_from / assigned_until.
CREATE INDEX IF NOT EXISTS idx_security_assignments_dates
    ON app.security_assignments(
        assigned_from,
        assigned_until
    );


-- ============================================================================
-- 38. MOVEMENT - ATTENDANCE CARDS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_attendance_cards_college_status
    ON app.attendance_cards(college_id, status);

CREATE INDEX IF NOT EXISTS idx_attendance_cards_student
    ON app.attendance_cards(student_id);

CREATE INDEX IF NOT EXISTS idx_attendance_cards_expiry
    ON app.attendance_cards(expiry_at);


-- ============================================================================
-- 39. MOVEMENT - ATTENDANCE RECORDS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_attendance_records_college_date
    ON app.attendance_records(
        college_id,
        attendance_date
    );

CREATE INDEX IF NOT EXISTS idx_attendance_records_student_date
    ON app.attendance_records(
        student_id,
        attendance_date
    );

CREATE INDEX IF NOT EXISTS idx_attendance_records_student_recorded
    ON app.attendance_records(
        student_id,
        recorded_at
    );

CREATE INDEX IF NOT EXISTS idx_attendance_records_status
    ON app.attendance_records(
        college_id,
        status
    );


-- ============================================================================
-- 40. MOVEMENT - ENTRY EXIT
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_entry_exit_college_recorded
    ON app.entry_exit_records(
        college_id,
        recorded_at
    );

CREATE INDEX IF NOT EXISTS idx_entry_exit_student_recorded
    ON app.entry_exit_records(
        student_id,
        recorded_at
    );

CREATE INDEX IF NOT EXISTS idx_entry_exit_gate
    ON app.entry_exit_records(gate_id);

CREATE INDEX IF NOT EXISTS idx_entry_exit_movement
    ON app.entry_exit_records(
        college_id,
        movement_type
    );


-- ============================================================================
-- 41. MOVEMENT - RECORD CORRECTIONS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_record_corrections_college_status
    ON app.record_corrections(
        college_id,
        status
    );

CREATE INDEX IF NOT EXISTS idx_record_corrections_record
    ON app.record_corrections(
        record_type,
        record_id
    );

CREATE INDEX IF NOT EXISTS idx_record_corrections_requested_by
    ON app.record_corrections(requested_by);


-- ============================================================================
-- 42. REQUESTS - LEAVE REQUESTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_leave_requests_college_status
    ON app.leave_requests(
        college_id,
        status
    );

CREATE INDEX IF NOT EXISTS idx_leave_requests_student
    ON app.leave_requests(student_id);

CREATE INDEX IF NOT EXISTS idx_leave_requests_dates
    ON app.leave_requests(
        student_id,
        from_date,
        to_date
    );

CREATE INDEX IF NOT EXISTS idx_leave_requests_requested_at
    ON app.leave_requests(requested_at);


-- ============================================================================
-- 43. REQUESTS - LEAVE APPROVALS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_leave_approvals_request
    ON app.leave_approvals(leave_request_id);

CREATE INDEX IF NOT EXISTS idx_leave_approvals_approver
    ON app.leave_approvals(approver_user_id);

CREATE INDEX IF NOT EXISTS idx_leave_approvals_decision
    ON app.leave_approvals(
        college_id,
        decision
    );


-- ============================================================================
-- 44. REQUESTS - LEAVE VERIFICATION
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_leave_verification_request
    ON app.leave_verification_logs(leave_request_id);

CREATE INDEX IF NOT EXISTS idx_leave_verification_verified_by
    ON app.leave_verification_logs(verified_by);

CREATE INDEX IF NOT EXISTS idx_leave_verification_status
    ON app.leave_verification_logs(
        college_id,
        verification_status
    );


-- ============================================================================
-- 45. REQUESTS - GATE PASSES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_gate_passes_college_status
    ON app.gate_passes(
        college_id,
        status
    );

CREATE INDEX IF NOT EXISTS idx_gate_passes_student
    ON app.gate_passes(student_id);

CREATE INDEX IF NOT EXISTS idx_gate_passes_leave_request
    ON app.gate_passes(leave_request_id);

CREATE INDEX IF NOT EXISTS idx_gate_passes_validity
    ON app.gate_passes(
        valid_from,
        valid_until
    );


-- ============================================================================
-- 46. REQUESTS - GATE PASS VERIFICATIONS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_gate_pass_verifications_pass
    ON app.gate_pass_verifications(gate_pass_id);

CREATE INDEX IF NOT EXISTS idx_gate_pass_verifications_gate
    ON app.gate_pass_verifications(gate_id);

CREATE INDEX IF NOT EXISTS idx_gate_pass_verifications_status
    ON app.gate_pass_verifications(
        college_id,
        verification_status
    );


-- ============================================================================
-- 47. REQUESTS - VISITOR REQUESTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_visitor_requests_college_status
    ON app.visitor_requests(
        college_id,
        status
    );

CREATE INDEX IF NOT EXISTS idx_visitor_requests_student
    ON app.visitor_requests(student_id);

CREATE INDEX IF NOT EXISTS idx_visitor_requests_date
    ON app.visitor_requests(requested_visit_date);


-- ============================================================================
-- 48. REQUESTS - VISITORS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_visitors_college_status
    ON app.visitors(
        college_id,
        status
    );

CREATE INDEX IF NOT EXISTS idx_visitors_phone
    ON app.visitors(phone);


-- ============================================================================
-- 49. REQUESTS - VISITOR VISITS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_visitor_visits_college_status
    ON app.visitor_visits(
        college_id,
        status
    );

CREATE INDEX IF NOT EXISTS idx_visitor_visits_visitor
    ON app.visitor_visits(visitor_id);

CREATE INDEX IF NOT EXISTS idx_visitor_visits_student
    ON app.visitor_visits(student_id);

CREATE INDEX IF NOT EXISTS idx_visitor_visits_gate
    ON app.visitor_visits(gate_id);

CREATE INDEX IF NOT EXISTS idx_visitor_visits_active
    ON app.visitor_visits(
        college_id,
        check_in_at,
        check_out_at
    );


-- ============================================================================
-- 50. REQUESTS - PARCELS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_parcels_college_status
    ON app.parcels(
        college_id,
        status
    );

CREATE INDEX IF NOT EXISTS idx_parcels_student
    ON app.parcels(student_id);

CREATE INDEX IF NOT EXISTS idx_parcels_received
    ON app.parcels(received_at);


-- ============================================================================
-- 51. SUPPORT - COMPLAINTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_complaints_college_status
    ON app.complaints(
        college_id,
        status
    );

CREATE INDEX IF NOT EXISTS idx_complaints_student
    ON app.complaints(student_id);

CREATE INDEX IF NOT EXISTS idx_complaints_assigned
    ON app.complaints(assigned_to);

CREATE INDEX IF NOT EXISTS idx_complaints_priority
    ON app.complaints(
        college_id,
        priority
    );

CREATE INDEX IF NOT EXISTS idx_complaints_created
    ON app.complaints(created_at);


-- ============================================================================
-- 52. SUPPORT - COMPLAINT UPDATES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_complaint_updates_complaint
    ON app.complaint_updates(complaint_id);

CREATE INDEX IF NOT EXISTS idx_complaint_updates_updated_by
    ON app.complaint_updates(updated_by);

CREATE INDEX IF NOT EXISTS idx_complaint_updates_created
    ON app.complaint_updates(created_at);


-- ============================================================================
-- 53. SUPPORT - SOS ALERTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sos_alerts_college_status
    ON app.sos_alerts(
        college_id,
        status
    );

CREATE INDEX IF NOT EXISTS idx_sos_alerts_student
    ON app.sos_alerts(student_id);

CREATE INDEX IF NOT EXISTS idx_sos_alerts_triggered
    ON app.sos_alerts(triggered_at);


-- ============================================================================
-- 54. SUPPORT - SECURITY INCIDENTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_security_incidents_college_status
    ON app.security_incidents(
        college_id,
        status
    );

CREATE INDEX IF NOT EXISTS idx_security_incidents_severity
    ON app.security_incidents(
        college_id,
        severity
    );

CREATE INDEX IF NOT EXISTS idx_security_incidents_student_location
    ON app.security_incidents(
        hostel_id,
        block_id,
        room_id
    );

CREATE INDEX IF NOT EXISTS idx_security_incidents_gate
    ON app.security_incidents(gate_id);

CREATE INDEX IF NOT EXISTS idx_security_incidents_reported
    ON app.security_incidents(reported_at);


-- ============================================================================
-- 55. SUPPORT - INCIDENT UPDATES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_incident_updates_incident
    ON app.incident_updates(incident_id);

CREATE INDEX IF NOT EXISTS idx_incident_updates_updated_by
    ON app.incident_updates(updated_by);

CREATE INDEX IF NOT EXISTS idx_incident_updates_created
    ON app.incident_updates(created_at);


-- ============================================================================
-- 56. COMMUNICATION - NOTIFICATIONS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_notifications_college_status
    ON app.notifications(
        college_id,
        status
    );

CREATE INDEX IF NOT EXISTS idx_notifications_type
    ON app.notifications(notification_type);

CREATE INDEX IF NOT EXISTS idx_notifications_scheduled
    ON app.notifications(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_notifications_expires
    ON app.notifications(expires_at);

CREATE INDEX IF NOT EXISTS idx_notifications_source
    ON app.notifications(
        source_module,
        source_record_id
    );


-- ============================================================================
-- 57. COMMUNICATION - NOTIFICATION RECIPIENTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_notification_recipients_notification
    ON app.notification_recipients(notification_id);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_user
    ON app.notification_recipients(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_status
    ON app.notification_recipients(delivery_status);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_pending
    ON app.notification_recipients(
        delivery_status,
        created_at
    );


-- ============================================================================
-- 58. COMMUNICATION - ANNOUNCEMENTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_announcements_college_status
    ON app.announcements(
        college_id,
        status
    );

CREATE INDEX IF NOT EXISTS idx_announcements_publish
    ON app.announcements(publish_at);

CREATE INDEX IF NOT EXISTS idx_announcements_expiry
    ON app.announcements(expires_at);

CREATE INDEX IF NOT EXISTS idx_announcements_target
    ON app.announcements(target_type);


-- ============================================================================
-- 59. COMMUNICATION - PLATFORM NOTIFICATIONS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_platform_notifications_status
    ON app.platform_notifications(status);

CREATE INDEX IF NOT EXISTS idx_platform_notifications_publish
    ON app.platform_notifications(publish_at);

CREATE INDEX IF NOT EXISTS idx_platform_notifications_expiry
    ON app.platform_notifications(expires_at);

CREATE INDEX IF NOT EXISTS idx_platform_notifications_target
    ON app.platform_notifications(target_type);


-- ============================================================================
-- 60. MEALS - MEAL MENUS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_meal_menus_college_date
    ON app.meal_menus(
        college_id,
        menu_date
    );

CREATE INDEX IF NOT EXISTS idx_meal_menus_hostel_date
    ON app.meal_menus(
        hostel_id,
        menu_date
    );

CREATE INDEX IF NOT EXISTS idx_meal_menus_status
    ON app.meal_menus(
        college_id,
        status
    );


-- ============================================================================
-- 61. MEALS - MEAL TIMINGS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_meal_timings_college
    ON app.meal_timings(college_id);

CREATE INDEX IF NOT EXISTS idx_meal_timings_hostel
    ON app.meal_timings(hostel_id);

CREATE INDEX IF NOT EXISTS idx_meal_timings_status
    ON app.meal_timings(
        college_id,
        status
    );


-- ============================================================================
-- 62. MEALS - MESS NOTICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_mess_notices_college_status
    ON app.mess_notices(
        college_id,
        status
    );

CREATE INDEX IF NOT EXISTS idx_mess_notices_hostel
    ON app.mess_notices(hostel_id);

CREATE INDEX IF NOT EXISTS idx_mess_notices_publish
    ON app.mess_notices(publish_at);


-- ============================================================================
-- 63. MEALS - FOOD FEEDBACK
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_food_feedback_college
    ON app.food_feedback(college_id);

CREATE INDEX IF NOT EXISTS idx_food_feedback_student
    ON app.food_feedback(student_id);

CREATE INDEX IF NOT EXISTS idx_food_feedback_menu
    ON app.food_feedback(menu_id);

CREATE INDEX IF NOT EXISTS idx_food_feedback_rating
    ON app.food_feedback(
        college_id,
        rating
    );


-- ============================================================================
-- 64. RESOURCES - RESOURCE ITEMS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_resource_items_college_status
    ON app.resource_items(
        college_id,
        status
    );

CREATE INDEX IF NOT EXISTS idx_resource_items_hostel
    ON app.resource_items(hostel_id);

CREATE INDEX IF NOT EXISTS idx_resource_items_type
    ON app.resource_items(resource_type);


-- ============================================================================
-- 65. RESOURCES - RESOURCE AVAILABILITY
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_resource_availability_college
    ON app.resource_availability(college_id);

CREATE INDEX IF NOT EXISTS idx_resource_availability_resource
    ON app.resource_availability(resource_id);

CREATE INDEX IF NOT EXISTS idx_resource_availability_status
    ON app.resource_availability(
        college_id,
        status
    );


-- ============================================================================
-- 66. REPORTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_reports_saved_college_active
    ON app.reports_saved(
        college_id,
        is_active
    );

CREATE INDEX IF NOT EXISTS idx_reports_saved_owner
    ON app.reports_saved(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_reports_saved_type
    ON app.reports_saved(
        college_id,
        report_type
    );


-- ============================================================================
-- 67. FILES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_files_college_status
    ON app.files(
        college_id,
        status
    );

CREATE INDEX IF NOT EXISTS idx_files_owner
    ON app.files(
        owner_table,
        owner_id
    );

CREATE INDEX IF NOT EXISTS idx_files_uploaded_by
    ON app.files(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_files_created
    ON app.files(created_at);


-- ============================================================================
-- 68. ANALYTICAL / JSONB INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_announcements_target_value_gin
    ON app.announcements
    USING GIN(target_value);

CREATE INDEX IF NOT EXISTS idx_platform_notifications_target_value_gin
    ON app.platform_notifications
    USING GIN(target_value);

CREATE INDEX IF NOT EXISTS idx_reports_saved_filters_gin
    ON app.reports_saved
    USING GIN(filters);


-- ============================================================================
-- COMPLETION
-- ============================================================================

COMMIT;