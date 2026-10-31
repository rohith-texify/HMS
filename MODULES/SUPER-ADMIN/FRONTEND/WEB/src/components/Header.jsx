import React from 'react';
import { Link } from 'react-router-dom';
import { RotateCw, Plus, CheckSquare, Sparkles } from 'lucide-react';

export default function Header({ onRefresh, isRefreshing, generatedAt }) {
  return (
    <div className="shopeers-hero-header">
      <div className="shopeers-hero-left">
        <div className="shopeers-hero-pill">
          <Sparkles size={14} className="shopeers-sparkle-icon" />
          <span>Texify AI-Powered Enterprise Engine</span>
        </div>
        <h1 className="shopeers-hero-title">Super Admin Intelligence Center</h1>
        <p className="shopeers-hero-subtitle">
          Platform-wide health, multi-tenant college lifecycle, module entitlements, and real-time operational telemetry.
          {generatedAt && (
            <span className="shopeers-timestamp-badge">
              • Synced {new Date(generatedAt).toLocaleTimeString()}
            </span>
          )}
        </p>
      </div>

      <div className="shopeers-hero-actions">
        <button
          className={`shopeers-action-btn secondary ${isRefreshing ? 'refreshing' : ''}`}
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh dashboard telemetry"
        >
          <RotateCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
          <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
        </button>

        <Link
          to="/approvals"
          className="shopeers-action-btn secondary"
          id="btn-review-approvals"
        >
          <CheckSquare size={15} />
          <span>Review Approvals</span>
        </Link>

        <Link
          to="/colleges/new"
          className="shopeers-action-btn primary"
          id="btn-create-college"
        >
          <Plus size={16} />
          <span>Create College</span>
        </Link>
      </div>
    </div>
  );
}
