import React, { useState, useEffect } from 'react';
import api from '../../../shared/api/api';
import {
  GraduationCap,
  Search,
  RefreshCw,
  Phone,
  Mail,
  UserCheck,
} from 'lucide-react';

export default function AdminStudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadStudents = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);

    try {
      const res = await api.get('/college/students');
      const d = res.data || res;
      setStudents(Array.isArray(d) ? d : d?.students || []);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const filteredStudents = students.filter((s) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    const name = (s.first_name ? `${s.first_name} ${s.last_name || ''}` : s.name || '').toLowerCase();
    const adm = (s.admission_number || s.code || '').toLowerCase();
    const contact = (s.phone || s.email || '').toLowerCase();
    return name.includes(q) || adm.includes(q) || contact.includes(q);
  });

  return (
    <div className="fade-in-up">
      {/* Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <GraduationCap size={13} />
            <span>Admissions & Residents</span>
          </div>
          <h1 className="hero-main-title">Student Directory</h1>
          <p className="hero-subtitle">
            Manage residential hostel student profiles, room allotments, and emergency parent contacts.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={() => loadStudents(true)}
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
            <span className="stat-kpi-label">Total Registered Students</span>
            <div className="stat-kpi-icon-wrap blue">
              <GraduationCap size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{students.length}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Enrolled in campus hostels</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Active Residents</span>
            <div className="stat-kpi-icon-wrap emerald">
              <UserCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-emerald-600">
            {students.filter((s) => (s.status || '').toUpperCase() === 'ENROLLED' || !s.status).length}
          </div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Currently assigned bed allocations</span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <GraduationCap size={16} />
            </div>
            <h2 className="card-title-text">Enrolled Resident Students</h2>
          </div>
          <span className="badge-enterprise badge-blue">
            {filteredStudents.length} of {students.length} Showing
          </span>
        </div>

        {/* Filter Toolbar */}
        <div className="enterprise-filter-bar">
          <div className="filter-search-field">
            <Search size={14} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search by student name, admission no, or phone..."
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
                <th>Student Name</th>
                <th>Admission No</th>
                <th>Gender</th>
                <th>Contact Details</th>
                <th>Enrollment Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '36px' }}>
                    {loading ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <span className="portal-spinner" style={{ width: '16px', height: '16px' }} />
                        <span>Loading student directory...</span>
                      </div>
                    ) : (
                      'No students match your search criteria.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => (
                  <tr key={s.id || idx}>
                    <td>
                      <strong style={{ color: '#0f172a' }}>
                        {s.first_name ? `${s.first_name} ${s.last_name || ''}` : s.name || `Student #${idx + 1}`}
                      </strong>
                    </td>
                    <td>
                      <span className="code-pill">
                        {s.admission_number || s.code || 'ADM-' + (1000 + idx)}
                      </span>
                    </td>
                    <td>
                      <span className="badge-enterprise badge-blue">
                        {s.gender || '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {s.phone ? <Phone size={13} style={{ color: '#94a3b8' }} /> : <Mail size={13} style={{ color: '#94a3b8' }} />}
                        <span>{s.phone || s.email || '—'}</span>
                      </span>
                    </td>
                    <td>
                      <span className="badge-enterprise badge-green">
                        {s.status || 'ENROLLED'}
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
