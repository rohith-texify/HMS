import React, { useState, useEffect } from 'react';
import api from '../../../shared/api/api';
import {
  Users,
  Search,
  RefreshCw,
  Mail,
  ShieldCheck,
  Building2,
  CheckCircle2,
} from 'lucide-react';

export default function AdminStaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadStaff = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);

    try {
      const res = await api.get('/college/staff');
      const d = res.data || res;
      setStaff(Array.isArray(d) ? d : d?.staff || []);
    } catch (err) {
      console.error('Failed to load staff:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const filteredStaff = staff.filter((st) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    const name = (st.name || st.first_name || '').toLowerCase();
    const code = (st.code || '').toLowerCase();
    const email = (st.email || '').toLowerCase();
    const des = (st.designation || '').toLowerCase();
    return name.includes(q) || code.includes(q) || email.includes(q) || des.includes(q);
  });

  return (
    <div className="fade-in-up">
      {/* Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <Users size={13} />
            <span>Human Resources</span>
          </div>
          <h1 className="hero-main-title">College Staff & In-Charges</h1>
          <p className="hero-subtitle">
            Manage authorized campus personnel, residential wardens, and supervisory caretaking staff.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={() => loadStaff(true)}
            disabled={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="kpi-cards-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Active Staff Members</span>
            <div className="stat-kpi-icon-wrap purple">
              <Users size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">{staff.length}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Verified institutional staff</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Supervisory Wardens</span>
            <div className="stat-kpi-icon-wrap blue">
              <ShieldCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">
            {staff.filter((s) => (s.designation || '').toLowerCase().includes('warden')).length || staff.length}
          </div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Assigned to hostel wings</span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <Users size={16} />
            </div>
            <h2 className="card-title-text">Staff Roster Directory</h2>
          </div>
          <span className="badge-enterprise badge-purple">
            {filteredStaff.length} of {staff.length} Showing
          </span>
        </div>

        {/* Filter Toolbar */}
        <div className="enterprise-filter-bar">
          <div className="filter-search-field">
            <Search size={14} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search staff by name, code, designation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="enterprise-table-container">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Staff Name</th>
                <th>Staff Code</th>
                <th>Designation</th>
                <th>Institutional Email</th>
                <th>Duty Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '36px' }}>
                    {loading ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <span className="portal-spinner" style={{ width: '16px', height: '16px' }} />
                        <span>Loading staff directory...</span>
                      </div>
                    ) : (
                      'No staff members match your search.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredStaff.map((st, idx) => (
                  <tr key={st.id || idx}>
                    <td>
                      <strong style={{ color: '#0f172a' }}>
                        {st.name || (st.first_name ? `${st.first_name} ${st.last_name || ''}` : `Staff Member #${idx + 1}`)}
                      </strong>
                    </td>
                    <td>
                      <span className="code-pill">{st.code || 'STF-' + (200 + idx)}</span>
                    </td>
                    <td>
                      <span className="badge-enterprise badge-purple">
                        {st.designation || 'Warden'}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Mail size={13} style={{ color: '#94a3b8' }} />
                        <span>{st.email || '—'}</span>
                      </span>
                    </td>
                    <td>
                      <span className="badge-enterprise badge-green">
                        {st.status || 'ACTIVE'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
