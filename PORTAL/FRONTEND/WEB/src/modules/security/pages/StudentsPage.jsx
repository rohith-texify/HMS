import React, { useState, useEffect, useCallback } from 'react';
import api from '../../../shared/api/api';
import {
  GraduationCap,
  Search,
  RefreshCw,
  CheckCircle2,
  Building2,
  Phone,
  Mail,
  UserCheck,
} from 'lucide-react';
import { LoadingState, EmptyState } from '../../../shared/components';

export default function SecurityStudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const loadStudents = useCallback(async (manual = false) => {
    try {
      if (manual) setIsRefreshing(true);
      else setLoading(true);

      const res = await api.get('/college/students');
      const d = res.data || res;
      setStudents(Array.isArray(d) ? d : d?.students || []);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const fullName = [s.first_name, s.last_name].filter(Boolean).join(' ') || s.name || '';
    const matchesSearch =
      !search ||
      fullName.toLowerCase().includes(q) ||
      (s.admission_number || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === 'ALL' || (s.status || 'ACTIVE').toUpperCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="fade-in-up">
      {/* Enterprise Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <GraduationCap size={13} />
            <span>Identity &amp; Biometric Lookup</span>
          </div>
          <h1 className="hero-main-title">Resident Student Verification &amp; Lookup</h1>
          <p className="hero-subtitle">
            Instantly verify student identity, admission numbers, residential block allocations, and gate security permissions.
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
            <span>{isRefreshing ? 'Syncing...' : 'Sync Students'}</span>
          </button>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <GraduationCap size={16} />
            </div>
            <h2 className="card-title-text">Enrolled Resident Students ({students.length})</h2>
          </div>

          <span className="badge-enterprise badge-purple">
            {filtered.length} Matching Profiles
          </span>
        </div>

        {/* Filter Toolbar */}
        <div className="enterprise-filter-bar">
          <div className="filter-search-field">
            <Search size={14} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search by student name, admission number, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Enrolled Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center' }}>
            <LoadingState message="Loading student records..." />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center' }}>
            <EmptyState
              title="No student records found"
              message="No resident students match your search criteria."
            />
          </div>
        ) : (
          <div className="enterprise-table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Student Profile</th>
                  <th>Admission Number</th>
                  <th>Contact Details</th>
                  <th>Academic Department</th>
                  <th>Clearance Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const fullName = [s.first_name, s.last_name].filter(Boolean).join(' ') || s.name || `Resident ${i + 1}`;
                  const initial = (s.first_name || s.name || 'S')[0].toUpperCase();

                  return (
                    <tr key={s.id || i}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '8px',
                              background: '#eff6ff',
                              color: '#2563eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '13px',
                            }}
                          >
                            {initial}
                          </div>
                          <div>
                            <strong style={{ color: '#0f172a', display: 'block', fontSize: '13.5px' }}>
                              {fullName}
                            </strong>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              {s.gender || 'Resident'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="code-pill" style={{ fontWeight: 700 }}>
                          {s.admission_number || s.enrollment_number || `ADM-${1000 + i}`}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px' }}>
                          {s.phone && (
                            <span style={{ color: '#475569' }}>
                              {s.phone}
                            </span>
                          )}
                          {s.email && (
                            <span style={{ color: '#64748b', fontSize: '11px' }}>
                              {s.email}
                            </span>
                          )}
                          {!s.phone && !s.email && <span style={{ color: '#94a3b8' }}>No direct contact</span>}
                        </div>
                      </td>

                      <td>
                        <span className="badge-enterprise badge-purple">
                          {s.department || s.course || 'Undergraduate'}
                        </span>
                      </td>

                      <td>
                        <span className="badge-enterprise badge-green">
                          {s.status || 'ACTIVE'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
