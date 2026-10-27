# HMS Database Module

**Hostel Management System - PostgreSQL Database Layer**

Version: 1.0.0  
Last Updated: 2026-10-05  
Database: PostgreSQL 14+

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Principles](#architecture-principles)
3. [Database Structure](#database-structure)
4. [Folder Organization](#folder-organization)
5. [Migration Catalog](#migration-catalog)
6. [Schema Architecture](#schema-architecture)
7. [Domain Models](#domain-models)
8. [Multi-Tenancy Design](#multi-tenancy-design)
9. [Security Model](#security-model)
10. [Row-Level Security (RLS)](#row-level-security-rls)
11. [Indexes](#indexes)
12. [Views](#views)
13. [Functions](#functions)
14. [Triggers](#triggers)
15. [Seed Data](#seed-data)
16. [Validation](#validation)
17. [Setup Instructions](#setup-instructions)
18. [Migration Execution](#migration-execution)
19. [Troubleshooting](#troubleshooting)
20. [Performance Optimization](#performance-optimization)
21. [Backup and Recovery](#backup-and-recovery)
22. [Development Guidelines](#development-guidelines)
23. [Testing Strategy](#testing-strategy)
24. [API Integration](#api-integration)
25. [Monitoring](#monitoring)
26. [Security Best Practices](#security-best-practices)
27. [Data Retention](#data-retention)
28. [Compliance](#compliance)
29. [Change Management](#change-management)
30. [Disaster Recovery](#disaster-recovery)
31. [Known Issues](#known-issues)
32. [FAQ](#faq)
33. [Glossary](#glossary)
34. [Contributing](#contributing)
35. [License](#license)
36. [Support](#support)
37. [References](#references)

---

## Overview

The HMS Database Module is a production-grade PostgreSQL database implementation for managing hostel operations across educational institutions. It provides a comprehensive multi-tenant architecture supporting colleges, hostels, students, staff, and administrative operations.

### Key Features

- **Multi-tenant architecture** with schema-based isolation (platform + app schemas)
- **Row-Level Security (RLS)** for data isolation and access control
- **68+ tables** organized into 11 domain modules
- **9+ materialized views** for reporting and analytics
- **Comprehensive audit logging** for compliance and traceability
- **RBAC (Role-Based Access Control)** with fine-grained permissions
- **Entitlement-based feature management** for tenant capabilities
- **Automated validation scripts** for database integrity
- **Seed data management** for development, testing, and production environments

### Target Audience

- Database Administrators
- Backend Developers
- DevOps Engineers
- System Architects
- QA Engineers

---

## Architecture Principles

The HMS database follows these core architectural principles:

### 1. Multi-Tenancy First

- **Schema separation**: Platform schema for system-wide data, app schema for tenant-specific data
- **Tenant context enforcement**: All app schema queries require tenant_id via `app.current_tenant_id()`
- **Isolation guarantees**: RLS policies prevent cross-tenant data leakage

### 2. Security by Default

- Row-Level Security enabled on all tenant tables
- Encrypted sensitive data (passwords use pgcrypto)
- Audit logging for all critical operations
- Role-based access control with principle of least privilege

### 3. Scalability & Performance

- Strategic indexing on foreign keys and query patterns
- Materialized views for complex reporting
- Partitioning considerations for high-volume tables (movement logs, audit logs)
- Connection pooling support via standard PostgreSQL authentication

### 4. Data Integrity

- Foreign key constraints with appropriate CASCADE/RESTRICT rules
- CHECK constraints for data validation
- NOT NULL constraints on critical fields
- Enumerated types for status fields

### 5. Maintainability

- Clear naming conventions (snake_case, descriptive names)
- Comprehensive inline documentation
- Modular migration structure organized by domain
- Validation scripts for automated testing

---

## Database Structure

### Summary Statistics

| Component | Count | Description |
|-----------|-------|-------------|
| Schemas | 2 | platform (system), app (tenant) |
| Tables | 68+ | Core entities across 11 domains |
| Views | 9+ | Materialized views for reporting |
| Indexes | 150+ | Performance optimization |
| Functions | 20+ | Business logic and utilities |
| Triggers | 30+ | Automated data management |
| Extensions | 2 | pgcrypto, citext |

### Schemas

#### **platform** Schema
System-wide data shared across all tenants:
- Colleges (tenants)
- System users and authentication
- Roles, permissions, and authorization
- Modules and entitlements
- Global configurations
- Audit logs

#### **app** Schema
Tenant-specific operational data:
- Students and parents
- Hostels, buildings, rooms, beds
- Attendance and movement tracking
- Leave requests and gate passes
- Complaints and incidents
- Notifications and communications
- Mess management
- Reports and files

---

## Folder Organization

```
DATABASE/
│
├── README.md                    # This documentation file
├── validate.sql                 # Database validation script
│
├── migrations/                  # Sequential migration files
│   ├── 000_extensions.sql       # PostgreSQL extensions
│   ├── 001_platform.sql         # Platform schema tables
│   ├── 002_academic.sql         # Academic domain tables
│   ├── 003_hostel.sql           # Hostel infrastructure tables
│   ├── 004_people.sql           # Students, parents, users
│   ├── 005_movement.sql         # Movement tracking tables
│   ├── 006_requests.sql         # Leave and gate pass requests
│   ├── 007_support.sql          # Complaints and incidents
│   ├── 008_communication.sql    # Announcements and notifications
│   ├── 009_meals_resources.sql  # Mess and file management
│   ├── 010_super_admin_platform.sql # Super admin enhancements
│   ├── 900_security.sql         # RLS policies and security
│   ├── 901_indexes.sql          # Performance indexes
│   ├── 902_views.sql            # Materialized views
│   └── 903_seed.sql             # Initial seed data
│
├── functions/                   # Database functions (organized by domain)
│   ├── audit/
│   ├── authentication/
│   ├── authorization/
│   ├── tenant/
│   ├── hostel/
│   ├── student/
│   ├── attendance/
│   ├── movement/
│   ├── leave/
│   ├── gate_pass/
│   ├── visitors/
│   ├── complaints/
│   ├── security/
│   ├── notifications/
│   ├── mess/
│   └── reports/
│
├── triggers/                    # Database triggers (organized by domain)
│   ├── audit/
│   ├── timestamps/
│   ├── tenant/
│   ├── users/
│   ├── students/
│   ├── hostel/
│   ├── attendance/
│   ├── movement/
│   ├── requests/
│   ├── notifications/
│   └── security/
│
├── views/                       # View definitions (organized by domain)
│   ├── platform/
│   ├── academic/
│   ├── hostel/
│   ├── students/
│   ├── attendance/
│   ├── movement/
│   ├── requests/
│   ├── security/
│   ├── communication/
│   ├── mess/
│   └── reports/
│
├── indexes/                     # Index definitions (organized by domain)
│   ├── platform/
│   ├── academic/
│   ├── hostel/
│   ├── students/
│   ├── attendance/
│   ├── movement/
│   ├── requests/
│   ├── communication/
│   ├── security/
│   └── reporting/
│
├── rls/                         # Row-Level Security policies
│   ├── rls_helpers.sql
│   ├── platform/
│   ├── academic/
│   ├── hostel/
│   ├── students/
│   ├── attendance/
│   ├── movement/
│   ├── requests/
│   ├── communication/
│   ├── security/
│   └── reporting/
│
└── seeds/                       # Environment-specific seed data
    ├── development/             # Dev environment seeds
    │   ├── 001_roles.sql
    │   ├── 002_permissions.sql
    │   ├── 003_modules.sql
    │   ├── 004_college.sql
    │   ├── 005_users.sql
    │   ├── 006_academic.sql
    │   ├── 007_hostel.sql
    │   └── 008_students.sql
    ├── testing/                 # Test environment seeds
    │   ├── 001_roles.sql
    │   ├── 002_permissions.sql
    │   ├── 003_college.sql
    │   ├── 004_users.sql
    │   ├── 005_academic.sql
    │   ├── 006_hostel.sql
    │   └── 007_students.sql
    └── production/              # Production seeds (minimal)
        ├── 001_roles.sql
        ├── 002_permissions.sql
        ├── 003_modules.sql
        └── 004_entitlements.sql
```

### Organization Notes

**Current Implementation:**
- All database objects (functions, triggers, views, indexes, RLS policies) are currently defined within the migration files themselves
- The organization folders (functions/, triggers/, views/, indexes/, rls/, seeds/) exist for future modular organization
- Migration files contain embedded definitions for maintainability and atomic execution

**Future Enhancement:**
- As the database grows, consider extracting reusable objects into separate files
- Maintain backwards compatibility by keeping references in migration files

---

## Migration Catalog

All migrations are executed sequentially in the order listed below.

| File | Domain | Description | Tables Created | Dependencies |
|------|--------|-------------|----------------|--------------|
| `000_extensions.sql` | System | PostgreSQL extensions setup | 0 | None |
| `001_platform.sql` | Platform | System-wide platform tables | 10+ | 000 |
| `002_academic.sql` | Academic | Academic structure (colleges, courses, departments) | 5+ | 001 |
| `003_hostel.sql` | Hostel | Hostel infrastructure (buildings, blocks, floors, rooms, beds) | 6+ | 001, 002 |
| `004_people.sql` | People | Students, parents, users | 3+ | 001, 002, 003 |
| `005_movement.sql` | Movement | Entry/exit tracking and movement logs | 3+ | 001, 004 |
| `006_requests.sql` | Requests | Leave requests and gate passes | 4+ | 001, 004 |
| `007_support.sql` | Support | Complaints, incidents, SOS events | 5+ | 001, 004 |
| `008_communication.sql` | Communication | Announcements, notifications | 4+ | 001, 004 |
| `009_meals_resources.sql` | Meals/Resources | Mess management, file storage | 4+ | 001, 004 |
| `010_super_admin_platform.sql` | Platform | Super admin enhancements, approval policies | 3+ | 001 |
| `900_security.sql` | Security | Row-Level Security policies | 0 | 001-010 |
| `901_indexes.sql` | Performance | Strategic indexes for query optimization | 0 | 001-010 |
| `902_views.sql` | Reporting | Materialized views for analytics | 0 | 001-010 |
| `903_seed.sql` | Data | Initial seed data (roles, permissions, modules) | 0 | 001-902 |

### Migration Numbering Convention

- **000-099**: Extensions and system setup
- **100-899**: Domain-specific tables and business logic
- **900-999**: Cross-cutting concerns (security, indexes, views, seeds)

---

## Schema Architecture

### platform Schema

**Purpose**: System-wide data shared across all tenants (colleges)

**Key Tables**:

#### Tenant Management
- `platform.colleges`: Tenant (college) definitions
  - Columns: id, name, code, type, status, subscription_tier, settings
- `platform.college_contacts`: Contact information for colleges
- `platform.college_onboarding`: Onboarding workflow tracking

#### Identity & Access Management
- `platform.users`: System user accounts
  - Columns: id, email, password_hash, phone, status, role
- `platform.roles`: Role definitions (SUPER_ADMIN, ADMIN, HOSTEL_INCHARGE, etc.)
- `platform.permissions`: Permission definitions (granular access rights)
- `platform.role_permissions`: Role-permission mappings
- `platform.user_roles`: User-role assignments (with college_id for tenant context)

#### Entitlements & Features
- `platform.modules`: Feature modules (attendance, leave, gate_pass, etc.)
- `platform.entitlements`: College-module mappings (which features each tenant has)
- `platform.entitlement_templates`: Predefined feature bundles

#### Audit & Compliance
- `platform.audit_logs`: Comprehensive audit trail
  - Columns: id, college_id, user_id, action, entity_type, entity_id, changes, ip_address, timestamp
- `platform.login_events`: Authentication event tracking

#### Configuration
- `platform.configurations`: System-wide configuration key-value store
- `platform.approval_policies`: Approval workflow configurations
- `platform.approval_requests`: Approval request tracking

### app Schema

**Purpose**: Tenant-specific operational data (isolated by college_id)

**Key Tables**:

#### Academic Domain
- `app.colleges`: Tenant-specific college details
- `app.courses`: Academic courses/programs
- `app.departments`: Academic departments
- `app.semesters`: Academic term definitions
- `app.academic_years`: Academic year definitions

#### Hostel Infrastructure
- `app.hostels`: Hostel buildings
- `app.buildings`: Building structures within hostels
- `app.blocks`: Blocks/wings within buildings
- `app.floors`: Floor levels
- `app.rooms`: Individual rooms
- `app.beds`: Bed allocations within rooms

#### People
- `app.students`: Student profiles
  - Columns: id, college_id, roll_number, name, email, phone, course_id, hostel_id, room_id, bed_id, status
- `app.parents`: Parent/guardian information
- `app.student_parents`: Student-parent relationships

#### Movement & Attendance
- `app.attendance`: Daily attendance records
- `app.entry_exit`: Entry/exit gate records
- `app.movement_logs`: Detailed movement tracking

#### Requests
- `app.leave_requests`: Leave application workflow
  - Columns: id, student_id, leave_type, from_date, to_date, reason, status, approvals
- `app.gate_passes`: Gate pass issuance and verification
  - Columns: id, student_id, pass_type, from_time, to_time, purpose, status, qr_code

#### Support & Safety
- `app.complaints`: Student complaints and grievances
- `app.complaint_categories`: Complaint categorization
- `app.complaint_updates`: Complaint resolution tracking
- `app.incidents`: Security incident reports
- `app.sos_events`: Emergency SOS alerts

#### Communication
- `app.announcements`: System-wide announcements
- `app.notifications`: User notifications
- `app.notification_recipients`: Notification delivery tracking
- `app.notification_templates`: Reusable notification templates

#### Mess Management
- `app.mess_menus`: Daily meal menus
- `app.mess_feedback`: Student feedback on meals

#### File & Reporting
- `app.files`: File attachment storage metadata
- `app.reports_saved`: Saved report configurations

---

## Domain Models

### 1. Platform Domain

**Entities**: Colleges, Users, Roles, Permissions, Modules, Entitlements, Audit Logs

**Relationships**:
```
colleges (1) ──< (N) users
colleges (1) ──< (N) entitlements (N) ──> (1) modules
users (N) ──< (N) user_roles (N) ──> (1) roles
roles (N) ──< (N) role_permissions (N) ──> (1) permissions
```

**Business Rules**:
- Each college is an independent tenant
- Users can have different roles in different colleges
- Entitlements control feature access per college
- All platform operations are audited

### 2. Academic Domain

**Entities**: Colleges, Courses, Departments, Semesters, Academic Years

**Relationships**:
```
colleges (1) ──< (N) departments
colleges (1) ──< (N) courses
colleges (1) ──< (N) semesters
colleges (1) ──< (N) academic_years
```

**Business Rules**:
- Academic structure is tenant-specific
- Courses belong to departments
- Semesters align with academic years

### 3. Hostel Domain

**Entities**: Hostels, Buildings, Blocks, Floors, Rooms, Beds

**Relationships**:
```
colleges (1) ──< (N) hostels
hostels (1) ──< (N) buildings
buildings (1) ──< (N) blocks
blocks (1) ──< (N) floors
floors (1) ──< (N) rooms
rooms (1) ──< (N) beds
```

**Business Rules**:
- Hierarchical structure: Hostel → Building → Block → Floor → Room → Bed
- Each bed can be allocated to one student at a time
- Rooms have capacity constraints
- Gender segregation at hostel/block level

### 4. People Domain

**Entities**: Students, Parents, Users

**Relationships**:
```
colleges (1) ──< (N) students
students (N) ──< (N) student_parents (N) ──> (1) parents
students (N) ──> (1) courses
students (N) ──> (1) rooms
students (N) ──> (1) beds
```

**Business Rules**:
- Students are assigned to courses and rooms
- Each student can have multiple parents/guardians
- Student status tracks lifecycle (active, graduated, suspended)

### 5. Movement Domain

**Entities**: Attendance, Entry/Exit Records, Movement Logs

**Relationships**:
```
students (1) ──< (N) attendance
students (1) ──< (N) entry_exit
students (1) ──< (N) movement_logs
```

**Business Rules**:
- Attendance tracked daily
- Entry/exit records capture gate movements
- Movement logs provide audit trail

### 6. Requests Domain

**Entities**: Leave Requests, Gate Passes

**Relationships**:
```
students (1) ──< (N) leave_requests
students (1) ──< (N) gate_passes
```

**Business Rules**:
- Leave requests require approval workflow
- Gate passes have time validity
- QR codes generated for gate pass verification
- Status transitions: pending → approved/rejected

### 7. Support Domain

**Entities**: Complaints, Incidents, SOS Events

**Relationships**:
```
students (1) ──< (N) complaints
students (1) ──< (N) incidents
students (1) ──< (N) sos_events
complaints (1) ──< (N) complaint_updates
```

**Business Rules**:
- Complaints categorized and tracked through resolution
- Incidents logged by security personnel
- SOS events trigger emergency response

### 8. Communication Domain

**Entities**: Announcements, Notifications

**Relationships**:
```
users (1) ──< (N) announcements
users (N) ──< (N) notification_recipients (N) ──> (1) notifications
```

**Business Rules**:
- Announcements broadcast to groups
- Notifications targeted to individuals
- Delivery status tracked per recipient

### 9. Mess Domain

**Entities**: Mess Menus, Mess Feedback

**Relationships**:
```
hostels (1) ──< (N) mess_menus
students (1) ──< (N) mess_feedback
```

**Business Rules**:
- Daily menus per hostel
- Students provide meal feedback

### 10. File Management Domain

**Entities**: Files, Reports

**Relationships**:
```
[polymorphic] entity ──< (N) files
users (1) ──< (N) reports_saved
```

**Business Rules**:
- Files attached to various entities (complaints, incidents, etc.)
- Reports saved for quick access

### 11. Super Admin Domain

**Entities**: Approval Policies, Approval Requests

**Relationships**:
```
colleges (1) ──< (N) approval_policies
approval_policies (1) ──< (N) approval_requests
```

**Business Rules**:
- Configurable approval workflows
- Multi-level approval support

---

## Multi-Tenancy Design

### Tenant Isolation Strategy

**Schema-Based Multi-Tenancy**:
- Platform schema: Shared system data
- App schema: Tenant-specific data with `college_id` discriminator

### Tenant Context Enforcement

**Required Functions**:
```sql
-- Must be set before any app schema queries
SELECT set_config('app.current_tenant_id', '<college_id>', false);

-- Utility functions
app.current_tenant_id() → Returns current tenant ID from session context
app.has_tenant_context() → Validates tenant context is set
```

**Usage Pattern**:
```sql
-- Set tenant context (typically done by application middleware)
SELECT set_config('app.current_tenant_id', '123e4567-e89b-12d3-a456-426614174000', false);

-- All subsequent queries automatically filtered by RLS
SELECT * FROM app.students; -- Only returns students for tenant 123e4567...
```

### RLS Enforcement

All app schema tables have RLS policies that enforce:
```sql
USING (college_id = app.current_tenant_id()::uuid)
```

This ensures:
- No cross-tenant data leakage
- Automatic query filtering
- Application-transparent security

### Cross-Tenant Operations

For operations requiring cross-tenant visibility (super admin, reporting):
- Use platform schema tables
- Explicit college_id filtering in queries
- Elevated permissions required

---

## Security Model

### Authentication

**User Accounts**: Stored in `platform.users`
- Password hashing: bcrypt via pgcrypto extension
- Email uniqueness enforced with citext (case-insensitive)
- Login events tracked in `platform.login_events`

### Authorization

**Role-Based Access Control (RBAC)**:

**System Roles** (defined in `platform.roles`):
- `SUPER_ADMIN`: Cross-tenant system administration
- `ADMIN`: College-level administration
- `HOSTEL_INCHARGE`: Hostel management
- `WARDEN`: Hostel supervision
- `SECURITY`: Security operations
- `MESS_MANAGER`: Mess operations
- `STUDENT`: Student portal access
- `PARENT`: Parent portal access

**Permissions** (defined in `platform.permissions`):
- Granular access rights (e.g., `students.read`, `leave.approve`, `incidents.create`)
- Mapped to roles via `platform.role_permissions`
- Enforced at application layer

**User-Role Assignment**:
- Users assigned roles per college via `platform.user_roles`
- Same user can have different roles in different colleges
- Tenant context determines active role

### Audit Logging

**Comprehensive Audit Trail** (`platform.audit_logs`):
- Captures: user, action, entity type, entity ID, changes (JSONB)
- Includes: IP address, timestamp, tenant context
- Immutable records for compliance

**Logged Actions**:
- CREATE, UPDATE, DELETE operations
- Status changes (approvals, rejections)
- Sensitive data access

---

## Row-Level Security (RLS)

### RLS Implementation

**Enabled on ALL app schema tables**:
```sql
ALTER TABLE app.<table_name> ENABLE ROW LEVEL SECURITY;
```

**Standard Policy Pattern**:
```sql
CREATE POLICY tenant_isolation ON app.<table_name>
  USING (college_id = app.current_tenant_id()::uuid);
```

### RLS-Protected Tables

All tables in app schema including:
- app.students
- app.hostels
- app.rooms
- app.beds
- app.attendance
- app.leave_requests
- app.gate_passes
- app.complaints
- app.incidents
- app.sos_events
- app.announcements
- app.notifications
- ... (all tenant-specific tables)

### RLS Bypass

**When RLS is bypassed**:
- Super admin operations (with explicit security context)
- Background jobs (with service account and explicit tenant context)
- System maintenance (DBA access)

**Never bypassed**:
- Regular application queries
- User-initiated operations
- API calls

---

## Indexes

### Index Strategy

Indexes are defined in `901_indexes.sql` and cover:

**Primary Indexes**:
- Primary keys (automatically indexed)
- Unique constraints (automatically indexed)

**Foreign Key Indexes**:
- All foreign key columns for JOIN performance
- Example: `idx_students_college_id ON app.students(college_id)`

**Query Optimization Indexes**:
- Frequently filtered columns: status, dates, types
- Composite indexes for common query patterns
- Example: `idx_attendance_student_date ON app.attendance(student_id, date)`

**Tenant Isolation Indexes**:
- college_id on all app schema tables
- Supports RLS policy enforcement

**Search Indexes**:
- Text search on name, email, roll_number fields
- Example: `idx_students_roll_number ON app.students(roll_number)`

### Index Maintenance

**Monitoring**:
- Check index usage: `pg_stat_user_indexes`
- Identify unused indexes for removal
- Monitor index bloat

**Rebuilding**:
```sql
REINDEX TABLE app.students;
```

---

## Views

### Materialized Views

Defined in `902_views.sql`, materialized views provide:

**Purpose**:
- Optimized read performance for complex reporting
- Pre-aggregated data for dashboards
- Reduced query complexity

**Expected Views** (9+):
1. Student occupancy summary
2. Room availability by hostel
3. Attendance statistics
4. Leave request summaries
5. Gate pass analytics
6. Complaint resolution metrics
7. Movement pattern analysis
8. Mess feedback aggregates
9. SOS event history

**Refresh Strategy**:
```sql
-- Manual refresh
REFRESH MATERIALIZED VIEW app.view_name;

-- Concurrent refresh (non-blocking)
REFRESH MATERIALIZED VIEW CONCURRENTLY app.view_name;
```

**Refresh Schedule**:
- Real-time data: Direct table queries
- Hourly reports: Scheduled refresh
- Daily reports: Nightly refresh
- Historical analysis: Weekly refresh

---

## Functions

### Core Functions

**Tenant Context Functions** (defined in migrations):

```sql
-- Get current tenant ID from session variable
app.current_tenant_id() RETURNS uuid

-- Check if tenant context is set
app.has_tenant_context() RETURNS boolean

-- Generate UUID (platform-wide)
platform.generate_uuid() RETURNS uuid
```

### Business Logic Functions

Functions are organized by domain in the `functions/` folder structure:

**Audit Functions** (`functions/audit/`):
- Audit trail generation
- Change tracking helpers

**Authentication Functions** (`functions/authentication/`):
- Password validation
- Session management

**Authorization Functions** (`functions/authorization/`):
- Permission checking
- Role validation
- Entitlement verification

**Tenant Functions** (`functions/tenant/`):
- Tenant context management
- Cross-tenant operations (super admin)

**Hostel Functions** (`functions/hostel/`):
- Room allocation logic
- Bed assignment
- Occupancy calculations

**Student Functions** (`functions/student/`):
- Student lifecycle management
- Status transitions

**Attendance Functions** (`functions/attendance/`):
- Attendance marking
- Attendance statistics

**Movement Functions** (`functions/movement/`):
- Entry/exit processing
- Movement validation

**Leave Functions** (`functions/leave/`):
- Leave request validation
- Approval workflow

**Gate Pass Functions** (`functions/gate_pass/`):
- QR code generation
- Pass verification

**Complaint Functions** (`functions/complaints/`):
- Complaint categorization
- Resolution tracking

**Security Functions** (`functions/security/`):
- SOS alert processing
- Incident reporting

**Notification Functions** (`functions/notifications/`):
- Notification dispatch
- Template rendering

**Mess Functions** (`functions/mess/`):
- Menu management
- Feedback aggregation

**Report Functions** (`functions/reports/`):
- Report generation
- Data export

---

## Triggers

### Trigger Strategy

Triggers are organized by domain in the `triggers/` folder structure:

**Audit Triggers** (`triggers/audit/`):
- Automatic audit log creation on INSERT/UPDATE/DELETE
- Change tracking for sensitive tables

**Timestamp Triggers** (`triggers/timestamps/`):
- Auto-update `updated_at` on every UPDATE
- Applied to all tables with timestamp columns

**Tenant Consistency Triggers** (`triggers/tenant/`):
- Validate college_id consistency across related tables
- Prevent orphaned records

**User Triggers** (`triggers/users/`):
- Password policy enforcement
- Email validation

**Student Triggers** (`triggers/students/`):
- Enrollment validation
- Status change notifications

**Hostel Triggers** (`triggers/hostel/`):
- Room capacity enforcement
- Bed allocation validation

**Attendance Triggers** (`triggers/attendance/`):
- Duplicate attendance prevention
- Absence notification

**Movement Triggers** (`triggers/movement/`):
- Entry/exit pairing
- Unauthorized movement alerts

**Request Triggers** (`triggers/requests/`):
- Leave overlap prevention
- Gate pass expiry checking

**Notification Triggers** (`triggers/notifications/`):
- Auto-notification on status changes
- Recipient list generation

**Security Triggers** (`triggers/security/`):
- SOS alert propagation
- Incident escalation

### Trigger Best Practices

- Keep trigger logic minimal (delegate to functions)
- Avoid cascading triggers
- Use BEFORE triggers for validation, AFTER for logging
- Test trigger performance impact

---

## Seed Data

### Seed Organization

Seed data is environment-specific and located in `seeds/`:

**Development Seeds** (`seeds/development/`):
- Comprehensive test data
- Multiple sample colleges
- Sample users, students, hostels
- Historical data for testing

**Testing Seeds** (`seeds/testing/`):
- Minimal test data
- Known data sets for automated tests
- Edge cases and boundary conditions

**Production Seeds** (`seeds/production/`):
- System essentials only
- Roles and permissions
- Modules and entitlement templates
- NO customer data

### Seed Execution Order

**Development/Testing**:
1. `001_roles.sql` - System roles
2. `002_permissions.sql` - Granular permissions
3. `003_modules.sql` - Feature modules
4. `004_college.sql` - Sample college(s)
5. `005_users.sql` - Sample users
6. `006_academic.sql` - Courses, departments
7. `007_hostel.sql` - Hostel infrastructure
8. `008_students.sql` - Sample students

**Production**:
1. `001_roles.sql` - System roles
2. `002_permissions.sql` - Granular permissions
3. `003_modules.sql` - Feature modules
4. `004_entitlements.sql` - Entitlement templates

### Seed Data in Migrations

The `903_seed.sql` migration contains:
- Essential system data (roles, permissions, modules)
- Executed as part of initial database setup
- Idempotent (safe to re-run)

---

## Validation

### Validation Script

**Location**: `DATABASE/validate.sql`

**Purpose**: Automated validation of database integrity

**Validation Checks**:
1. **Schema Existence**: platform, app schemas present
2. **Extension Verification**: pgcrypto, citext installed
3. **Table Count**: 68+ tables created
4. **View Count**: 9+ materialized views
5. **Function Existence**: Required utility functions
6. **RLS Status**: RLS enabled on app schema tables
7. **Foreign Key Integrity**: All FKs valid
8. **Index Presence**: Critical indexes exist
9. **Seed Data**: Minimum seed records present
   - 11+ modules
   - 9+ roles
   - 22+ permissions
   - 2+ entitlement templates

**Execution**:
```bash
psql -h localhost -U postgres -d hms -f DATABASE/validate.sql
```

**Expected Output**:
- All checks should return `PASS`
- Any `FAIL` indicates missing or misconfigured components

**Usage Scenarios**:
- After initial database setup
- After migration execution
- Before deployment to production
- Periodic health checks

---

## Setup Instructions

### Prerequisites

- PostgreSQL 14 or higher
- Superuser or database owner privileges
- psql command-line tool (or GUI tool like pgAdmin)

### Initial Setup

**Step 1: Create Database**
```sql
CREATE DATABASE hms;
```

**Step 2: Connect to Database**
```bash
psql -h localhost -U postgres -d hms
```

**Step 3: Execute Migrations Sequentially**

**Extension Setup**:
```bash
psql -h localhost -U postgres -d hms -f DATABASE/migrations/000_extensions.sql
```

**Core Migrations** (in order):
```bash
psql -h localhost -U postgres -d hms -f DATABASE/migrations/001_platform.sql
psql -h localhost -U postgres -d hms -f DATABASE/migrations/002_academic.sql
psql -h localhost -U postgres -d hms -f DATABASE/migrations/003_hostel.sql
psql -h localhost -U postgres -d hms -f DATABASE/migrations/004_people.sql
psql -h localhost -U postgres -d hms -f DATABASE/migrations/005_movement.sql
psql -h localhost -U postgres -d hms -f DATABASE/migrations/006_requests.sql
psql -h localhost -U postgres -d hms -f DATABASE/migrations/007_support.sql
psql -h localhost -U postgres -d hms -f DATABASE/migrations/008_communication.sql
psql -h localhost -U postgres -d hms -f DATABASE/migrations/009_meals_resources.sql
psql -h localhost -U postgres -d hms -f DATABASE/migrations/010_super_admin_platform.sql
```

**Security, Indexes, Views** (in order):
```bash
psql -h localhost -U postgres -d hms -f DATABASE/migrations/900_security.sql
psql -h localhost -U postgres -d hms -f DATABASE/migrations/901_indexes.sql
psql -h localhost -U postgres -d hms -f DATABASE/migrations/902_views.sql
```

**Seed Data**:
```bash
psql -h localhost -U postgres -d hms -f DATABASE/migrations/903_seed.sql
```

**Step 4: Validate Setup**
```bash
psql -h localhost -U postgres -d hms -f DATABASE/validate.sql
```

### Environment-Specific Seeds

**For Development**:
```bash
for file in DATABASE/seeds/development/*.sql; do
  psql -h localhost -U postgres -d hms -f "$file"
done
```

**For Testing**:
```bash
for file in DATABASE/seeds/testing/*.sql; do
  psql -h localhost -U postgres -d hms -f "$file"
done
```

**For Production** (already included in 903_seed.sql):
```bash
# Production seeds are minimal and included in migrations
# No additional seed execution required
```

---

## Migration Execution

### Migration Best Practices

1. **Always execute migrations in order** (000 → 001 → ... → 903)
2. **Never skip migrations** - each builds on previous
3. **Test migrations in development first**
4. **Backup database before running migrations in production**
5. **Use transactions** (migrations should be wrapped in BEGIN/COMMIT)
6. **Validate after execution** using validate.sql

### Migration Rollback

**Important**: Migrations are designed to be forward-only. Rollback requires:

1. **Database restore from backup**
2. **Manual reversal of changes** (if backup not available)
3. **Data loss possible** - always backup first

**Rollback Strategy**:
- Development: Drop and recreate database
- Testing: Restore from pre-migration backup
- Production: Restore from backup + replay transactions

### Adding New Migrations

**Naming Convention**:
- Use sequential numbering: `011_new_feature.sql`
- Domain-specific: `011_visitor_management.sql`
- Security/Optimization: `904_additional_indexes.sql`

**Migration Template**:
```sql
-- Migration: 011_visitor_management.sql
-- Description: Add visitor tracking and management
-- Author: Your Name
-- Date: 2026-10-05

BEGIN;

-- Table creation
CREATE TABLE app.visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID NOT NULL REFERENCES app.colleges(id) ON DELETE CASCADE,
  -- ... other columns
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_visitors_college_id ON app.visitors(college_id);

-- RLS
ALTER TABLE app.visitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.visitors
  USING (college_id = app.current_tenant_id()::uuid);

-- Audit logging trigger
-- (implement trigger logic)

COMMIT;
```

---

## Troubleshooting

### Common Issues

#### 1. RLS Policy Violations

**Symptom**: Queries return 0 rows unexpectedly

**Cause**: Tenant context not set

**Solution**:
```sql
-- Check current tenant context
SHOW app.current_tenant_id;

-- Set tenant context
SELECT set_config('app.current_tenant_id', '<college_id>', false);
```

#### 2. Foreign Key Violations

**Symptom**: INSERT/UPDATE fails with FK constraint error

**Cause**: Referenced record doesn't exist or belongs to different tenant

**Solution**:
- Verify referenced record exists
- Check tenant consistency across related tables
- Ensure college_id matches in all related records

#### 3. Permission Denied Errors

**Symptom**: `ERROR: permission denied for table ...`

**Cause**: Database user lacks necessary privileges

**Solution**:
```sql
-- Grant schema usage
GRANT USAGE ON SCHEMA platform, app TO <username>;

-- Grant table access
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO <username>;
GRANT SELECT ON ALL TABLES IN SCHEMA platform TO <username>;
```

#### 4. Function Not Found

**Symptom**: `ERROR: function app.current_tenant_id() does not exist`

**Cause**: Migration not executed or function definition missing

**Solution**:
- Re-run migration that defines the function
- Check function exists: `\df app.*`

#### 5. Slow Queries

**Symptom**: Queries take too long to execute

**Cause**: Missing indexes or inefficient query

**Solution**:
```sql
-- Analyze query plan
EXPLAIN ANALYZE SELECT * FROM app.students WHERE college_id = '...';

-- Check for missing indexes
-- Add indexes to frequently filtered columns
```

#### 6. Seed Data Conflicts

**Symptom**: Duplicate key violations during seed execution

**Cause**: Seeds already executed or IDs conflict

**Solution**:
- Use `INSERT ... ON CONFLICT DO NOTHING`
- Verify seed idempotence
- Clear data before re-seeding (development only)

---

## Performance Optimization

### Query Optimization

**Best Practices**:
1. **Always filter by college_id first** (leverages RLS and indexes)
2. **Use indexes** for frequently queried columns
3. **Avoid SELECT *** - specify required columns
4. **Use LIMIT** for pagination
5. **Use EXISTS** instead of IN for subqueries

**Example**:
```sql
-- Good: Indexed column first
SELECT id, name FROM app.students 
WHERE college_id = '<id>' AND status = 'ACTIVE'
LIMIT 100;

-- Bad: Full table scan
SELECT * FROM app.students WHERE email LIKE '%@gmail.com';
```

### Index Optimization

**Monitor Index Usage**:
```sql
SELECT 
  schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname IN ('platform', 'app')
ORDER BY idx_scan ASC;
```

**Remove Unused Indexes**:
- Indexes with 0 idx_scan can be dropped
- Monitor for 1-2 weeks before removal

**Add Missing Indexes**:
```sql
-- Identify slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Connection Pooling

**Recommended**: Use connection pooler (PgBouncer, pgpool-II)

**Configuration**:
- Pool size: 10-20 connections per application instance
- Max connections: Based on `max_connections` setting
- Pool mode: Transaction pooling (optimal for RLS)

### Materialized View Refresh

**Scheduling**:
```sql
-- Create refresh function
CREATE OR REPLACE FUNCTION refresh_all_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY app.view_occupancy_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY app.view_attendance_stats;
  -- ... other views
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron or external scheduler
```

### Partitioning (Future Enhancement)

**Candidate Tables**:
- `platform.audit_logs` (by date)
- `app.movement_logs` (by date)
- `app.attendance` (by date)

**Implementation**:
```sql
-- Example: Partition audit_logs by month
CREATE TABLE platform.audit_logs_2026_10 PARTITION OF platform.audit_logs
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
```

---

## Backup and Recovery

### Backup Strategy

**Full Backup** (Daily):
```bash
pg_dump -h localhost -U postgres -Fc -f hms_backup_$(date +%Y%m%d).dump hms
```

**Schema-Only Backup**:
```bash
pg_dump -h localhost -U postgres -s -f hms_schema.sql hms
```

**Data-Only Backup**:
```bash
pg_dump -h localhost -U postgres -a -f hms_data.sql hms
```

**Tenant-Specific Backup**:
```sql
-- Export single tenant data
COPY (
  SELECT * FROM app.students WHERE college_id = '<id>'
) TO '/path/to/tenant_students.csv' CSV HEADER;
```

### Restore Procedures

**Full Restore**:
```bash
pg_restore -h localhost -U postgres -d hms_restored -v hms_backup_20261005.dump
```

**Schema Restore**:
```bash
psql -h localhost -U postgres -d hms_new -f hms_schema.sql
```

**Point-in-Time Recovery (PITR)**:
- Requires WAL archiving enabled
- Restore base backup + replay WAL logs
- See PostgreSQL documentation for detailed setup

### Backup Retention

**Recommended Policy**:
- Daily backups: 7 days
- Weekly backups: 4 weeks
- Monthly backups: 12 months
- Yearly backups: 7 years (compliance)

---

## Development Guidelines

### Coding Standards

**SQL Style Guide**:
- Use UPPERCASE for SQL keywords
- Use snake_case for identifiers
- Indent nested queries
- Comment complex logic

**Example**:
```sql
-- Good
CREATE TABLE app.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID NOT NULL REFERENCES app.colleges(id),
  roll_number VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Bad
create table app.Students(ID uuid primary key default gen_random_uuid(),CollegeID uuid not null references app.Colleges(ID),RollNumber varchar(50) not null,Name varchar(255) not null,CreatedAt timestamp not null default current_timestamp);
```

### Naming Conventions

**Tables**: 
- Plural nouns: `students`, `hostels`, `leave_requests`
- Avoid abbreviations: `applications` not `apps`

**Columns**:
- Descriptive names: `first_name` not `fname`
- Boolean prefix: `is_active`, `has_access`
- Foreign keys: `<table>_id` (e.g., `college_id`, `student_id`)

**Indexes**:
- `idx_<table>_<column(s)>`: `idx_students_college_id`

**Constraints**:
- Primary key: `pk_<table>`
- Foreign key: `fk_<table>_<referenced_table>`
- Check: `chk_<table>_<condition>`
- Unique: `uq_<table>_<column(s)>`

### Testing

**Unit Tests**:
- Test functions in isolation
- Use pgTAP framework (recommended)

**Integration Tests**:
- Test cross-table operations
- Validate FK constraints
- Test RLS policies

**Performance Tests**:
- Load test with realistic data volumes
- Monitor query execution times
- Validate index effectiveness

---

## Testing Strategy

### Test Environments

**Development Database**:
- Full seed data
- Frequent schema changes
- No backup requirements

**Testing Database**:
- Known test data sets
- Automated test execution
- Reset between test runs

**Staging Database**:
- Production-like data (anonymized)
- Pre-deployment validation
- Performance testing

**Production Database**:
- Live customer data
- Strict change control
- Comprehensive backups

### Test Data Management

**Test Seeds**: Use `seeds/testing/` for consistent test data

**Data Anonymization**:
```sql
-- Anonymize student emails for staging
UPDATE app.students 
SET email = 'student_' || id || '@test.com',
    phone = '1234567890';
```

**Test Isolation**:
- Each test should create and clean up its own data
- Use transactions with ROLLBACK for read-only tests

### Automated Testing

**CI/CD Integration**:
```bash
# Example test script
#!/bin/bash
set -e

# Setup test database
createdb hms_test
psql -d hms_test -f DATABASE/migrations/*.sql

# Run validation
psql -d hms_test -f DATABASE/validate.sql

# Run test suite
psql -d hms_test -f DATABASE/tests/*.sql

# Cleanup
dropdb hms_test
```

---

## API Integration

### Database Connection

**Connection String Format**:
```
postgresql://username:password@host:port/database?sslmode=require
```

**Environment Variables**:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hms
DB_USER=hms_app
DB_PASSWORD=<secure_password>
DB_SSL_MODE=require
DB_MAX_CONNECTIONS=20
```

### Tenant Context Middleware

**Required**: Set tenant context before every request

**Example (Go)**:
```go
func TenantMiddleware(next http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    collegeID := extractTenantFromRequest(r) // From JWT, header, subdomain
    
    // Set tenant context in database session
    _, err := db.Exec("SELECT set_config('app.current_tenant_id', $1, false)", collegeID)
    if err != nil {
      http.Error(w, "Failed to set tenant context", 500)
      return
    }
    
    next.ServeHTTP(w, r)
  })
}
```

**Example (Node.js)**:
```javascript
async function setTenantContext(client, collegeId) {
  await client.query(
    "SELECT set_config('app.current_tenant_id', $1, false)", 
    [collegeId]
  );
}
```

### Transaction Management

**Best Practices**:
- Use transactions for multi-table operations
- Set tenant context within transaction
- Handle errors with ROLLBACK

**Example**:
```sql
BEGIN;

-- Set tenant context
SELECT set_config('app.current_tenant_id', '<college_id>', false);

-- Multiple operations
INSERT INTO app.leave_requests (...) VALUES (...);
INSERT INTO app.notifications (...) VALUES (...);
UPDATE app.students SET ... WHERE id = ...;

COMMIT;
```

---

## Monitoring

### Database Health Metrics

**Key Metrics**:
1. **Connection Count**: Current vs max
2. **Query Performance**: Slow query log
3. **Cache Hit Ratio**: Should be >95%
4. **Transaction Rate**: TPS (transactions per second)
5. **Lock Contention**: Blocking queries
6. **Replication Lag**: For replicas
7. **Disk Usage**: Table and index sizes
8. **Index Usage**: Unused indexes

### Monitoring Queries

**Active Connections**:
```sql
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';
```

**Slow Queries**:
```sql
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000 -- queries over 1 second
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Cache Hit Ratio**:
```sql
SELECT 
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit) as heap_hit,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
FROM pg_statio_user_tables;
```

**Table Sizes**:
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname IN ('platform', 'app')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

**Blocking Queries**:
```sql
SELECT
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

### Alerting Thresholds

**Recommended Alerts**:
- Connection count > 80% of max
- Slow query > 5 seconds
- Cache hit ratio < 90%
- Replication lag > 1 minute
- Disk usage > 80%
- Failed connection attempts spike

---

## Security Best Practices

### Database User Management

**Principle of Least Privilege**:

**Application User** (`hms_app`):
```sql
CREATE ROLE hms_app WITH LOGIN PASSWORD '<secure_password>';
GRANT USAGE ON SCHEMA platform, app TO hms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO hms_app;
GRANT SELECT ON ALL TABLES IN SCHEMA platform TO hms_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA platform, app TO hms_app;
```

**Read-Only User** (`hms_readonly`):
```sql
CREATE ROLE hms_readonly WITH LOGIN PASSWORD '<secure_password>';
GRANT USAGE ON SCHEMA platform, app TO hms_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA platform, app TO hms_readonly;
```

**Admin User** (`hms_admin`):
```sql
CREATE ROLE hms_admin WITH LOGIN PASSWORD '<secure_password>';
GRANT ALL PRIVILEGES ON SCHEMA platform, app TO hms_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA platform, app TO hms_admin;
```

### Password Policies

**Requirements**:
- Minimum 12 characters
- Complexity: uppercase, lowercase, numbers, symbols
- No password reuse (last 5 passwords)
- Rotation: Every 90 days
- Account lockout after 5 failed attempts

### SSL/TLS Configuration

**Enforce SSL Connections**:
```sql
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET ssl_cert_file = '/path/to/server.crt';
ALTER SYSTEM SET ssl_key_file = '/path/to/server.key';
```

**Client Connection**:
```
postgresql://user:pass@host:port/db?sslmode=require
```

### Sensitive Data Protection

**Encrypted Storage**:
- Passwords: bcrypt hashing via pgcrypto
- PII: Consider column-level encryption for highly sensitive data

**Access Logging**:
```sql
ALTER SYSTEM SET log_statement = 'mod'; -- Log all modifications
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
```

### Vulnerability Management

**Regular Updates**:
- Keep PostgreSQL patched
- Monitor security advisories
- Test updates in staging first

**SQL Injection Prevention**:
- Use parameterized queries (prepared statements)
- Never concatenate user input into SQL
- Validate all inputs at application layer

---

## Data Retention

### Retention Policies

**Audit Logs**:
- Retain: 7 years (compliance requirement)
- Archive: After 1 year to cold storage
- Partitioning: By month for performance

**Movement Logs**:
- Retain: 2 years
- Archive: After 6 months
- Partitioning: By month

**Notifications**:
- Retain: 90 days
- Soft delete: Mark as archived
- Hard delete: After 1 year

**Complaints/Incidents**:
- Retain: Indefinitely (legal requirement)
- Archive: After case closure + 1 year

### Archival Process

**Archive Strategy**:
```sql
-- Example: Archive old audit logs
INSERT INTO platform.audit_logs_archive
SELECT * FROM platform.audit_logs
WHERE created_at < CURRENT_DATE - INTERVAL '1 year';

DELETE FROM platform.audit_logs
WHERE created_at < CURRENT_DATE - INTERVAL '1 year';
```

**Archive Storage**:
- Use separate tablespace or database
- Compress archived data
- Maintain separate backups

### Data Purging

**Automated Purging** (scheduled job):
```sql
-- Example: Purge old notifications
DELETE FROM app.notifications
WHERE created_at < CURRENT_DATE - INTERVAL '90 days'
  AND archived = true;
```

---

## Compliance

### GDPR Compliance

**Right to Access**:
- Students/parents can request their data
- Export in machine-readable format (JSON/CSV)

**Right to Erasure**:
- Soft delete (mark as deleted, anonymize PII)
- Hard delete (purge after retention period)
- Audit log retention exemption (legal basis)

**Data Minimization**:
- Only collect necessary data
- Regular reviews of data collection practices

**Consent Management**:
- Track consent for data processing
- Allow withdrawal of consent

### Educational Data Privacy

**FERPA Compliance** (US):
- Restrict access to education records
- Audit access to student data
- Parental access controls

**COPPA Compliance** (US):
- Parental consent for minors
- No marketing to minors
- Data security measures

### Audit Trail Requirements

**Compliance-Ready Logging**:
- Who: User ID
- What: Action performed
- When: Timestamp
- Where: IP address
- Why: Business context (optional)

**Immutable Logs**:
- Audit logs cannot be modified or deleted
- Use append-only tables
- Consider blockchain/WORM storage for critical logs

---

## Change Management

### Schema Change Process

**Development**:
1. Create migration file
2. Test in development database
3. Peer review
4. Document changes

**Staging**:
1. Deploy to staging
2. Run validation script
3. Perform integration tests
4. Performance testing

**Production**:
1. Schedule maintenance window
2. Backup database
3. Execute migration
4. Run validation
5. Monitor for issues
6. Rollback plan ready

### Change Approval

**Low-Risk Changes** (auto-approved):
- New indexes
- New views
- New functions (non-breaking)

**Medium-Risk Changes** (manager approval):
- New tables
- New columns (nullable)
- Trigger modifications

**High-Risk Changes** (stakeholder approval):
- Column removal/rename
- Table removal
- FK constraint changes
- RLS policy changes

### Rollback Procedures

**Immediate Rollback** (within maintenance window):
- Restore from pre-migration backup
- Apply any post-migration transactions manually

**Delayed Rollback** (discovered later):
- Create reverse migration
- Test thoroughly
- Schedule separate maintenance window

---

## Disaster Recovery

### RTO and RPO Targets

**Recovery Time Objective (RTO)**: 4 hours
- Time to restore service after disaster

**Recovery Point Objective (RPO)**: 15 minutes
- Maximum acceptable data loss

### DR Strategy

**Active-Passive Replication**:
- Primary database: Active
- Standby database: Passive (streaming replication)
- Automatic failover with Patroni/Repmgr

**Backup Strategy**:
- Continuous WAL archiving
- Daily full backups
- Offsite backup storage (different region)

### Failover Procedures

**Automatic Failover**:
- Standby promotion to primary
- Application connection string update
- DNS update (if applicable)

**Manual Failover**:
```bash
# Promote standby to primary
pg_ctl promote -D /var/lib/postgresql/data

# Update application configuration
# Restart application servers
```

### DR Testing

**Quarterly DR Drills**:
- Simulate database failure
- Practice failover procedures
- Validate backup restoration
- Document lessons learned

---

## Known Issues

### Issue 1: File Content Mismatch

**Description**: `005_movement.sql` contains wrong content (not movement-related tables)

**Impact**: Movement tables may not be created as expected

**Status**: Documented in audit (not fixed per user requirement)

**Workaround**: Verify actual table structure in TEST database before relying on migration file names

### Issue 2: Missing Table Definitions

**Description**: `app.files` and `app.reports_saved` tables referenced but not found in migrations

**Impact**: May cause FK violations or application errors if tables don't exist

**Status**: Tables exist in TEST database but definitions not in migration files

**Workaround**: Manually verify table existence in target database

### Issue 3: Foreign Key Reference Errors

**Description**: `008_communication.sql` references incorrect column names
- `platform.colleges(id)` should be `college_id`
- `app.users(id)` should be `user_id`

**Impact**: FK constraint failures if column names are incorrect

**Status**: Documented (not fixed per user requirement)

**Workaround**: Verify actual column names in TEST database

### Issue 4: Empty Organization Folders

**Description**: Functions, triggers, views, indexes, RLS, and seeds folders are empty

**Impact**: None - definitions are in migration files

**Status**: By design - all objects defined in migrations for atomic execution

**Workaround**: None needed - this is the intended structure

---

## FAQ

### Q1: Why are the organization folders (functions/, triggers/, etc.) empty?

**A**: All database objects are currently defined within the migration files for atomic execution and maintainability. The folder structure is prepared for future modular organization as the database grows.

### Q2: How do I add a new tenant (college)?

**A**: 
```sql
-- Insert into platform.colleges
INSERT INTO platform.colleges (name, code, type, status, subscription_tier)
VALUES ('New College', 'NC001', 'ENGINEERING', 'ACTIVE', 'PREMIUM');

-- Set up entitlements for the college
INSERT INTO platform.entitlements (college_id, module_id, enabled)
SELECT '<college_id>', id, true FROM platform.modules;
```

### Q3: How do I reset a tenant's data for testing?

**A**:
```sql
-- CAUTION: This deletes all data for a tenant
BEGIN;
SELECT set_config('app.current_tenant_id', '<college_id>', false);
DELETE FROM app.students WHERE college_id = '<college_id>';
-- Delete from other tables as needed
COMMIT;
```

### Q4: Can I disable RLS for performance testing?

**A**: Yes, but ONLY in non-production environments:
```sql
ALTER TABLE app.students DISABLE ROW LEVEL SECURITY;
-- Run tests
ALTER TABLE app.students ENABLE ROW LEVEL SECURITY;
```

### Q5: How do I add a new permission?

**A**:
```sql
INSERT INTO platform.permissions (code, name, description, resource, action)
VALUES ('students.export', 'Export Students', 'Export student data', 'students', 'export');

-- Assign to role
INSERT INTO platform.role_permissions (role_id, permission_id)
VALUES ('<role_id>', '<permission_id>');
```

### Q6: What's the difference between platform and app schemas?

**A**:
- **platform**: System-wide data shared across all tenants (users, roles, configurations)
- **app**: Tenant-specific operational data (students, hostels, attendance)

### Q7: How are passwords stored?

**A**: Passwords are hashed using bcrypt via the pgcrypto extension. Never stored in plaintext.

### Q8: Can I add custom fields to existing tables?

**A**: Yes, create a new migration:
```sql
-- 011_custom_fields.sql
ALTER TABLE app.students ADD COLUMN custom_field VARCHAR(255);
```

### Q9: How do I refresh materialized views?

**A**:
```sql
-- Non-concurrent (locks table)
REFRESH MATERIALIZED VIEW app.view_name;

-- Concurrent (no lock, requires unique index)
REFRESH MATERIALIZED VIEW CONCURRENTLY app.view_name;
```

### Q10: What's the maximum number of tenants supported?

**A**: The architecture supports thousands of tenants. Practical limit depends on:
- Data volume per tenant
- Query patterns
- Hardware resources
- Connection pooling configuration

---

## Glossary

**Tenant**: An independent organization (college) using the HMS system

**RLS (Row-Level Security)**: PostgreSQL feature for automatic data filtering

**Entitlement**: Feature module access granted to a tenant

**Module**: A distinct feature area (attendance, leave, gate pass, etc.)

**Platform Schema**: Schema containing system-wide shared data

**App Schema**: Schema containing tenant-specific operational data

**Tenant Context**: Session variable identifying the current tenant for RLS

**Audit Log**: Immutable record of database operations for compliance

**Materialized View**: Pre-computed view stored as a table for performance

**Seed Data**: Initial data required for system operation

**Migration**: SQL script that evolves database schema

**Validation Script**: Automated test to verify database integrity

**RBAC**: Role-Based Access Control

**FK**: Foreign Key constraint

**UUID**: Universally Unique Identifier

**pgcrypto**: PostgreSQL extension for cryptographic functions

**citext**: PostgreSQL extension for case-insensitive text

**JSONB**: Binary JSON data type in PostgreSQL

**Connection Pooling**: Reusing database connections for performance

**Partitioning**: Splitting large tables into smaller physical segments

**WAL**: Write-Ahead Log (transaction log in PostgreSQL)

**PITR**: Point-In-Time Recovery

**RTO**: Recovery Time Objective

**RPO**: Recovery Point Objective

---

## Contributing

### Code Contributions

**Process**:
1. Fork repository (if applicable)
2. Create feature branch
3. Write migration file
4. Add/update documentation
5. Test in development
6. Submit pull request
7. Code review
8. Merge to main

### Migration Guidelines

**Requirements**:
- Migrations must be idempotent (safe to re-run)
- Include comments explaining changes
- Update validation script if needed
- Update this README if structure changes

### Documentation

**When to Update**:
- New tables/schemas added
- New functions/triggers implemented
- Architecture changes
- Security policy changes
- Performance optimizations

**Style Guide**:
- Use clear, concise language
- Include code examples
- Keep formatting consistent
- Update table of contents

---

## License

**Proprietary Software**

Copyright © 2026 HMS Development Team. All Rights Reserved.

This database schema and associated documentation are proprietary and confidential. Unauthorized copying, distribution, or modification is strictly prohibited.

---

## Support

### Internal Support

**Database Team**: database-team@hms.internal  
**DevOps Team**: devops@hms.internal  
**Slack Channel**: #hms-database

### Escalation

**Level 1**: Development team (application issues)  
**Level 2**: Database team (schema/performance issues)  
**Level 3**: Infrastructure team (server/network issues)

### Documentation

**Wiki**: https://wiki.hms.internal/database  
**API Docs**: https://docs.hms.internal/api  
**Runbooks**: https://wiki.hms.internal/runbooks

---

## References

### PostgreSQL Documentation

- [Official PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [pgcrypto Extension](https://www.postgresql.org/docs/current/pgcrypto.html)
- [Performance Tips](https://www.postgresql.org/docs/current/performance-tips.html)

### Multi-Tenancy Patterns

- [Multi-Tenant Data Architecture](https://docs.microsoft.com/en-us/azure/architecture/guide/multitenant/)
- [PostgreSQL Multi-Tenancy](https://www.citusdata.com/blog/2016/10/03/designing-your-saas-database-for-high-scalability/)

### Security Resources

- [OWASP Database Security](https://owasp.org/www-community/vulnerabilities/Improper_Data_Validation)
- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/security.html)

### Related Systems

- **Backend API**: See `BACKEND/README.md`
- **Frontend Application**: See `FRONTEND/README.md`
- **Infrastructure**: See `INFRASTRUCTURE/README.md`

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-10-05 | HMS Database Team | Initial production-grade documentation |

---

**END OF DOCUMENTATION**

*This documentation reflects the current state of the HMS database as manually migrated and tested in the TEST database environment. All documented structures, functions, and procedures are based on existing migration files and validation scripts.*

*No SQL files or database structures were modified during the creation of this documentation.*
