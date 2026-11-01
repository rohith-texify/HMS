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
        ],
      },
      {
        group: 'Community Management',
        items: [
          {
            label: 'College Staff',
            path: '/admin/staff',
            icon: Users,
            permission: 'people.view',
            description: 'Manage wardens, hostel in-charges, security guards, and staff roles',
          },
          {
            label: 'Students Directory',
            path: '/admin/students',
            icon: GraduationCap,
            permission: 'people.view',
            description: 'Active student residents, enrollment data, bed allocations, and guardians',
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
        ],
      },
      {
        group: 'Community Management',
        items: [
          { label: 'College Staff', path: '/admin/staff', icon: Users, permission: 'people.view' },
          { label: 'Students Directory', path: '/admin/students', icon: GraduationCap, permission: 'people.view' },
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
        ],
      },
      {
        group: 'Community Management',
        items: [
          { label: 'College Staff', path: '/admin/staff', icon: Users, permission: 'people.view' },
          { label: 'Students Directory', path: '/admin/students', icon: GraduationCap, permission: 'people.view' },
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
        group: 'Floor Management',
        items: [
          { label: 'Dashboard', path: '/hostel-incharge/dashboard', icon: LayoutDashboard },
          { label: 'Rooms & Beds', path: '/hostel-incharge/rooms', icon: BedDouble },
          { label: 'Daily Attendance', path: '/hostel-incharge/attendance', icon: ClipboardList },
          { label: 'Student Complaints', path: '/hostel-incharge/complaints', icon: Wrench },
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
        group: 'Floor Management',
        items: [
          { label: 'Dashboard', path: '/hostel-incharge/dashboard', icon: LayoutDashboard },
          { label: 'Rooms & Beds', path: '/hostel-incharge/rooms', icon: BedDouble },
          { label: 'Daily Attendance', path: '/hostel-incharge/attendance', icon: ClipboardList },
          { label: 'Student Complaints', path: '/hostel-incharge/complaints', icon: Wrench },
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
        group: 'Floor Management',
        items: [
          { label: 'Dashboard', path: '/hostel-incharge/dashboard', icon: LayoutDashboard },
          { label: 'Rooms & Beds', path: '/hostel-incharge/rooms', icon: BedDouble },
          { label: 'Daily Attendance', path: '/hostel-incharge/attendance', icon: ClipboardList },
          { label: 'Student Complaints', path: '/hostel-incharge/complaints', icon: Wrench },
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
    '/admin/staff': { group: 'Community Management', title: 'College Staff' },
    '/admin/students': { group: 'Community Management', title: 'Students Directory' },
  };

  return routeMap[pathname] || { group: roleConfig?.brand || 'College Administration', title: 'Dashboard' };
}

export default ROLE_NAVIGATION;

