/**
 * Canonical verified permission codes for Hostel In-Charge operations
 * Ground truth from DATABASE/migrations/001_platform.sql & 903_seed.sql
 */
export const PERMISSIONS = {
  HOSTEL_VIEW: 'hostel.view',
  HOSTEL_MANAGE: 'hostel.manage',
  PEOPLE_VIEW: 'people.view',
  PEOPLE_MANAGE: 'people.manage',
  MOVEMENT_VIEW: 'movement.view',
  MOVEMENT_MANAGE: 'movement.manage',
  REQUESTS_VIEW: 'requests.view',
  REQUESTS_MANAGE: 'requests.manage',
  SUPPORT_VIEW: 'support.view',
  SUPPORT_MANAGE: 'support.manage',
  REPORTS_VIEW: 'reports.view',
  REPORTS_MANAGE: 'reports.manage',
};

export default PERMISSIONS;

