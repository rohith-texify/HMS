import React from 'react';
import { Link } from 'react-router-dom';

export default function ApprovalsPage() {
  return (
    <div className="card">
      <div className="card-header">
        <h1 className="card-title">📋 Approval Requests Queue</h1>
        <Link to="/dashboard" className="btn btn-outline btn-sm">
          ← Back to Dashboard
        </Link>
      </div>

      <div style={{ padding: '20px 0' }}>
        <div className="empty-box">
          <p className="empty-text">
            Maker-Checker Approval Queue. Platform operations requiring dual authorization appear here for review and execution.
          </p>
        </div>
      </div>
    </div>
  );
}
