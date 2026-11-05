/**
 * Permission check helpers for the Hostel In-Charge module
 */

export function hasPermission(user, requiredPermission) {
  if (!user || !requiredPermission) return false;
  // If user has permissions array, check presence
  if (Array.isArray(user.permissions)) {
    return user.permissions.includes(requiredPermission);
  }
  // By default, verified incharge roles possess core view permissions
  const role = String(user.role || '').toUpperCase();
  if (role === 'HOSTEL_INCHARGE' || role === 'INCHARGE') {
    return true;
  }
  return false;
}

export function hasAnyPermission(user, permissions = []) {
  if (!permissions.length) return true;
  return permissions.some((p) => hasPermission(user, p));
}

export function hasAllPermissions(user, permissions = []) {
  if (!permissions.length) return true;
  return permissions.every((p) => hasPermission(user, p));
}

export default {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
};

