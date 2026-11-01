import React from 'react';
import { Link } from 'react-router-dom';
import { Users, ArrowRight } from 'lucide-react';

export default function CollegeAdminSummary({ summary }) {
  if (!summary) return null;

  return (
    <div className="card enterprise-card">
      <div className="card-header">
        <div className="card-title">
          <Users size={18} className="text-indigo-600" />
          <span>Active Administrators</span>
        </div>
        <span className="badge-enterprise badge-indigo">Platform Verified</span>
      </div>

      <div className="admin-summary-content">
        <div className="admin-summary-stat">
          <div className="stat-big-number text-indigo-600">
            {summary.active_count}
          </div>
          <div className="stat-big-label">
            Active College Administrator Accounts
          </div>
        </div>
      </div>

      <div className="card-footer-action">
        <Link to="/staff" className="card-footer-link">
          <span>Manage Company Staff & Admins</span>
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
