import React from 'react';
import { Link } from 'react-router-dom';
import PortalState from '../components/PortalState';

export default function LeavesPage() {
  return (
    <div className="portal-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Leave history</h2>
          <p className="page-description">
            Leave records associated with your linked ward.
          </p>
        </div>
      </div>
      <PortalState
        variant="blocked"
        title="Parent-scoped leave history is unavailable"
        message="The available leave endpoint can return college-wide records and does not verify parent-student ownership. The requests.view permission alone does not establish that relationship. No leave records are requested or displayed."
        action={
          <Link to="/dashboard" className="btn btn-secondary">
            Return to overview
          </Link>
        }
      />
    </div>
  );
}
