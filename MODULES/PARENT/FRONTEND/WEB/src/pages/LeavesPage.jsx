import React from 'react';
import { Link } from 'react-router-dom';
import PortalState from '../components/PortalState';

export default function LeavesPage() {
  return (
    <div className="portal-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Leave, outing &amp; gate-pass access</h2>
          <p className="page-description">
            Parent-authorized request access is unavailable until the required server-side ownership checks exist.
          </p>
        </div>
      </div>
      <PortalState
        variant="blocked"
        title="BLOCKED — Leave requests, outing and gate passes"
        message="Leave listing and details (GET /college/leaves and GET /college/leaves/:leave_id) require requests.view, which is present for Parent, but are college-scoped and do not verify Parent-to-Student ownership. The optional student_id filter is not authorization. Leave submission and cancellation (POST /college/leaves and POST /college/leaves/:leave_id/cancel) require requests.manage, which is not included for Parent; their service logic also does not verify Parent ownership. Leave summaries are college-wide, and no approval-history read endpoint was found. No outing or gate-pass endpoints were found; /college/gates manages gate configuration, not passes. The movement.view permission does not provide an outing or gate-pass endpoint. No request or student data is fetched."
        action={
          <Link to="/dashboard" className="btn btn-secondary">
            Return to overview
          </Link>
        }
      />
    </div>
  );
}
