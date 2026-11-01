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
} from 'lucide-react';

/**
 * Authoritative module navigation configurations per role.
 * Structured with hierarchical nav groups and semantic Lucide vector icons.
 */
export const ROLE_NAVIGATION = {
  // College Administration
  COLLEGE_ADMIN: {
    brand: 'College Admin',
    moduleTitle: 'College Administration',
    icon: Building2,
    basePath: '/admin',
    navGroups: [
      {
        group: 'Overview',
        items: [
          { label: 'Dashboard', path: '/admin/dashboard', icon: Compass },
        ],
      },
      {
        group: 'Facility & Inventory',
        items: [
          { label: 'Hostels & Blocks', path: '/admin/hostels', icon: Building2 },
        ],
      },
      {
        group: 'Community Management',
        items: [
          { label: 'College Staff', path: '/admin/staff', icon: Users },
          { label: 'Students Directory', path: '/admin/students', icon: GraduationCap },
        ],
      },
    ],
  },
  HOSTEL_ADMIN: {
    brand: 'Hostel Admin',
    moduleTitle: 'Hostel Administration',
    icon: Building2,
    basePath: '/admin',
    navGroups: [
      {
        group: 'Overview',
        items: [
          { label: 'Dashboard', path: '/admin/dashboard', icon: Compass },
        ],
      },
      {
        group: 'Facility & Inventory',
        items: [
          { label: 'Hostels & Blocks', path: '/admin/hostels', icon: Building2 },
        ],
      },
      {
        group: 'Community Management',
        items: [
          { label: 'College Staff', path: '/admin/staff', icon: Users },
          { label: 'Students Directory', path: '/admin/students', icon: GraduationCap },
        ],
      },
    ],
  },
  ADMIN: {
    brand: 'Administration',
    moduleTitle: 'Institutional Administration',
    icon: Building2,
    basePath: '/admin',
    navGroups: [
      {
        group: 'Overview',
        items: [
          { label: 'Dashboard', path: '/admin/dashboard', icon: Compass },
        ],
      },
      {
        group: 'Facility & Inventory',
        items: [
          { label: 'Hostels & Blocks', path: '/admin/hostels', icon: Building2 },
        ],
      },
      {
        group: 'Community Management',
        items: [
          { label: 'College Staff', path: '/admin/staff', icon: Users },
          { label: 'Students Directory', path: '/admin/students', icon: GraduationCap },
        ],
      },
    ],
  },

  // Supporting Portals
  STUDENT: {
    brand: 'Student Portal',
    moduleTitle: 'Student Residential Suite',
    icon: GraduationCap,
    basePath: '/student',
    navGroups: [
      {
        group: 'Student Overview',
        items: [
          { label: 'My Overview', path: '/student/dashboard', icon: Compass },
          { label: 'Leave Requests', path: '/student/leaves', icon: Send },
          { label: 'Complaints', path: '/student/complaints', icon: Wrench },
        ],
      },
    ],
  },

  PARENT: {
    brand: 'Parent Portal',
    moduleTitle: 'Parent & Guardian Portal',
    icon: Users,
    basePath: '/parent',
    navGroups: [
      {
        group: 'Ward Status',
        items: [
          { label: 'Ward Overview', path: '/parent/dashboard', icon: Compass },
          { label: 'Leave History', path: '/parent/leaves', icon: Send },
        ],
      },
    ],
  },

  HOSTEL_INCHARGE: {
    brand: 'Hostel In-Charge',
    moduleTitle: 'Warden & Hostel Incharge',
    icon: ClipboardList,
    basePath: '/hostel-incharge',
    navGroups: [
      {
        group: 'Operations',
        items: [
          { label: 'Overview', path: '/hostel-incharge/dashboard', icon: Compass },
          { label: 'Rooms & Occupancy', path: '/hostel-incharge/rooms', icon: BedDouble },
          { label: 'Complaints', path: '/hostel-incharge/complaints', icon: Wrench },
          { label: 'Daily Attendance', path: '/hostel-incharge/attendance', icon: ClipboardList },
        ],
      },
    ],
  },
  INCHARGE: {
    brand: 'Hostel In-Charge',
    moduleTitle: 'Warden & Hostel Incharge',
    icon: ClipboardList,
    basePath: '/hostel-incharge',
    navGroups: [
      {
        group: 'Operations',
        items: [
          { label: 'Overview', path: '/hostel-incharge/dashboard', icon: Compass },
          { label: 'Rooms & Occupancy', path: '/hostel-incharge/rooms', icon: BedDouble },
          { label: 'Complaints', path: '/hostel-incharge/complaints', icon: Wrench },
          { label: 'Daily Attendance', path: '/hostel-incharge/attendance', icon: ClipboardList },
        ],
      },
    ],
  },
  WARDEN: {
    brand: 'Hostel Warden',
    moduleTitle: 'Warden Residential Suite',
    icon: ClipboardList,
    basePath: '/hostel-incharge',
    navGroups: [
      {
        group: 'Operations',
        items: [
          { label: 'Overview', path: '/hostel-incharge/dashboard', icon: Compass },
          { label: 'Rooms & Occupancy', path: '/hostel-incharge/rooms', icon: BedDouble },
          { label: 'Complaints', path: '/hostel-incharge/complaints', icon: Wrench },
          { label: 'Daily Attendance', path: '/hostel-incharge/attendance', icon: ClipboardList },
        ],
      },
    ],
  },

  SECURITY: {
    brand: 'Campus Security',
    moduleTitle: 'Campus Gate & Perimeter Security',
    icon: ShieldCheck,
    basePath: '/security',
    navGroups: [
      {
        group: 'Gate Operations',
        items: [
          { label: 'Gate Console', path: '/security/dashboard', icon: Compass },
          { label: 'Checkpoints', path: '/security/gates', icon: ShieldCheck },
          { label: 'Active Passes', path: '/security/leaves', icon: Send },
          { label: 'Student Gate Roster', path: '/security/students', icon: GraduationCap },
        ],
      },
    ],
  },
  SECURITY_GUARD: {
    brand: 'Campus Security',
    moduleTitle: 'Campus Gate & Perimeter Security',
    icon: ShieldCheck,
    basePath: '/security',
    navGroups: [
      {
        group: 'Gate Operations',
        items: [
          { label: 'Gate Console', path: '/security/dashboard', icon: Compass },
          { label: 'Checkpoints', path: '/security/gates', icon: ShieldCheck },
          { label: 'Active Passes', path: '/security/leaves', icon: Send },
          { label: 'Student Gate Roster', path: '/security/students', icon: GraduationCap },
        ],
      },
    ],
  },
};
