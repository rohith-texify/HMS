import {
  Compass,
  Building2,
  Users,
  GraduationCap,
  LayoutDashboard,
  Send,
  Wrench,
  BedDouble,
  ClipboardList,
  ShieldCheck,
  CalendarCheck,
  Utensils,
  MessageSquare,
  AlertTriangle,
  FileText,
  KeyRound,
  DoorOpen,
  ClipboardCheck,
  Footprints,
  Ticket,
  Package,
  ShieldAlert,
  Megaphone,
  BarChart3,
  Sliders,
  UserCheck,
  AlertOctagon,
  Hammer,
  UtensilsCrossed,
  Bell,
  FolderLock,
  History,
} from 'lucide-react';

/**
 * Authoritative module navigation configurations per role.
 * Includes permissions metadata for enterprise RBAC visibility filtering.
 */
export const ROLE_NAVIGATION = {
  // =========================================================================
  // College Administration Portal
  // =========================================================================
  COLLEGE_ADMIN: {
    brand: 'College Admin',
    moduleTitle: 'College Administration',
    icon: Building2,
    basePath: '/admin',
    scope: 'COLLEGE',
    navGroups: [
      {
        group: 'Overview',
        items: [
          {
            label: 'Dashboard',
            path: '/admin/dashboard',
            icon: Compass,
            permission: 'hostel.view',
            description: 'Institutional metrics, occupancy KPI, and quick operational status',
          },
        ],
      },
      {
        group: 'Facility & Inventory',
        items: [
          {
            label: 'Hostels & Blocks',
            path: '/admin/hostels',
            icon: Building2,
            permission: 'hostel.view',
            description: 'Manage residential hostels, wings, floors, rooms, and bed capacity',
          },
          {
            label: 'Rooms & Beds',
            path: '/admin/rooms',
            icon: DoorOpen,
            permission: 'hostel.view',
            description: 'Explore room inventory, types, and bed allocations',
          },
          {
            label: 'Room Allocations',
            path: '/admin/allocations',
            icon: BedDouble,
            permission: 'people.view',
            description: 'Resident student room allocations, bed assignments, and transfer workflows',
          },
        ],
      },
      {
        group: 'Community Management',
        items: [
          {
            label: 'Hostel Staff',
            path: '/admin/staff',
            icon: Users,
            permission: 'people.view',
            description: 'Manage wardens, hostel in-charges, security guards, and staff roles',
          },
          {
            label: 'Hostel Staff Allocation',
            path: '/admin/incharges',
            icon: BedDouble,
            permission: 'people.view',
            description: 'Manage residential primary and backup warden hostel staff assignments',
          },
          {
            label: 'Security Personnel',
            path: '/admin/security-assignments',
            icon: ShieldCheck,
            permission: 'people.view',
            description: 'Campus gate security guard postings and shift management',
          },
          {
            label: 'Students Directory',
            path: '/admin/students',
            icon: GraduationCap,
            permission: 'people.view',
            description: 'Active student residents, enrollment data, bed allocations, and guardians',
          },
          {
            label: 'Parents & Guardians',
            path: '/admin/parents',
            icon: Users,
            permission: 'people.view',
            description: 'Registered parent profiles, emergency contacts, and student linkages',
          },
          {
            label: 'Password & Access',
            path: '/admin/passwords',
            icon: KeyRound,
            permission: 'people.view',
            description: 'Administrative credential reset, access control, and account security',
          },
        ],
      },
      {
        group: 'Operations & Movement',
        items: [
          {
            label: 'Daily Attendance',
            path: '/admin/attendance',
            icon: ClipboardCheck,
            permission: 'people.view',
            description: 'Nightly curfew roll-call logs and presence tracking',
          },
          {
            label: 'Leave Requests',
            path: '/admin/leaves',
            icon: FileText,
            permission: 'requests.view',
            description: 'Student outpass applications, approvals, and weekend permissions',
          },
          {
            label: 'Student Movement',
            path: '/admin/movement',
            icon: Footprints,
            permission: 'people.view',
            description: 'Campus gate checkpoints and security officer postings',
          },
          {
            label: 'Gate Clearances',
            path: '/admin/gate-passes',
            icon: Ticket,
            permission: 'requests.view',
            description: 'Authorized departure clearances and gate security verification',
          },
        ],
      },
      {
        group: 'Support & Safety',
        items: [
          {
            label: 'Student Complaints',
            path: '/admin/complaints',
            icon: Wrench,
            permission: 'requests.view',
            description: 'Maintenance work orders, repair requests, and service tickets',
          },
          {
            label: 'Visitor Access',
            path: '/admin/visitors',
            icon: Users,
            permission: 'people.view',
            description: 'Campus visitor reception, entry rules, and perimeter checkpoints',
          },
          {
            label: 'Student Parcels',
            path: '/admin/parcels',
            icon: Package,
            permission: 'people.view',
            description: 'Courier delivery intake, mailroom drop points, and claim security',
          },
          {
            label: 'SOS & Emergency',
            path: '/admin/sos',
            icon: ShieldAlert,
            permission: 'people.view',
            description: 'Crisis response coordination, duty wardens, and emergency contacts',
          },
        ],
      },
      {
        group: 'Campus Living & Welfare',
        items: [
          {
            label: 'Hostel Mess & Food',
            path: '/admin/food',
            icon: Utensils,
            permission: 'hostel.view',
            description: 'Daily dining menus, meal serving schedules, and student food feedback',
          },
          {
            label: 'Notice & Broadcasts',
            path: '/admin/announcements',
            icon: Megaphone,
            permission: 'hostel.view',
            description: 'Administrative circulars, hostel notices, and emergency broadcast dispatch',
          },
        ],
      },
      {
        group: 'Administration & Governance',
        items: [
          {
            label: 'Reports & Analytics',
            path: '/admin/reports',
            icon: BarChart3,
            permission: 'reports.view',
            description: 'Executive institutional intelligence, occupancy analytics, and report exports',
          },
          {
            label: 'Institution Settings',
            path: '/admin/settings',
            icon: Sliders,
            permission: 'hostel.view',
            description: 'College profile, licensed modules, timezone configuration, and branding',
          },
          {
            label: 'Audit & Activity Log',
            path: '/admin/audit-logs',
            icon: FileText,
            permission: 'people.view',
            description: 'Immutable operational audit trail, administrative events, and compliance records',
          },
        ],
      },
    ],
  },

  HOSTEL_ADMIN: {
    brand: 'Hostel Admin',
    moduleTitle: 'Hostel Administration',
    icon: Building2,
    basePath: '/admin',
    scope: 'COLLEGE',
    navGroups: [
      {
        group: 'Overview',
        items: [
          { label: 'Dashboard', path: '/admin/dashboard', icon: Compass, permission: 'hostel.view' },
        ],
      },
      {
        group: 'Facility & Inventory',
        items: [
          { label: 'Hostels & Blocks', path: '/admin/hostels', icon: Building2, permission: 'hostel.view' },
          { label: 'Rooms & Beds', path: '/admin/rooms', icon: DoorOpen, permission: 'hostel.view' },
          { label: 'Room Allocations', path: '/admin/allocations', icon: BedDouble, permission: 'people.view' },
        ],
      },
      {
        group: 'Community Management',
        items: [
          { label: 'Hostel Staff', path: '/admin/staff', icon: Users, permission: 'people.view' },
          { label: 'Hostel Staff Allocation', path: '/admin/incharges', icon: BedDouble, permission: 'people.view' },
          { label: 'Security Personnel', path: '/admin/security-assignments', icon: ShieldCheck, permission: 'people.view' },
          { label: 'Students Directory', path: '/admin/students', icon: GraduationCap, permission: 'people.view' },
          { label: 'Parents & Guardians', path: '/admin/parents', icon: Users, permission: 'people.view' },
          { label: 'Password & Access', path: '/admin/passwords', icon: KeyRound, permission: 'people.view' },
        ],
      },
      {
        group: 'Operations & Movement',
        items: [
          { label: 'Daily Attendance', path: '/admin/attendance', icon: ClipboardCheck, permission: 'people.view' },
          { label: 'Leave Requests', path: '/admin/leaves', icon: FileText, permission: 'requests.view' },
          { label: 'Student Movement', path: '/admin/movement', icon: Footprints, permission: 'people.view' },
          { label: 'Gate Clearances', path: '/admin/gate-passes', icon: Ticket, permission: 'requests.view' },
        ],
      },
      {
        group: 'Support & Safety',
        items: [
          { label: 'Student Complaints', path: '/admin/complaints', icon: Wrench, permission: 'requests.view' },
          { label: 'Visitor Access', path: '/admin/visitors', icon: Users, permission: 'people.view' },
          { label: 'Student Parcels', path: '/admin/parcels', icon: Package, permission: 'people.view' },
          { label: 'SOS & Emergency', path: '/admin/sos', icon: ShieldAlert, permission: 'people.view' },
        ],
      },
      {
        group: 'Campus Living & Welfare',
        items: [
          { label: 'Hostel Mess & Food', path: '/admin/food', icon: Utensils, permission: 'hostel.view' },
          { label: 'Notice & Broadcasts', path: '/admin/announcements', icon: Megaphone, permission: 'hostel.view' },
        ],
      },
      {
        group: 'Administration & Governance',
        items: [
          { label: 'Reports & Analytics', path: '/admin/reports', icon: BarChart3, permission: 'reports.view' },
          { label: 'Institution Settings', path: '/admin/settings', icon: Sliders, permission: 'hostel.view' },
          { label: 'Audit & Activity Log', path: '/admin/audit-logs', icon: FileText, permission: 'people.view' },
        ],
      },
    ],
  },

  ADMIN: {
    brand: 'Administration',
    moduleTitle: 'Institutional Administration',
    icon: Building2,
    basePath: '/admin',
    scope: 'COLLEGE',
    navGroups: [
      {
        group: 'Overview',
        items: [
          { label: 'Dashboard', path: '/admin/dashboard', icon: Compass, permission: 'hostel.view' },
        ],
      },
      {
        group: 'Facility & Inventory',
        items: [
          { label: 'Hostels & Blocks', path: '/admin/hostels', icon: Building2, permission: 'hostel.view' },
          { label: 'Rooms & Beds', path: '/admin/rooms', icon: DoorOpen, permission: 'hostel.view' },
          { label: 'Room Allocations', path: '/admin/allocations', icon: BedDouble, permission: 'people.view' },
        ],
      },
      {
        group: 'Community Management',
        items: [
          { label: 'Hostel Staff', path: '/admin/staff', icon: Users, permission: 'people.view' },
          { label: 'Hostel Staff Allocation', path: '/admin/incharges', icon: BedDouble, permission: 'people.view' },
          { label: 'Security Personnel', path: '/admin/security-assignments', icon: ShieldCheck, permission: 'people.view' },
          { label: 'Students Directory', path: '/admin/students', icon: GraduationCap, permission: 'people.view' },
          { label: 'Parents & Guardians', path: '/admin/parents', icon: Users, permission: 'people.view' },
          { label: 'Password & Access', path: '/admin/passwords', icon: KeyRound, permission: 'people.view' },
        ],
      },
      {
        group: 'Operations & Movement',
        items: [
          { label: 'Daily Attendance', path: '/admin/attendance', icon: ClipboardCheck, permission: 'people.view' },
          { label: 'Leave Requests', path: '/admin/leaves', icon: FileText, permission: 'requests.view' },
          { label: 'Student Movement', path: '/admin/movement', icon: Footprints, permission: 'people.view' },
          { label: 'Gate Clearances', path: '/admin/gate-passes', icon: Ticket, permission: 'requests.view' },
        ],
      },
      {
        group: 'Support & Safety',
        items: [
          { label: 'Student Complaints', path: '/admin/complaints', icon: Wrench, permission: 'requests.view' },
          { label: 'Visitor Access', path: '/admin/visitors', icon: Users, permission: 'people.view' },
          { label: 'Student Parcels', path: '/admin/parcels', icon: Package, permission: 'people.view' },
          { label: 'SOS & Emergency', path: '/admin/sos', icon: ShieldAlert, permission: 'people.view' },
        ],
      },
      {
        group: 'Campus Living & Welfare',
        items: [
          { label: 'Hostel Mess & Food', path: '/admin/food', icon: Utensils, permission: 'hostel.view' },
          { label: 'Notice & Broadcasts', path: '/admin/announcements', icon: Megaphone, permission: 'hostel.view' },
        ],
      },
      {
        group: 'Administration & Governance',
        items: [
          { label: 'Reports & Analytics', path: '/admin/reports', icon: BarChart3, permission: 'reports.view' },
          { label: 'Institution Settings', path: '/admin/settings', icon: Sliders, permission: 'hostel.view' },
          { label: 'Audit & Activity Log', path: '/admin/audit-logs', icon: FileText, permission: 'people.view' },
        ],
      },
    ],
  },

  // =========================================================================
  // Student Portal
  // =========================================================================
  STUDENT: {
    brand: 'Student Portal',
    moduleTitle: 'Residential Student',
    icon: GraduationCap,
    basePath: '/student',
    scope: 'COLLEGE',
    navGroups: [
      {
        group: 'Personal',
        items: [
          { label: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
          { label: 'Leave Requests', path: '/student/leaves', icon: Send },
          { label: 'Maintenance & Complaints', path: '/student/complaints', icon: Wrench },
        ],
      },
    ],
  },

  // =========================================================================
  // Parent / Guardian Portal
  // =========================================================================
  PARENT: {
    brand: 'Parent Portal',
    moduleTitle: 'Parent & Guardian Portal',
    icon: Users,
    basePath: '/parent',
    scope: 'COLLEGE',
    navGroups: [
      {
        group: 'Ward Oversight',
        items: [
          { label: 'Dashboard', path: '/parent/dashboard', icon: LayoutDashboard },
          { label: 'Leave Approvals', path: '/parent/leaves', icon: Send },
        ],
      },
    ],
  },

  // =========================================================================
  // Hostel In-Charge / Warden Portal
  // =========================================================================
  HOSTEL_INCHARGE: {
    brand: 'Hostel In-Charge',
    moduleTitle: 'Hostel Incharge Operations',
    icon: BedDouble,
    basePath: '/hostel-incharge',
    scope: 'COLLEGE',
    navGroups: [
      {
        group: 'Core Operations',
        items: [
          { label: 'Dashboard', path: '/hostel-incharge/dashboard', icon: LayoutDashboard },
          { label: 'Hostel Overview', path: '/hostel-incharge/hostel', icon: Building2 },
          { label: 'Rooms & Beds', path: '/hostel-incharge/rooms', icon: BedDouble },
          { label: 'Hostel Residents', path: '/hostel-incharge/students', icon: Users },
          { label: 'Room Allocations', path: '/hostel-incharge/allocations', icon: KeyRound },
        ],
      },
      {
        group: 'Attendance & Movement',
        items: [
          { label: 'Daily Attendance', path: '/hostel-incharge/attendance', icon: ClipboardList },
          { label: 'Leave Requests', path: '/hostel-incharge/leaves', icon: FileText },
          { label: 'Outings & Gate Passes', path: '/hostel-incharge/gate-passes', icon: Footprints },
        ],
      },
      {
        group: 'Support & Facility',
        items: [
          { label: 'Visitor Access', path: '/hostel-incharge/visitors', icon: UserCheck },
          { label: 'Student Parcels', path: '/hostel-incharge/parcels', icon: Package },
          { label: 'SOS & Emergency', path: '/hostel-incharge/emergency', icon: AlertOctagon },
          { label: 'Complaints', path: '/hostel-incharge/complaints', icon: Wrench },
          { label: 'Maintenance', path: '/hostel-incharge/maintenance', icon: Hammer },
        ],
      },
      {
        group: 'Dining & Communication',
        items: [
          { label: 'Mess & Food Menus', path: '/hostel-incharge/mess', icon: UtensilsCrossed },
          { label: 'Notices & Broadcasts', path: '/hostel-incharge/announcements', icon: Bell },
          { label: 'Documents & Records', path: '/hostel-incharge/documents', icon: FolderLock },
        ],
      },
      {
        group: 'Reports & Governance',
        items: [
          { label: 'Reports & Analytics', path: '/hostel-incharge/reports', icon: BarChart3 },
          { label: 'Activity Stream', path: '/hostel-incharge/audit', icon: History },
        ],
      },
    ],
  },
  INCHARGE: {
    brand: 'Hostel In-Charge',
    moduleTitle: 'Hostel Incharge Operations',
    icon: BedDouble,
    basePath: '/hostel-incharge',
    scope: 'COLLEGE',
    navGroups: [
      {
        group: 'Core Operations',
        items: [
          { label: 'Dashboard', path: '/hostel-incharge/dashboard', icon: LayoutDashboard },
          { label: 'Hostel Overview', path: '/hostel-incharge/hostel', icon: Building2 },
          { label: 'Rooms & Beds', path: '/hostel-incharge/rooms', icon: BedDouble },
          { label: 'Hostel Residents', path: '/hostel-incharge/students', icon: Users },
          { label: 'Room Allocations', path: '/hostel-incharge/allocations', icon: KeyRound },
        ],
      },
      {
        group: 'Attendance & Movement',
        items: [
          { label: 'Daily Attendance', path: '/hostel-incharge/attendance', icon: ClipboardList },
          { label: 'Leave Requests', path: '/hostel-incharge/leaves', icon: FileText },
          { label: 'Outings & Gate Passes', path: '/hostel-incharge/gate-passes', icon: Footprints },
        ],
      },
      {
        group: 'Support & Facility',
        items: [
          { label: 'Visitor Access', path: '/hostel-incharge/visitors', icon: UserCheck },
          { label: 'Student Parcels', path: '/hostel-incharge/parcels', icon: Package },
          { label: 'SOS & Emergency', path: '/hostel-incharge/emergency', icon: AlertOctagon },
          { label: 'Complaints', path: '/hostel-incharge/complaints', icon: Wrench },
          { label: 'Maintenance', path: '/hostel-incharge/maintenance', icon: Hammer },
        ],
      },
      {
        group: 'Dining & Communication',
        items: [
          { label: 'Mess & Food Menus', path: '/hostel-incharge/mess', icon: UtensilsCrossed },
          { label: 'Notices & Broadcasts', path: '/hostel-incharge/announcements', icon: Bell },
          { label: 'Documents & Records', path: '/hostel-incharge/documents', icon: FolderLock },
        ],
      },
      {
        group: 'Reports & Governance',
        items: [
          { label: 'Reports & Analytics', path: '/hostel-incharge/reports', icon: BarChart3 },
          { label: 'Activity Stream', path: '/hostel-incharge/audit', icon: History },
        ],
      },
    ],
  },
  WARDEN: {
    brand: 'Hostel Warden',
    moduleTitle: 'Hostel Warden Operations',
    icon: BedDouble,
    basePath: '/hostel-incharge',
    scope: 'COLLEGE',
    navGroups: [
      {
        group: 'Core Operations',
        items: [
          { label: 'Dashboard', path: '/hostel-incharge/dashboard', icon: LayoutDashboard },
          { label: 'Hostel Overview', path: '/hostel-incharge/hostel', icon: Building2 },
          { label: 'Rooms & Beds', path: '/hostel-incharge/rooms', icon: BedDouble },
          { label: 'Hostel Residents', path: '/hostel-incharge/students', icon: Users },
          { label: 'Room Allocations', path: '/hostel-incharge/allocations', icon: KeyRound },
        ],
      },
      {
        group: 'Attendance & Movement',
        items: [
          { label: 'Daily Attendance', path: '/hostel-incharge/attendance', icon: ClipboardList },
          { label: 'Leave Requests', path: '/hostel-incharge/leaves', icon: FileText },
          { label: 'Outings & Gate Passes', path: '/hostel-incharge/gate-passes', icon: Footprints },
        ],
      },
      {
        group: 'Support & Facility',
        items: [
          { label: 'Visitor Access', path: '/hostel-incharge/visitors', icon: UserCheck },
          { label: 'Student Parcels', path: '/hostel-incharge/parcels', icon: Package },
          { label: 'SOS & Emergency', path: '/hostel-incharge/emergency', icon: AlertOctagon },
          { label: 'Complaints', path: '/hostel-incharge/complaints', icon: Wrench },
          { label: 'Maintenance', path: '/hostel-incharge/maintenance', icon: Hammer },
        ],
      },
      {
        group: 'Dining & Communication',
        items: [
          { label: 'Mess & Food Menus', path: '/hostel-incharge/mess', icon: UtensilsCrossed },
          { label: 'Notices & Broadcasts', path: '/hostel-incharge/announcements', icon: Bell },
          { label: 'Documents & Records', path: '/hostel-incharge/documents', icon: FolderLock },
        ],
      },
      {
        group: 'Reports & Governance',
        items: [
          { label: 'Reports & Analytics', path: '/hostel-incharge/reports', icon: BarChart3 },
          { label: 'Activity Stream', path: '/hostel-incharge/audit', icon: History },
        ],
      },
    ],
  },

  // =========================================================================
  // Campus Security Portal
  // =========================================================================
  SECURITY: {
    brand: 'Campus Security',
    moduleTitle: 'Campus Gate Security',
    icon: ShieldCheck,
    basePath: '/security',
    scope: 'COLLEGE',
    navGroups: [
      {
        group: 'Gate Operations',
        items: [
          { label: 'Dashboard', path: '/security/dashboard', icon: LayoutDashboard },
          { label: 'Gate Posts', path: '/security/gates', icon: ShieldCheck },
          { label: 'Verified Leaves', path: '/security/leaves', icon: Send },
          { label: 'Student Check', path: '/security/students', icon: GraduationCap },
        ],
      },
    ],
  },
  SECURITY_GUARD: {
    brand: 'Campus Security',
    moduleTitle: 'Campus Gate Security',
    icon: ShieldCheck,
    basePath: '/security',
    scope: 'COLLEGE',
    navGroups: [
      {
        group: 'Gate Operations',
        items: [
          { label: 'Dashboard', path: '/security/dashboard', icon: LayoutDashboard },
          { label: 'Gate Posts', path: '/security/gates', icon: ShieldCheck },
          { label: 'Verified Leaves', path: '/security/leaves', icon: Send },
          { label: 'Student Check', path: '/security/students', icon: GraduationCap },
        ],
      },
    ],
  },
};

/**
 * Filter navigation groups and items based on user permissions.
 * If user has no specific permissions array, full access within role is granted.
 */
export function getFilteredNavigation(role, userPermissions = null) {
  const normalizedRole = (role || 'COLLEGE_ADMIN').toUpperCase();
  const baseConfig = ROLE_NAVIGATION[normalizedRole] || ROLE_NAVIGATION.COLLEGE_ADMIN;

  if (!userPermissions || !Array.isArray(userPermissions) || userPermissions.length === 0) {
    return baseConfig;
  }

  const permissionSet = new Set(userPermissions.map((p) => (typeof p === 'string' ? p.toLowerCase() : p?.code?.toLowerCase())));

  const filteredGroups = baseConfig.navGroups
    .map((grp) => {
      const allowedItems = grp.items.filter((item) => {
        if (!item.permission) return true;
        return permissionSet.has(item.permission.toLowerCase());
      });
      return { ...grp, items: allowedItems };
    })
    .filter((grp) => grp.items.length > 0);

  return {
    ...baseConfig,
    navGroups: filteredGroups,
  };
}

/**
 * Dynamically resolves breadcrumbs from current location pathname.
 */
export function resolveBreadcrumb(pathname, roleConfig) {
  if (!pathname) return { group: 'Institutional Portal', title: 'Overview' };

  if (roleConfig?.navGroups) {
    for (const group of roleConfig.navGroups) {
      for (const item of group.items) {
        if (item.path === pathname || pathname.startsWith(item.path + '/')) {
          return { group: group.group, title: item.label };
        }
      }
    }
  }

  // Fallback defaults for standard admin paths
  const routeMap = {
    '/admin/dashboard': { group: 'Overview', title: 'Dashboard' },
    '/admin/hostels': { group: 'Facility & Inventory', title: 'Hostels & Blocks' },
    '/admin/rooms': { group: 'Facility & Inventory', title: 'Rooms & Beds' },
    '/admin/allocations': { group: 'Facility & Inventory', title: 'Room Allocations' },
    '/admin/staff': { group: 'Community Management', title: 'Hostel Staff' },
    '/admin/incharges': { group: 'Community Management', title: 'Hostel Staff Allocation' },
    '/admin/security-assignments': { group: 'Community Management', title: 'Security Personnel' },
    '/admin/students': { group: 'Community Management', title: 'Students Directory' },
    '/admin/parents': { group: 'Community Management', title: 'Parents & Guardians' },
    '/admin/passwords': { group: 'Community Management', title: 'Password & Access' },
    '/admin/attendance': { group: 'Operations & Movement', title: 'Daily Attendance' },
    '/admin/leaves': { group: 'Operations & Movement', title: 'Leave Requests' },
    '/admin/movement': { group: 'Operations & Movement', title: 'Student Movement' },
    '/admin/gate-passes': { group: 'Operations & Movement', title: 'Gate Clearances' },
    '/admin/complaints': { group: 'Support & Safety', title: 'Student Complaints' },
    '/admin/visitors': { group: 'Support & Safety', title: 'Visitor Access' },
    '/admin/parcels': { group: 'Support & Safety', title: 'Student Parcels' },
    '/admin/sos': { group: 'Support & Safety', title: 'SOS & Emergency' },
    '/admin/food': { group: 'Campus Living & Welfare', title: 'Hostel Mess & Food' },
    '/admin/announcements': { group: 'Campus Living & Welfare', title: 'Notice & Broadcasts' },
    '/admin/reports': { group: 'Administration & Governance', title: 'Reports & Analytics' },
    '/admin/settings': { group: 'Administration & Governance', title: 'Institution Settings' },
    '/admin/audit-logs': { group: 'Administration & Governance', title: 'Audit & Activity Log' },
  };

  return routeMap[pathname] || { group: roleConfig?.brand || 'College Administration', title: 'Dashboard' };
}

export default ROLE_NAVIGATION;

