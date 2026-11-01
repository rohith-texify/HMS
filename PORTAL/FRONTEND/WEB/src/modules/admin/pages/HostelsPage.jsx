import React, { useState, useEffect } from 'react';
import api from '../../../shared/api/api';
import {
  Building2,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';

export default function AdminHostelsPage() {
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState('ALL');

  const loadHostels = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);

    try {
      const res = await api.get('/college/hostels');
      const d = res.data || res;
      setHostels(Array.isArray(d) ? d : d?.hostels || []);
    } catch (err) {
      console.error('Failed to load hostels:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadHostels();
  }, []);

  const filteredHostels = hostels.filter((h) => {
    const q = searchTerm.toLowerCase();
    const name = (h.name || '').toLowerCase();
    const code = (h.code || '').toLowerCase();
    const matchesSearch = !q || name.includes(q) || code.includes(q);

    const type = (h.type || '').toUpperCase();
    const matchesGender =
      genderFilter === 'ALL' ||
      (genderFilter === 'MENS' && type.includes('MEN')) ||
      (genderFilter === 'WOMENS' && type.includes('WOMEN')) ||
      (genderFilter === 'CO-ED' && type.includes('CO'));

    return matchesSearch && matchesGender;
  });

  const totalBeds = hostels.reduce((sum, h) => {
    const c = parseInt(h.capacity, 10);
    return sum + (isNaN(c) ? 120 : c);
  }, 0);

  return (
    <div className="fade-in-up">
      {/* Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <Building2 size={13} />
            <span>Facility Management</span>
          </div>
          <h1 className="hero-main-title">Hostels & Building Blocks</h1>
          <p className="hero-subtitle">
            Configure residential campus buildings, wings, floors, and room capacity allocations.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={() => loadHostels(true)}
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
            <span className="stat-kpi-label">Total Facilities</span>
            <div className="stat-kpi-icon-wrap emerald">
              <Building2 size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-emerald-600">{hostels.length}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Active registered buildings</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Total Bed Spaces</span>
            <div className="stat-kpi-icon-wrap blue">
              <Sparkles size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{totalBeds}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Across all managed blocks</span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <Building2 size={16} />
            </div>
            <h2 className="card-title-text">Hostel Inventory Master</h2>
          </div>
          <span className="badge-enterprise badge-blue">
            {filteredHostels.length} of {hostels.length} Showing
          </span>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="enterprise-filter-bar">
          <div className="filter-search-field">
            <Search size={14} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search by block name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {['ALL', 'MENS', 'WOMENS', 'CO-ED'].map((filterOption) => (
              <button
                key={filterOption}
                type="button"
                onClick={() => setGenderFilter(filterOption)}
                className={`btn-enterprise-secondary ${
                  genderFilter === filterOption ? 'active' : ''
                }`}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  backgroundColor: genderFilter === filterOption ? '#eff6ff' : '#ffffff',
                  borderColor: genderFilter === filterOption ? '#bfdbfe' : '#e2e8f0',
                  color: genderFilter === filterOption ? '#2563eb' : '#475569',
                }}
              >
                {filterOption}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="enterprise-table-container">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Hostel Name</th>
                <th>Building Code</th>
                <th>Facility Type</th>
                <th>Bed Capacity</th>
                <th>Operational Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredHostels.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '36px' }}>
                    {loading ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <span className="portal-spinner" style={{ width: '16px', height: '16px' }} />
                        <span>Loading hostel structures...</span>
                      </div>
                    ) : (
                      'No hostel blocks match your filters.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredHostels.map((h, idx) => (
                  <tr key={h.id || idx}>
                    <td>
                      <strong style={{ color: '#0f172a' }}>
                        {h.name || 'Hostel Block ' + (idx + 1)}
                      </strong>
                    </td>
                    <td>
                      <span className="code-pill">{h.code || 'B-' + (idx + 1)}</span>
                    </td>
                    <td>
                      <span className="badge-enterprise badge-blue">{h.type || 'CO-ED'}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#334155' }}>
                        {h.capacity || '100'} Beds
                      </span>
                    </td>
                    <td>
                      <span className="badge-enterprise badge-green">
                        {h.status || 'ACTIVE'}
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
