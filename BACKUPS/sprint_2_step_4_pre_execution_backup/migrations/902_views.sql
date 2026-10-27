-- ============================================================
-- 902_views.sql
-- ============================================================
-- Purpose:
--   Production reporting and operational views for HMS.
--
-- Important:
--   This file only creates/replaces views.
--   No tables, columns, constraints, or relationships are changed.
--
-- Dependencies:
--   Migrations 001 through 010
--   Migration 900_security.sql
-- ============================================================

BEGIN;

-- ============================================================
-- 1. CURRENT STUDENT BED ALLOCATION
-- ============================================================
-- Shows the currently active bed allocation for each student.
--
-- Useful for:
--   - Student current accommodation
--   - Hostel occupancy
--   - Room/bed lookup
--   - Admin dashboards
-- ============================================================

CREATE OR REPLACE VIEW app.v_current_student_bed_allocation
WITH (security_invoker = true) AS
SELECT
    ba.id AS allocation_id,
    ba.college_id,
    ba.student_id,

    -- Student details
    s.admission_number,
    s.registration_number,
    s.roll_number,
    s.first_name,
    s.middle_name,
    s.last_name,

    -- Hostel hierarchy
    h.id AS hostel_id,
    h.code AS hostel_code,
    h.name AS hostel_name,

    b.id AS block_id,
    b.code AS block_code,
    b.name AS block_name,

    f.id AS floor_id,
    f.code AS floor_code,
    f.name AS floor_name,
    f.floor_number,

    r.id AS room_id,
    r.code AS room_code,
    r.name AS room_name,
    r.room_type,

    -- Bed details
    be.id AS bed_id,
    be.code AS bed_code,
    be.name AS bed_name,

    -- Allocation details
    ba.allocation_type,
    ba.allocated_at,
    ba.released_at,
    ba.status,
    ba.remarks,

    ba.created_at,
    ba.updated_at

FROM app.bed_allocations ba

INNER JOIN app.students s
    ON s.id = ba.student_id
   AND s.college_id = ba.college_id

INNER JOIN app.beds be
    ON be.id = ba.bed_id
   AND be.college_id = ba.college_id

LEFT JOIN app.rooms r
    ON r.id = be.room_id
   AND r.college_id = ba.college_id

LEFT JOIN app.floors f
    ON f.id = be.floor_id
   AND f.college_id = ba.college_id

LEFT JOIN app.blocks b
    ON b.id = be.block_id
   AND b.college_id = ba.college_id

LEFT JOIN app.hostels h
    ON h.id = be.hostel_id
   AND h.college_id = ba.college_id

WHERE ba.status = 'ACTIVE';


-- ============================================================
-- 2. STUDENT CURRENT LOCATION
-- ============================================================
-- Returns the latest recorded entry/exit movement for each
-- student.
--
-- Uses the most recent entry_exit_records row.
-- ============================================================

CREATE OR REPLACE VIEW app.v_student_current_location
WITH (security_invoker = true) AS
SELECT
    s.id AS student_id,
    s.college_id,

    s.admission_number,
    s.registration_number,
    s.roll_number,
    s.first_name,
    s.middle_name,
    s.last_name,

    latest.movement_type,
    latest.recorded_at,
    latest.gate_id,
    latest.verification_method,
    latest.recorded_by,
    latest.remarks

FROM app.students s

LEFT JOIN LATERAL (
    SELECT
        eer.movement_type,
        eer.recorded_at,
        eer.gate_id,
        eer.verification_method,
        eer.recorded_by,
        eer.remarks
    FROM app.entry_exit_records eer
    WHERE eer.student_id = s.id
      AND eer.college_id = s.college_id
    ORDER BY eer.recorded_at DESC
    LIMIT 1
) latest
    ON TRUE;


-- ============================================================
-- 3. HOSTEL OCCUPANCY
-- ============================================================
-- Provides hostel-level capacity and current occupied bed count.
--
-- Occupancy is calculated from ACTIVE bed allocations.
-- ============================================================

