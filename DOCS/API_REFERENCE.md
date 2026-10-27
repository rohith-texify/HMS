# HMS API Reference

All requests expect `Content-Type: application/json` and return responses in the format:
```json
{
  "success": true,
  "data": {}
}
```

## Authentication
- `POST /auth/login` (Public) - Authenticate and receive JWT.

## Health
- `GET /health` (Public) - API Liveness.
- `GET /health/db` (Public) - DB Readiness.

## College Scope Routes (Requires JWT)

*All following routes require a valid JWT. They are isolated by the JWT's `college_id`.*

### Hostel Operations
- `POST /api/v1/hostels` (Permission: `MANAGE_HOSTELS`)
- `GET /api/v1/hostels` (Permission: `VIEW_HOSTELS`)
- `POST /api/v1/blocks` (Permission: `MANAGE_HOSTELS`)
- `POST /api/v1/floors` (Permission: `MANAGE_HOSTELS`)
- `POST /api/v1/rooms` (Permission: `MANAGE_HOSTELS`)
- `POST /api/v1/beds` (Permission: `MANAGE_HOSTELS`)

### Allocations
- `POST /api/v1/allocations` (Permission: `MANAGE_ALLOCATIONS`)
- `GET /api/v1/allocations` (Permission: `VIEW_ALLOCATIONS`)

### Attendance
- `POST /api/v1/attendance` (Permission: `MARK_ATTENDANCE`)
- `GET /api/v1/attendance/:id` (Permission: `VIEW_ATTENDANCE`)
- `GET /api/v1/attendance/daily` (Permission: `VIEW_ATTENDANCE`)
- `POST /api/v1/attendance/bulk` (Permission: `MARK_ATTENDANCE`)
- `POST /api/v1/attendance/correction` (Permission: `APPROVE_ATTENDANCE_CORRECTION`)

### Leave Management
- `POST /api/v1/leaves` (Permission: `CREATE_LEAVE`)
- `GET /api/v1/leaves` (Permission: `VIEW_LEAVE`)
- `POST /api/v1/leaves/:id/approve` (Permission: `APPROVE_LEAVE`)
- `POST /api/v1/leaves/:id/reject` (Permission: `APPROVE_LEAVE`)
- `POST /api/v1/leaves/:id/cancel` (Permission: `CANCEL_LEAVE`)

### Mess Operations
- `POST /api/v1/mess/timing` (Permission: `MANAGE_MESS`)
- `GET /api/v1/mess/timing` (Permission: `VIEW_MESS`)
- `POST /api/v1/mess/menu` (Permission: `MANAGE_MESS`)
- `GET /api/v1/mess/menu` (Permission: `VIEW_MESS`)

### Complaints & Maintenance
- `POST /api/v1/complaints` (Permission: `CREATE_COMPLAINT`)
- `GET /api/v1/complaints` (Permission: `VIEW_COMPLAINTS`)
- `POST /api/v1/maintenance` (Permission: `CREATE_MAINTENANCE`)
- `GET /api/v1/maintenance` (Permission: `VIEW_MAINTENANCE`)

### Notifications
- `POST /api/v1/notifications` (Permission: `SEND_NOTIFICATIONS`)
- `GET /api/v1/notifications` (Permission: `VIEW_NOTIFICATIONS`)
- `POST /api/v1/notifications/:id/read` (Permission: `VIEW_NOTIFICATIONS`)
- `POST /api/v1/notifications/read-all` (Permission: `VIEW_NOTIFICATIONS`)

### Reports
- `GET /api/v1/reports/dashboard` (Permission: `VIEW_REPORTS`)

*(Note: Additional routes exist for Users, Students, Parents, Staff, Settings, and Platform Modules).*
