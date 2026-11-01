# College Administrator Portal User Guide
## Operational Manual for Institutional Residence Management

**Target Audience:** College Administrators, Chief Wardens, Hostel In-Charges, and Administrative Staff  
**Portal Address:** `http://localhost:5173` (or your institution's custom domain)  
**Supported Browsers:** Google Chrome (recommended), Microsoft Edge, Mozilla Firefox, Safari  
**Document Version:** 1.0.0  
**Last Updated:** November 1, 2026  

---

## 1. Getting Started

### 1.1 Accessing the Portal
1. Open your browser and navigate to the institutional portal URL (`http://localhost:5173`).
2. You will be greeted by the **Unified Institutional Login** screen.

### 1.2 Logging In
1. In the **Email Address** field, enter your authorized college email address (e.g., `rohith.vinothini07@gmail.com`).
2. In the **Password** field, enter your secure password.
3. Click **Sign In to Portal**.
4. Upon successful validation, the system automatically detects your administrative role (`COLLEGE_ADMIN`) and redirects you to the **College Administration Dashboard** (`/admin/dashboard`).

### 1.3 Logging Out
1. In the top-right header, click on your profile avatar or name.
2. Select **Sign Out** from the dropdown menu.
3. Your secure session will be cleared, and you will be returned to the login screen.

---

## 2. Executive Dashboard Overview

The **Dashboard** (`/admin/dashboard`) is your operational command center. It provides high-level visibility into campus residence health, occupancy statistics, and pending action items.

### 2.1 Key Metrics Cards
- **Total Residents**: Active students currently residing in institutional hostels.
- **Occupancy Rate**: Percentage of residential bed capacity currently allocated.
- **Pending Leaves**: Student outpass and leave applications awaiting administrative decision.
- **Open Complaints**: Active maintenance and facility tickets requiring staff attention.

### 2.2 Quick Action Shortcuts
Use the one-click action buttons on the dashboard to jump directly into common workflows:
- **Enroll Resident**: Opens the student registration form.
- **Assign Bed**: Navigates to the bed allocation engine.
- **Roll-Call**: Opens today's curfew attendance register.
- **Broadcast Notice**: Opens the announcement composer.

---

## 3. Student & Parent Management

### 3.1 Resident Students Directory (`/admin/students`)
- **Searching**: Use the search bar to locate students instantly by **Full Name**, **Roll Number**, or **Email**.
- **Filtering**: Filter by **Department**, **Academic Year**, or **Status** (Active, Inactive, Suspended).
- **Viewing Details**: Click the **View Profile** button on any student row to inspect their contact details, assigned hostel/bed, linked guardians, and leave history.
- **Adding a Student**: Click **Add Student** in the top-right header. Enter their name, roll number, department, email, and phone number, then click **Create Resident**.

### 3.2 Parent & Guardian Directory (`/admin/parents`)
- **Parent Profiles**: View parent names, relationship types (Father, Mother, Local Guardian), and primary contact phone numbers.
- **Linking Guardians**: Click **Link Parent to Student** to associate a guardian with an enrolled resident student for emergency clearance workflows.

---

## 4. Staff, Wardens & Security Management

### 4.1 Staff Directory (`/admin/staff`)
- Manage wardens, assistant wardens, hostel caretakers, and security officers.
- Filter by staff designation and toggle employment status.

### 4.2 Hostel In-Charge Assignments (`/admin/incharges`)
- Assign residential wardens to specific hostels (e.g., Akshaya Boys Hostel, Girls Hostel).
- The system enforces single-primary-warden rules to prevent operational ambiguity.

### 4.3 Security Gate Assignments (`/admin/security-assignments`)
- View registered campus entry/exit gates (e.g., Main Gate, North Hostel Gate).
- Assign security guards to specific gates and operational shift rosters (Morning, Evening, Night).

### 4.4 Password & Credential Security (`/admin/passwords`)
> [!NOTE]
> **Operational Boundary:** Automated self-service staff password resets are handled through platform administrative procedures. The `/admin/passwords` tab provides staff credential status guidelines and emergency access recovery protocols.

---

## 5. Hostel & Space Hierarchy Management

The **Hostels & Blocks** module (`/admin/hostels`) models your physical campus layout:

### 5.1 Hierarchical Structure
```
Hostel Campus (e.g., Akshaya Hostel)
  └── Residential Block (e.g., Block A)
        └── Floor Level (e.g., Floor 1)
              └── Room (e.g., Room 101)
                    └── Bed (e.g., Bed A, Bed B)
```

### 5.2 Capacity & Vacancy Tracking
- Select any hostel from the directory to inspect its blocks and floors.
- Each room card displays its room type (Single, Double, Triple) and total bed capacity.
- Empty beds are highlighted in green (**Vacant**), while occupied beds display resident information in blue (**Occupied**).

---

## 6. Room Allocation Engine

The **Allocations** module (`/admin/allocations`) governs student room assignments.

### 6.1 Creating a New Allocation
1. Click **New Allocation** in the top header.
2. Select the **Student** from the enrolled resident dropdown.
3. Select the target **Hostel**, **Block**, **Room**, and **Vacant Bed**.
4. Enter the **Start Date** and academic session, then click **Allocate Bed**.

### 6.2 Bed Transfers & Vacations
- **Transferring a Resident**: To move a student to another room or bed, click **Transfer** on their allocation row, select the new vacant bed, enter the transfer reason, and confirm.
- **Releasing a Bed**: When a student checks out, click **Release Allocation**, enter checkout remarks, and confirm. The bed is immediately freed for new assignments.

---

## 7. Attendance, Movement & Leave Approvals

### 7.1 Daily Curfew Roll-Call (`/admin/attendance`)
1. Select the **Hostel** and the **Attendance Date** (defaults to today).
2. The resident roll-call table loads all assigned students.
3. Set student statuses individually: **Present**, **Absent**, **Late**, or **On Leave**.
4. Use **Bulk Mark Present** to mark all remaining residents present in a single click.
5. Click **Save Attendance** to persist the roll-call record.

### 7.2 Student Leave Approvals (`/admin/leaves`)
1. View student leave and outpass requests with date ranges, leave types, and reasons.
2. Click **Review Request** on any pending application.
3. Choose **Approve** or **Reject**, enter administrative remarks, and submit.
4. Approved leaves automatically flag the student as "On Leave" during curfew roll-call.

### 7.3 Gate Passes & Movement Clearances (`/admin/gate-passes`)
- Students with **APPROVED** leaves automatically generate an authorized departure gate pass.
- Click **View Pass** to display the printable gate pass containing departure/return times and emergency contacts.
> [!NOTE]
> **Operational Boundary:** Standalone ad-hoc QR pass generation is not supported. All gate departure clearances are derived strictly from verified, approved student leave requests.

---

## 8. Service Desk & Facility Maintenance

### 8.1 Maintenance Tickets (`/admin/complaints`)
- View student repair requests categorized by trade: **Electrical**, **Plumbing**, **Carpentry**, **Cleanliness**, or **General**.
- **Assigning Work Orders**: Click **Assign Staff** to dispatch the ticket to a designated maintenance technician.
- **Updating Status**: Transition tickets from `OPEN` to `IN_PROGRESS` to `RESOLVED` as repairs are completed.

### 8.2 Visitors, Parcels & SOS Guidelines
> [!NOTE]
> **Operational Boundary:**
> - **Visitor Access (`/admin/visitors`)**: Provides a front-desk visitor registration log with instant CSV export. Direct cloud database persistence is pending Phase 5 route registration.
> - **Student Parcels (`/admin/parcels`)**: Provides a front-desk mailroom intake logger with student lookup and CSV export.
> - **SOS Emergency (`/admin/sos`)**: Provides emergency response protocols, hotline telephone directories, and duty warden contact rosters.

---

## 9. Dining Services & Announcements

### 9.1 Mess & Dining Management (`/admin/food`)
- **Today's Menu**: View and publish daily meals for Breakfast, Lunch, Snacks, and Dinner.
- **Serving Timings**: Configure dining hall opening and closing hours for each meal.
- **Student Food Feedback**: Inspect student ratings and dining satisfaction feedback.

### 9.2 Broadcast Notices (`/admin/announcements`)
1. Click **New Announcement**.
2. Enter the **Notice Title** and **Message Body**.
3. Select the **Target Audience**: *All Students*, *Specific Hostel*, or *Staff Only*.
4. Choose the priority: **NORMAL** or **URGENT**.
5. Click **Broadcast Notice**. Active students will see the notice upon their next login.

---

## 10. Reports, Settings & Operational Audit

### 10.1 Reports & Analytics (`/admin/reports`)
The reports module provides 9 specialized operational reports:
1. **Overview Report**: Broad campus operational KPIs.
2. **Students Report**: Enrolled student breakdowns by department and status.
3. **Occupancy Report**: Detailed bed occupancy and vacancy per hostel and block.
4. **Allocations Report**: Bed turnover and assignment history.
5. **Attendance Report**: Roll-call compliance trends and absence logs.
6. **Leave Report**: Outpass volumes and approval ratios.
7. **Complaints Report**: Service desk resolution metrics and category distributions.
8. **Maintenance Report**: Facility maintenance turnaround times.
9. **Staff Report**: Active staff roster and gate assignment distributions.

**Exporting Data:** Click **Export CSV** on any report to download the active dataset directly to your local computer.

### 10.2 Institution Settings (`/admin/settings`)
- View your college profile, licensed modules, timezone, and academic term calendar.
- Configure default curfew times and notification preferences.

### 10.3 Operational Activity Log (`/admin/audit-logs`)
- Inspect a chronological, tenant-scoped stream of administrative actions (resident admissions, room assignments, leave approvals, maintenance resolutions).
- Use the date and module filters to audit specific events.
- Click **Export CSV** to download the activity ledger for administrative reviews.