CREATE OR REPLACE VIEW app.v_hostel_occupancy
WITH (security_invoker = true) AS
SELECT
    h.id AS hostel_id,
    h.college_id,

    h.code AS hostel_code,
    h.name AS hostel_name,
    h.category,

    h.total_capacity,

    COUNT(
        CASE
            WHEN ba.status = 'ACTIVE'
            THEN ba.id
        END
    ) AS occupied_beds,

    GREATEST(
        h.total_capacity -
        COUNT(
            CASE
                WHEN ba.status = 'ACTIVE'
                THEN ba.id
            END
        ),
        0
    ) AS available_capacity,

    CASE
        WHEN h.total_capacity > 0
        THEN ROUND(
            (
                COUNT(
                    CASE
                        WHEN ba.status = 'ACTIVE'
                        THEN ba.id
                    END
                )::NUMERIC
                / h.total_capacity
            ) * 100,
            2
        )
        ELSE 0
    END AS occupancy_percentage,

    h.status,
    h.created_at,
    h.updated_at

FROM app.hostels h

LEFT JOIN app.beds be
    ON be.hostel_id = h.id
   AND be.college_id = h.college_id

LEFT JOIN app.bed_allocations ba
    ON ba.bed_id = be.id
   AND ba.college_id = h.college_id
   AND ba.status = 'ACTIVE'

GROUP BY
    h.id,
    h.college_id,
    h.code,
    h.name,
    h.category,
    h.total_capacity,
    h.status,
    h.created_at,
    h.updated_at;


-- ============================================================
-- 4. OPEN COMPLAINT SUMMARY
-- ============================================================
-- Provides a summarized view of complaints that are not closed.
--
-- Useful for:
--   - Admin dashboard
--   - Warden dashboard
--   - Complaint monitoring
-- ============================================================

CREATE OR REPLACE VIEW app.v_open_complaint_summary
WITH (security_invoker = true) AS
SELECT
    c.college_id,

    c.category,
    c.priority,
    c.status,

    COUNT(*) AS complaint_count,

    MIN(c.created_at) AS oldest_complaint_at,
    MAX(c.created_at) AS latest_complaint_at

FROM app.complaints c

WHERE c.status NOT IN (
    'CLOSED',
    'RESOLVED'
)

GROUP BY
    c.college_id,
    c.category,
    c.priority,
    c.status;


-- ============================================================
-- 5. ACTIVE SOS ALERTS
-- ============================================================
-- Shows currently active/unresolved SOS alerts.
--
-- IMPORTANT:
--   app.sos_alerts does NOT contain incident_id.
--   app.sos_alerts uses location_description.
-- ============================================================

CREATE OR REPLACE VIEW app.v_active_sos_alerts
WITH (security_invoker = true) AS
SELECT
    s.id AS sos_alert_id,
    s.college_id,
    s.student_id,

    -- Student details
    st.admission_number,
    st.registration_number,
    st.roll_number,
    st.first_name,
    st.middle_name,
    st.last_name,

    -- SOS details
    s.alert_number,
    s.alert_type,
    s.message,

    -- Location
    s.latitude,
    s.longitude,
    s.location_description,

    -- Lifecycle
    s.status,
    s.triggered_at,

    -- Acknowledgement
    s.acknowledged_by,
    s.acknowledged_at,

    -- Resolution
    s.resolved_by,
    s.resolved_at,
    s.resolution_notes,

    s.created_at,
    s.updated_at

FROM app.sos_alerts s

LEFT JOIN app.students st
    ON st.id = s.student_id
   AND st.college_id = s.college_id

WHERE s.status IN (
    'ACTIVE',
    'TRIGGERED',
    'ACKNOWLEDGED'
);


-- ============================================================
-- 6. TODAY'S MEAL MENUS
-- ============================================================
-- Shows published meal menus for the current date.
--
-- IMPORTANT:
--   app.meal_menus does NOT contain published_at.
-- ============================================================

CREATE OR REPLACE VIEW app.v_today_meal_menus
WITH (security_invoker = true) AS
SELECT
    m.id AS meal_menu_id,
    m.college_id,
    m.hostel_id,

    h.code AS hostel_code,
    h.name AS hostel_name,

    m.menu_date,
    m.meal_type,
    m.items,
    m.status,

    m.created_at,
    m.updated_at

FROM app.meal_menus m

LEFT JOIN app.hostels h
    ON h.id = m.hostel_id
   AND h.college_id = m.college_id

WHERE m.menu_date = CURRENT_DATE
  AND m.status = 'PUBLISHED';


-- ============================================================
-- 7. RESOURCE AVAILABILITY
-- ============================================================
-- Shows resource inventory together with current availability.
--
-- Useful for:
--   - Resource management
--   - Hostel inventory
--   - Availability dashboards
-- ============================================================

