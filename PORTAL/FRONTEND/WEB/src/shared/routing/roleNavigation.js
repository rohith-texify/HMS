/**
 * Authoritative module navigation configurations per role.
 */
export const ROLE_NAVIGATION = {
  // College Administration
  COLLEGE_ADMIN: {
    brand: 'College Admin',
    icon: '🏛️',
    basePath: '/admin',
    navItems: [
      { label: 'Dashboard', path: '/admin/dashboard', icon: '📊' },
      { label: 'Students', path: '/admin/students', icon: '🎓' },
      { label: 'College Staff', path: '/admin/staff', icon: '👥' },
      { label: 'Hostels & Blocks', path: '/admin/hostels', icon: '🏢' },
    ],
  },
  HOSTEL_ADMIN: {
    brand: 'Hostel Admin',
    icon: '🏛️',
    basePath: '/admin',
    navItems: [
      { label: 'Dashboard', path: '/admin/dashboard', icon: '📊' },
      { label: 'Students', path: '/admin/students', icon: '🎓' },
      { label: 'College Staff', path: '/admin/staff', icon: '👥' },
      { label: 'Hostels & Blocks', path: '/admin/hostels', icon: '🏢' },
    ],
  },
  ADMIN: {
    brand: 'Administration',
    icon: '🏛️',
    basePath: '/admin',
    navItems: [
      { label: 'Dashboard', path: '/admin/dashboard', icon: '📊' },
      { label: 'Students', path: '/admin/students', icon: '🎓' },
      { label: 'College Staff', path: '/admin/staff', icon: '👥' },
      { label: 'Hostels & Blocks', path: '/admin/hostels', icon: '🏢' },
    ],
  },

  // Student Portal
  STUDENT: {
    brand: 'Student Portal',
    icon: '🎓',
    basePath: '/student',
    navItems: [
      { label: 'My Overview', path: '/student/dashboard', icon: '📊' },
      { label: 'Leave Requests', path: '/student/leaves', icon: '✈️' },
      { label: 'Complaints', path: '/student/complaints', icon: '🔧' },
    ],
  },

  // Parent Portal
  PARENT: {
    brand: 'Parent Portal',
    icon: '👨‍👩‍👧',
    basePath: '/parent',
    navItems: [
      { label: 'Ward Overview', path: '/parent/dashboard', icon: '📊' },
      { label: 'Leave History', path: '/parent/leaves', icon: '✈️' },
    ],
  },

  // Hostel Incharge Portal
  HOSTEL_INCHARGE: {
    brand: 'Hostel In-Charge',
    icon: '📋',
    basePath: '/hostel-incharge',
    navItems: [
      { label: 'Overview', path: '/hostel-incharge/dashboard', icon: '📊' },
      { label: 'Rooms & Occupancy', path: '/hostel-incharge/rooms', icon: '🛏️' },
      { label: 'Complaints', path: '/hostel-incharge/complaints', icon: '🔧' },
      { label: 'Daily Attendance', path: '/hostel-incharge/attendance', icon: '📝' },
    ],
  },
  INCHARGE: {
    brand: 'Hostel In-Charge',
    icon: '📋',
    basePath: '/hostel-incharge',
    navItems: [
      { label: 'Overview', path: '/hostel-incharge/dashboard', icon: '📊' },
      { label: 'Rooms & Occupancy', path: '/hostel-incharge/rooms', icon: '🛏️' },
      { label: 'Complaints', path: '/hostel-incharge/complaints', icon: '🔧' },
      { label: 'Daily Attendance', path: '/hostel-incharge/attendance', icon: '📝' },
    ],
  },
  WARDEN: {
    brand: 'Hostel Warden',
    icon: '📋',
    basePath: '/hostel-incharge',
    navItems: [
      { label: 'Overview', path: '/hostel-incharge/dashboard', icon: '📊' },
      { label: 'Rooms & Occupancy', path: '/hostel-incharge/rooms', icon: '🛏️' },
      { label: 'Complaints', path: '/hostel-incharge/complaints', icon: '🔧' },
      { label: 'Daily Attendance', path: '/hostel-incharge/attendance', icon: '📝' },
    ],
  },

  // Security Portal
  SECURITY: {
    brand: 'Campus Security',
    icon: '🛡️',
    basePath: '/security',
    navItems: [
      { label: 'Gate Operations', path: '/security/dashboard', icon: '📊' },
      { label: 'Gate Checkpoints', path: '/security/gates', icon: '🚪' },
      { label: 'Student Gate Passes', path: '/security/leaves', icon: '🎫' },
      { label: 'Student Directory', path: '/security/students', icon: '🎓' },
    ],
  },
  SECURITY_GUARD: {
    brand: 'Security Guard',
    icon: '🛡️',
    basePath: '/security',
    navItems: [
      { label: 'Gate Operations', path: '/security/dashboard', icon: '📊' },
      { label: 'Gate Checkpoints', path: '/security/gates', icon: '🚪' },
      { label: 'Student Gate Passes', path: '/security/leaves', icon: '🎫' },
      { label: 'Student Directory', path: '/security/students', icon: '🎓' },
    ],
  },
};

