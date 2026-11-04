import { useMemo } from 'react';
import { useAuth } from './useAuth';
import {
  hasPermission as checkHasPermission,
  hasAnyPermission as checkHasAnyPermission,
  hasAllPermissions as checkHasAllPermissions,
} from '../utils/permissionUtils';

export function usePermissions() {
  const { user } = useAuth();

  const helpers = useMemo(() => {
    return {
      hasPermission: (permission) => checkHasPermission(user, permission),
      hasAnyPermission: (permissions) => checkHasAnyPermission(user, permissions),
      hasAllPermissions: (permissions) => checkHasAllPermissions(user, permissions),
      canAccessRoute: (requiredPermission) => {
        if (!requiredPermission) return true;
        return checkHasPermission(user, requiredPermission);
      },
      canPerformAction: (requiredPermission) => {
        if (!requiredPermission) return true;
        return checkHasPermission(user, requiredPermission);
      },
    };
  }, [user]);

  return helpers;
}

export default usePermissions;

