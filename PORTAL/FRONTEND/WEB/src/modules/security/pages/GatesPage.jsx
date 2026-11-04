import React, { useState, useEffect, useCallback } from 'react';
import api from '../../../shared/api/api';
import {
  DoorOpen,
  Search,
  RefreshCw,
  LayoutGrid,
  List,
  CheckCircle2,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { LoadingState, EmptyState } from '../../../shared/components';

export default function SecurityGatesPage() {
  const [gates, setGates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [displayMode, setDisplayMode] = useState('CARDS');

  const loadGates = useCallback(async (manual = false) => {
    try {
      if (manual) setIsRefreshing(true);
      else setLoading(true);

      const res = await api.get('/college/gates');
      const d = res.data || res;
      setGates(Array.isArray(d) ? d : d?.gates || []);
    } catch (err) {
      console.error('Failed to load gates:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadGates();
  }, [loadGates]);

  const filtered = gates.filter((g) => {
    const q = search.toLowerCase();
    return (
      !search ||
      (g.name || '').toLowerCase().includes(q) ||
      (g.code || '').toLowerCase().includes(q) ||
      (g.gate_type || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="fade-in-up">
      {/* Enterprise Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <DoorOpen size={13} />
            <span>Perimeter Checkpoints</span>
          </div>
          <h1 className="hero-main-title">Campus Gate Checkpoints &amp; Terminals</h1>
          <p className="hero-subtitle">
            Configured perimeter gates, turnstile barriers, and physical security clearance checkpoints.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={() => loadGates(true)}
            disabled={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Checkpoints'}</span>
          </button>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <DoorOpen size={16} />
            </div>
            <h2 className="card-title-text">Registered Gate Checkpoints ({gates.length})</h2>
          </div>

          {/* View Switcher & Tally */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="stats-tally-pill" style={{ color: '#ea580c', background: '#ffedd5', borderColor: '#fed7aa' }}>
              <ShieldCheck size={12} />
              <span>{filtered.length} of {gates.length} Gates</span>
            </span>

            <div className="view-mode-toggle">
              <button
                type="button"
                className={`view-mode-btn ${displayMode === 'CARDS' ? 'active' : ''}`}
                onClick={() => setDisplayMode('CARDS')}
                title="Card Grid View"
              >
                <LayoutGrid size={13} />
                <span>Cards</span>
              </button>
              <button
                type="button"
                className={`view-mode-btn ${displayMode === 'TABLE' ? 'active' : ''}`}
                onClick={() => setDisplayMode('TABLE')}
                title="Table View"
              >
                <List size={13} />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="enterprise-filter-bar">
          <div className="filter-search-field">
            <Search size={14} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search gates by name, code, gate type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center' }}>
            <LoadingState message="Loading gate records..." />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center' }}>
            <EmptyState
              title="No gate checkpoints found"
              message="No campus gates match your search criteria or none are configured."
            />
          </div>
        ) : displayMode === 'CARDS' ? (
          /* Cards Grid */
          <div
            style={{
              padding: '16px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            {filtered.map((g, idx) => (
              <div
                key={g.id || idx}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: '#fff7ed',
                        color: '#ea580c',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <DoorOpen size={20} />
                    </div>
                    <div>
                      <strong style={{ color: '#0f172a', fontSize: '1rem', display: 'block' }}>
                        {g.name}
                      </strong>
                      <span className="code-pill" style={{ fontSize: '11px', fontWeight: 700 }}>
                        {g.code || `GATE-${100 + idx}`}
                      </span>
                    </div>
                  </div>

                  <span className="badge-enterprise badge-green">OPERATIONAL</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '10px', fontSize: '0.8rem', color: '#64748b' }}>
                  <span>Gate Classification:</span>
                  <span className="badge-enterprise badge-purple" style={{ fontSize: '10px' }}>
                    {g.gate_type || 'ENTRY_EXIT'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#059669' }}>
                  <CheckCircle2 size={13} />
                  <span>Biometric &amp; QR Terminal Online</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View */
          <div className="enterprise-table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Gate Name</th>
                  <th>Checkpoint Identifier</th>
                  <th>Gate Classification</th>
                  <th>Operational Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g, idx) => (
                  <tr key={g.id || idx}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: '#fff7ed',
                            color: '#ea580c',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <DoorOpen size={16} />
                        </div>
                        <strong style={{ color: '#0f172a', fontSize: '13.5px' }}>
                          {g.name}
                        </strong>
                      </div>
                    </td>
                    <td>
                      <span className="code-pill" style={{ fontWeight: 700 }}>
                        {g.code || `GATE-${100 + idx}`}
                      </span>
                    </td>
                    <td>
                      <span className="badge-enterprise badge-purple">
                        {g.gate_type || 'ENTRY_EXIT'}
                      </span>
                    </td>
                    <td>
                      <span className="badge-enterprise badge-green">
                        OPERATIONAL
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
