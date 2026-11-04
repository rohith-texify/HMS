import React from 'react';
import { Link } from 'react-router-dom';
import PortalState from '../components/PortalState';

export default function StudentDetailPage() {
  return (
    <div className="portal-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Ward details</h2>
          <p className="page-description">
            Student profile information for your linked ward.
          </p>
        </div>
      </div>
      <PortalState
        variant="blocked"
        title="Ward profile access is unavailable"
        message="The student detail endpoint does not verify parent-student ownership, and the checked-in Parent permissions do not include people.view. No student record is requested or displayed."
        action={
          <Link to="/dashboard" className="btn btn-secondary">
            Return to overview
          </Link>
        }
      />
    </div>
  );
}