CREATE OR REPLACE VIEW app.v_resource_availability
WITH (security_invoker = true) AS
SELECT
    ri.id AS resource_id,
    ri.college_id,
    ri.hostel_id,

    ri.resource_type,
    ri.name,
    ri.description,

    ri.total_qty,
    ri.unit,

    ra.available_qty,
    ra.status AS availability_status,
    ra.updated_by,
    ra.updated_at AS availability_updated_at,

    ri.status AS resource_status,
    ri.created_at,
    ri.updated_at

FROM app.resource_items ri

LEFT JOIN app.resource_availability ra
    ON ra.resource_id = ri.id
   AND ra.college_id = ri.college_id

WHERE ri.status = 'ACTIVE';


-- ============================================================
-- 8. PENDING LEAVE REQUESTS
-- ============================================================
-- Shows leave requests waiting for further approval/action.
--
-- IMPORTANT:
--   app.leave_requests uses:
--       from_date
--       to_date
--       from_time
--       to_time
--
--   It does NOT use start_at/end_at.
-- ============================================================

CREATE OR REPLACE VIEW app.v_pending_leave_requests
WITH (security_invoker = true) AS
SELECT
    lr.id AS leave_request_id,
    lr.college_id,
    lr.student_id,

    -- Student details
    s.admission_number,
    s.registration_number,
    s.roll_number,
    s.first_name,
    s.middle_name,
    s.last_name,

    -- Leave details
    lr.leave_type,
    lr.reason,

    lr.from_date,
    lr.to_date,
    lr.from_time,
    lr.to_time,

    lr.destination,
    lr.contact_phone,

    lr.status,
    lr.requested_at,

    lr.created_by,
    lr.updated_by,

    lr.created_at,
    lr.updated_at

FROM app.leave_requests lr

INNER JOIN app.students s
    ON s.id = lr.student_id
   AND s.college_id = lr.college_id

WHERE lr.status IN (
    'PENDING',
    'PARENT_APPROVED'
);


-- ============================================================
-- 9. CURRENT VISITOR ACTIVITY
-- ============================================================
-- Shows visitors currently expected or checked into the campus.
--
-- IMPORTANT:
--   app.visitors uses full_name, not name.
--
-- This view intentionally uses visitor_visits directly and does
-- not depend on additional visitor_request columns.
-- ============================================================

CREATE OR REPLACE VIEW app.v_current_visitor_activity
WITH (security_invoker = true) AS
SELECT
    vv.id AS visitor_visit_id,
    vv.college_id,

    -- Student being visited
    vv.student_id,
    s.admission_number,
    s.registration_number,
    s.roll_number,
    s.first_name,
    s.middle_name,
    s.last_name,

    -- Visitor
    v.id AS visitor_id,
    v.full_name AS visitor_name,
    v.phone AS visitor_phone,
    v.email AS visitor_email,

    -- Visit
    vv.purpose,
    vv.gate_id,
    vv.check_in_at,
    vv.check_out_at,
    vv.status,
    vv.verified_by,
    vv.remarks,

    vv.created_at,
    vv.updated_at

FROM app.visitor_visits vv

INNER JOIN app.visitors v
    ON v.id = vv.visitor_id
   AND v.college_id = vv.college_id

LEFT JOIN app.students s
    ON s.id = vv.student_id
   AND s.college_id = vv.college_id

WHERE vv.status IN (
    'EXPECTED',
    'CHECKED_IN'
);


-- ============================================================
-- VIEW COMMENTS
-- ============================================================

COMMENT ON VIEW app.v_current_student_bed_allocation IS
'Current active bed allocation and complete hostel location hierarchy for students.';

COMMENT ON VIEW app.v_student_current_location IS
'Latest recorded entry/exit movement for each student.';

COMMENT ON VIEW app.v_hostel_occupancy IS
'Hostel capacity, occupied beds, available capacity, and occupancy percentage.';

COMMENT ON VIEW app.v_open_complaint_summary IS
'Aggregated summary of complaints that are not closed or resolved.';

COMMENT ON VIEW app.v_active_sos_alerts IS
'Currently active, triggered, or acknowledged SOS alerts.';

COMMENT ON VIEW app.v_today_meal_menus IS
'Published meal menus for the current date.';

COMMENT ON VIEW app.v_resource_availability IS
'Current resource inventory and availability by resource item.';

COMMENT ON VIEW app.v_pending_leave_requests IS
'Leave requests awaiting further approval or action.';

COMMENT ON VIEW app.v_current_visitor_activity IS
'Visitors currently expected or checked into the hostel/campus.';


COMMIT;