import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import UnauthorizedState from '../components/UnauthorizedState';

export default function PermissionRoute({ children, permission }) {
  const { canAccessRoute } = usePermissions();

  if (permission && !canAccessRoute(permission)) {
    return (
      <div style={{ padding: '24px' }}>
        <UnauthorizedState
          title="Operation Restricted"
          message={`You lack the required operational permission (${permission}) to view this feature.`}
        />
      </div>
    );
  }

  return children;
}

