import React from 'react';
import { Link } from 'react-router-dom';
import { RotateCw, Plus, FileCheck } from 'lucide-react';

export default function Header({ onRefresh, isRefreshing, generatedAt }) {
  return (
    <div className="dashboard-hero-header">
      <div className="hero-text-block">
        <h1 className="hero-page-title">Super Admin Dashboard</h1>
        <p className="hero-page-subtitle">
          Manage colleges, administrators and platform operations.
        </p>
      </div>

      <div className="hero-actions-cluster">
        {/* Refresh Action */}
        <button
          type="button"
          className={`btn-enterprise btn-outline-soft ${isRefreshing ? 'is-loading' : ''}`}
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh dashboard data"
        >
          <RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>

        {/* Review Approvals Action */}
        <Link
          to="/approvals"
          className="btn-enterprise btn-outline-soft"
          id="btn-review-approvals"
        >
          <FileCheck size={14} />
          <span>Review Approvals</span>
        </Link>

        {/* Create College Primary Action */}
        <Link
          to="/colleges/new"
          className="btn-enterprise btn-primary-blue"
          id="btn-create-college"
        >
          <Plus size={15} />
          <span>Create College</span>
        </Link>
      </div>
    </div>
  );
}
