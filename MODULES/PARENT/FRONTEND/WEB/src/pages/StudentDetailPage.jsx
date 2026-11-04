import React from 'react';
import { Link } from 'react-router-dom';
import PortalState from '../components/PortalState';

export default function StudentDetailPage() {
  return (
    <div className="portal-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Student profile & accommodation</h2>
          <p className="page-description">
            Profile and accommodation information for a student linked to your Parent account.
          </p>
        </div>
      </div>

      <div className="profile-access-grid">
        <PortalState
          variant="blocked"
          title="BLOCKED — Student profile"
          message="GET /college/students/:student_id requires people.view, which is not included in the checked-in Parent permission set. The endpoint is college-scoped and does not verify that the requested student is linked to the authenticated Parent. No student data is requested or displayed."
        />
        <PortalState
          variant="blocked"
          title="BLOCKED — Current accommodation"
          message="The current bed-allocation endpoint requires people.view and accepts a student_id query parameter without checking Parent ownership. The Parent hostel.view permission does not authorize this endpoint. No accommodation details are requested or inferred."
        />
        <PortalState
          variant="blocked"
          title="BLOCKED — Accommodation history"
          message="The bed-allocation list is college-scoped, requires people.view, and has no verified Parent ownership check or pagination contract. No history is requested or synthesized."
        />
        <PortalState
          variant="blocked"
          title="BLOCKED — Student documents"
          message="No existing student-document endpoint and Parent authorization contract were found in the inspected API. Documents cannot be viewed or downloaded."
        />
      </div>

      <div className="profile-access-return">
        <Link to="/dashboard" className="btn btn-secondary">
          Return to overview
        </Link>
      </div>
    </div>
  );
}
