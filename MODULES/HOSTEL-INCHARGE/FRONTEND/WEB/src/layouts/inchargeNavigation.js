import {
  LayoutDashboard,
  Building2,
  BedDouble,
  Users,
  KeyRound,
  ClipboardList,
  FileText,
  Footprints,
  UserCheck,
  Package,
  AlertOctagon,
  Wrench,
  Hammer,
  UtensilsCrossed,
  Bell,
  FolderLock,
  BarChart3,
  History,
} from 'lucide-react';
import { ROUTES } from '../constants/routes';
import { PERMISSIONS } from '../constants/permissions';

/**
 * Authoritative Navigation Configuration for the Hostel In-Charge Module
 * Covers all 18 approved operational feature areas.
 */
export const INCHARGE_NAVIGATION = {
  brand: 'Hostel In-Charge',
  moduleTitle: 'Hostel Incharge Operations',
  icon: BedDouble,
  basePath: '',
  scope: 'COLLEGE',
  navGroups: [
    {
      group: 'Core Operations',
      items: [
        {
          label: 'Dashboard',
          path: ROUTES.DASHBOARD,
          icon: LayoutDashboard,
          permission: PERMISSIONS.HOSTEL_VIEW,
          description: 'Hostel metrics, resident summary, and occupancy overview',
        },
        {
          label: 'Hostel Overview',
          path: ROUTES.HOSTEL_OVERVIEW,
          icon: Building2,
          permission: PERMISSIONS.HOSTEL_VIEW,
          description: 'Assigned building profile, blocks, and premises details',
        },
        {
          label: 'Rooms & Beds',
          path: ROUTES.ROOMS,
          icon: BedDouble,
          permission: PERMISSIONS.HOSTEL_VIEW,
          description: 'Room and bed inventory, capacity, and vacancy status',
        },
        {
          label: 'Hostel Residents',
          path: ROUTES.STUDENTS,
          icon: Users,
          permission: PERMISSIONS.PEOPLE_VIEW,
          description: 'Enrolled resident student roster and emergency contacts',
        },
        {
          label: 'Room Allocations',
          path: ROUTES.ALLOCATIONS,
          icon: KeyRound,
          permission: PERMISSIONS.PEOPLE_VIEW,
          description: 'Assign unallocated students, transfer rooms, and release beds',
        },
      ],
    },
    {
      group: 'Attendance & Movement',
      items: [
        {
          label: 'Daily Attendance',
          path: ROUTES.ATTENDANCE,
          icon: ClipboardList,
          permission: PERMISSIONS.MOVEMENT_VIEW,
          description: 'Night curfew checks, attendance logs, and manual marking',
        },
        {
          label: 'Leave Requests',
          path: ROUTES.LEAVES,
          icon: FileText,
          permission: PERMISSIONS.REQUESTS_VIEW,
          description: 'Review, approve, or reject student night-out & home leaves',
        },
        {
          label: 'Outings & Gate Passes',
          path: ROUTES.GATE_PASSES,
          icon: Footprints,
          permission: PERMISSIONS.MOVEMENT_VIEW,
          description: 'Student outing logs and campus gate clearance records',
        },
      ],
    },
    {
      group: 'Support & Facility',
      items: [
        {
          label: 'Visitor Access',
          path: ROUTES.VISITORS,
          icon: UserCheck,
          permission: PERMISSIONS.REQUESTS_VIEW,
          description: 'Guest visits, parent arrivals, and authorization records',
        },
        {
          label: 'Student Parcels',
          path: ROUTES.PARCELS,
          icon: Package,
          permission: PERMISSIONS.REQUESTS_VIEW,
          description: 'Arrived deliveries, courier logging, and student pickups',
        },
        {
          label: 'SOS & Emergency',
          path: ROUTES.SOS,
          icon: AlertOctagon,
          permission: PERMISSIONS.PEOPLE_VIEW,
          description: 'Emergency contacts and incident escalation alerts',
        },
        {
          label: 'Complaints',
          path: ROUTES.COMPLAINTS,
          icon: Wrench,
          permission: PERMISSIONS.REQUESTS_VIEW,
          description: 'Resident complaints, electrical, plumbing & room issues',
        },
        {
          label: 'Maintenance',
          path: ROUTES.MAINTENANCE,
          icon: Hammer,
          permission: PERMISSIONS.HOSTEL_VIEW,
          description: 'Facility repair work orders and contractor schedules',
        },
      ],
    },
    {
      group: 'Dining & Communication',
      items: [
        {
          label: 'Mess & Food Menus',
          path: ROUTES.MESS,
          icon: UtensilsCrossed,
          permission: PERMISSIONS.HOSTEL_VIEW,
          description: 'Daily meal timings and weekly residential food menus',
        },
        {
          label: 'Notices & Broadcasts',
          path: ROUTES.ANNOUNCEMENTS,
          icon: Bell,
          permission: PERMISSIONS.HOSTEL_VIEW,
          description: 'Hostel circulars, warden announcements, and broadcasts',
        },
        {
          label: 'Documents & Records',
          path: ROUTES.DOCUMENTS,
          icon: FolderLock,
          permission: PERMISSIONS.PEOPLE_VIEW,
          description: 'Resident verification records and allotment slips',
        },
      ],
    },
    {
      group: 'Reports & Governance',
      items: [
        {
          label: 'Reports & Analytics',
          path: ROUTES.REPORTS,
          icon: BarChart3,
          permission: PERMISSIONS.REPORTS_VIEW,
          description: 'Occupancy statistics, attendance rates, and data export',
        },
        {
          label: 'Activity Stream',
          path: ROUTES.AUDIT,
          icon: History,
          permission: PERMISSIONS.HOSTEL_VIEW,
          description: 'Operational audit trail and recent incharge actions',
        },
      ],
    },
  ],
};

/**
 * Filter navigation items based on the user's granted permissions
 */
export function getFilteredNavigation(user) {
  if (!user) return INCHARGE_NAVIGATION;

  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  const hasFullInchargeAccess =
    user.role === 'HOSTEL_INCHARGE' || user.role === 'INCHARGE';

  const filteredGroups = INCHARGE_NAVIGATION.navGroups
    .map((grp) => {
      const items = grp.items.filter((item) => {
        if (!item.permission || hasFullInchargeAccess) return true;
        return permissions.includes(item.permission);
      });
      return { ...grp, items };
    })
    .filter((grp) => grp.items.length > 0);

  return {
    ...INCHARGE_NAVIGATION,
    navGroups: filteredGroups,
  };
}

/**
 * Derive active breadcrumbs based on current pathname
 */
export function resolveBreadcrumbs(pathname) {
  for (const group of INCHARGE_NAVIGATION.navGroups) {
    for (const item of group.items) {
      if (item.path === pathname) {
        return { group: group.group, title: item.label, description: item.description };
      }
    }
  }
  return { group: 'Hostel In-Charge', title: 'Dashboard', description: '' };
}

export default INCHARGE_NAVIGATION;

