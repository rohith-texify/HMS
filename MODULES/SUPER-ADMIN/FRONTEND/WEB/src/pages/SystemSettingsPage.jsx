import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchSystemSettings,
  updateSystemSetting,
  resetSystemSetting,
  revertSystemSetting,
  fetchSystemSettingsHistory,
  fetchTenantInheritanceOverview,
} from '../services/systemSettingsService';

export default function SystemSettingsPage() {
  const [activeTab, setActiveTab] = useState('security'); // 'security' | 'system' | 'maintenance' | 'inheritance' | 'history'
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Edit Modal State
  const [selectedSetting, setSelectedSetting] = useState(null);
  const [editJsonString, setEditJsonString] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);

  // History State
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyKeyFilter, setHistoryKeyFilter] = useState('');

  // Inheritance Overview State
  const [inheritanceList, setInheritanceList] = useState([]);
  const [inheritanceLoading, setInheritanceLoading] = useState(false);

  // Load Settings
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchSystemSettings();
      setSettings(res.settings || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load system settings');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load History
  const loadHistory = useCallback(async (key = '') => {
    try {
      setHistoryLoading(true);
      const res = await fetchSystemSettingsHistory(key);
      setHistoryList(res.history || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Load Tenant Inheritance Overview
  const loadInheritance = useCallback(async () => {
    try {
      setInheritanceLoading(true);
      const res = await fetchTenantInheritanceOverview();
      setInheritanceList(res.inheritance || []);
    } catch (err) {
      console.error('Failed to load inheritance overview:', err);
    } finally {
      setInheritanceLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory(historyKeyFilter);
    } else if (activeTab === 'inheritance') {
      loadInheritance();
    }
  }, [activeTab, historyKeyFilter, loadHistory, loadInheritance]);

  // Open Edit Modal
  const openEditModal = (st) => {
    setSelectedSetting(st);
    setEditJsonString(JSON.stringify(st.setting_value, null, 2));
    setEditReason('');
    setEditError(null);
  };

  // Submit Edit
  const handleSaveSetting = async () => {
    if (!selectedSetting) return;
    try {
      setEditSubmitting(true);
      setEditError(null);

      let parsedValue;
      try {
        parsedValue = JSON.parse(editJsonString);
      } catch (err) {
        setEditError('Invalid JSON format: ' + err.message);
        setEditSubmitting(false);
        return;
      }

      if (!editReason.trim() || editReason.trim().length < 3) {
        setEditError('A valid change reason is required (minimum 3 characters).');
        setEditSubmitting(false);
        return;
      }

      await updateSystemSetting(selectedSetting.setting_key, {
        setting_value: parsedValue,
        reason: editReason.trim(),
      });

      setFeedback({ type: 'success', text: `Setting '${selectedSetting.display_name}' updated successfully.` });
      setSelectedSetting(null);
      await loadSettings();
    } catch (err) {
      setEditError(err.response?.data?.error?.message || err.message || 'Failed to update setting');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Reset to Factory Default
  const handleResetSetting = async (st) => {
    const confirm = window.confirm(
      `Are you sure you want to reset '${st.display_name}' to company factory defaults?`
    );
    if (!confirm) return;

    const reason = window.prompt('Enter reason for factory reset:', 'Reset to company platform default');
    if (!reason) return;

    try {
      await resetSystemSetting(st.setting_key, reason);
      setFeedback({ type: 'success', text: `Setting '${st.display_name}' reset to factory default.` });
      await loadSettings();
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Failed to reset setting');
    }
  };

  // Rollback from History
  const handleRollback = async (h) => {
    const confirm = window.confirm(
      `Are you sure you want to roll back '${h.setting_key}' to the version from ${new Date(h.created_at).toLocaleString()}?`
    );
    if (!confirm) return;

    const reason = window.prompt('Enter reason for version rollback:', 'Reverting to stable previous version');
    if (!reason) return;

    try {
      await revertSystemSetting(h.setting_key, h.history_id, reason);
      setFeedback({ type: 'success', text: `Successfully rolled back '${h.setting_key}'.` });
      await loadSettings();
      if (activeTab === 'history') await loadHistory(historyKeyFilter);
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Failed to revert version');
    }
  };

  // Maintenance Quick Toggle
  const maintenanceSetting = settings.find((s) => s.setting_key === 'maintenance_mode');

  const filteredSettings = settings.filter((s) => {
    if (activeTab === 'security') return s.category === 'security';
    if (activeTab === 'system') return s.category === 'system' && s.setting_key !== 'maintenance_mode';
    if (activeTab === 'maintenance') return s.setting_key === 'maintenance_mode';
    return true;
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', color: '#f8fafc' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '2rem' }}>⚙️</span>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
              System Configuration & Platform Defaults
            </h1>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
              Manage authoritative company-wide settings, security baselines, maintenance mode, and tenant override policies.
            </p>
          </div>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: '8px',
            background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${feedback.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: feedback.type === 'success' ? '#6ee7b7' : '#fca5a5',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{feedback.text}</span>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.1rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #334155',
          marginBottom: '24px',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'security', label: '🔒 Security Policies & Baselines' },
          { id: 'system', label: '🛠️ Platform Defaults & Flags' },
          { id: 'maintenance', label: '🚨 Global Maintenance Mode' },
          { id: 'inheritance', label: '🏢 Tenant Inheritance Matrix' },
          { id: 'history', label: '📜 Version History & Rollback' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #38bdf8' : '2px solid transparent',
              background: 'none',
              color: activeTab === tab.id ? '#38bdf8' : '#94a3b8',
              fontWeight: activeTab === tab.id ? 600 : 500,
              fontSize: '0.95rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Maintenance Mode View */}
      {activeTab === 'maintenance' && maintenanceSetting && (
        <div
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 6px 0', color: '#f8fafc' }}>
                Global Maintenance Mode Killswitch
              </h2>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.875rem' }}>
                When activated, non-superadmin API access across all tenant portals is suspended with an informational banner.
              </p>
            </div>
            <button
              onClick={() => openEditModal(maintenanceSetting)}
              style={{
                padding: '8px 16px',
                background: '#0284c7',
                border: 'none',
                borderRadius: '6px',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Configure Maintenance
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              marginTop: '16px',
            }}
          >
            <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Status</div>
              <div
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  marginTop: '4px',
                  color: maintenanceSetting.setting_value?.enabled ? '#ef4444' : '#10b981',
                }}
              >
                {maintenanceSetting.setting_value?.enabled ? 'MAINTENANCE ACTIVE' : 'PLATFORM OPERATIONAL'}
              </div>
            </div>

            <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Banner Message</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 500, marginTop: '4px', color: '#cbd5e1' }}>
                {maintenanceSetting.setting_value?.banner_message || '(No broadcast message set)'}
              </div>
            </div>

            <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Scheduled End Time</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 500, marginTop: '4px', color: '#cbd5e1' }}>
                {maintenanceSetting.setting_value?.scheduled_end_time
                  ? new Date(maintenanceSetting.setting_value.scheduled_end_time).toLocaleString()
                  : 'Indefinite / Unscheduled'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Standard Settings Cards (Security or System) */}
      {(activeTab === 'security' || activeTab === 'system') && (
        <div>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              Loading platform configuration...
            </div>
          ) : error ? (
            <div style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', borderRadius: '8px' }}>
              {error}
            </div>
          ) : filteredSettings.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              No settings registered for this category.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: '20px' }}>
              {filteredSettings.map((st) => (
                <div
                  key={st.setting_key}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '10px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: '#f8fafc' }}>
                        {st.display_name}
                      </h3>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: st.allow_override ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: st.allow_override ? '#38bdf8' : '#fbbf24',
                          fontWeight: 600,
                        }}
                      >
                        {st.allow_override ? 'Tenant Override Allowed' : 'Strict Platform Baseline'}
                      </span>
                    </div>

                    <p style={{ margin: '0 0 14px 0', fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.4 }}>
                      {st.description}
                    </p>

                    {/* Minimum Baseline Alert */}
                    {st.min_value && (
                      <div
                        style={{
                          padding: '8px 12px',
                          background: 'rgba(59, 130, 246, 0.08)',
                          borderLeft: '3px solid #3b82f6',
                          borderRadius: '0 6px 6px 0',
                          marginBottom: '12px',
                          fontSize: '0.8rem',
                          color: '#93c5fd',
                        }}
                      >
                        <strong>Security Baseline Floor: </strong>
                        <code>{JSON.stringify(st.min_value)}</code>
                      </div>
                    )}

                    {/* Setting Value Preview */}
                    <div
                      style={{
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '12px',
                        fontFamily: 'monospace',
                        fontSize: '0.825rem',
                        color: '#a7f3d0',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {JSON.stringify(st.setting_value, null, 2)}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div
                    style={{
                      marginTop: '16px',
                      paddingTop: '12px',
                      borderTop: '1px solid #334155',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Updated: {new Date(st.updated_at).toLocaleDateString()}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleResetSetting(st)}
                        style={{
                          padding: '6px 12px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '6px',
                          color: '#fca5a5',
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Reset Default
                      </button>
                      <button
                        onClick={() => openEditModal(st)}
                        style={{
                          padding: '6px 14px',
                          background: '#0284c7',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#ffffff',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Edit Policy
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Tenant Inheritance Matrix */}
      {activeTab === 'inheritance' && (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Tenant Inheritance & Override Matrix</h3>
            <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
              Tracks which tenant colleges inherit company defaults versus those maintaining explicit custom configurations.
            </p>
          </div>

          {inheritanceLoading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>Analyzing tenant configurations...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                  <th style={{ padding: '12px 16px' }}>Policy Key</th>
                  <th style={{ padding: '12px 16px' }}>Category</th>
                  <th style={{ padding: '12px 16px' }}>Total Active Tenants</th>
                  <th style={{ padding: '12px 16px' }}>Inherited Defaults</th>
                  <th style={{ padding: '12px 16px' }}>Custom Overrides</th>
                  <th style={{ padding: '12px 16px' }}>Override Permission</th>
                </tr>
              </thead>
              <tbody>
                {inheritanceList.map((item) => (
                  <tr key={item.setting_key} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#f8fafc' }}>
                      {item.display_name}
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                        {item.setting_key}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8', textTransform: 'capitalize' }}>
                      {item.category}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>{item.total_tenants}</td>
                    <td style={{ padding: '12px 16px', color: '#10b981', fontWeight: 600 }}>
                      {item.inherited_tenants} colleges
                    </td>
                    <td style={{ padding: '12px 16px', color: item.overridden_tenants > 0 ? '#38bdf8' : '#64748b' }}>
                      {item.overridden_tenants} colleges
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: item.allow_tenant_override ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: item.allow_tenant_override ? '#6ee7b7' : '#fca5a5',
                          fontWeight: 600,
                        }}
                      >
                        {item.allow_tenant_override ? 'Permitted' : 'Locked Global'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Version History & Rollback */}
      {activeTab === 'history' && (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #334155',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Configuration Version History & Audit</h3>
              <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                Inspect timestamped modifications, change rationale, and execute one-click rollbacks.
              </p>
            </div>
            <select
              value={historyKeyFilter}
              onChange={(e) => setHistoryKeyFilter(e.target.value)}
              style={{
                padding: '6px 12px',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#f8fafc',
                fontSize: '0.85rem',
              }}
            >
              <option value="">All Settings</option>
              {settings.map((s) => (
                <option key={s.setting_key} value={s.setting_key}>
                  {s.display_name}
                </option>
              ))}
            </select>
          </div>

          {historyLoading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>Loading version trail...</div>
          ) : historyList.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              No configuration history recorded yet.
            </div>
          ) : (
            <div style={{ padding: '16px' }}>
              {historyList.map((h) => (
                <div
                  key={h.history_id}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: h.action === 'UPDATE' ? '#0369a1' : h.action === 'REVERT' ? '#b45309' : '#475569',
                          color: '#ffffff',
                          fontWeight: 600,
                          marginRight: '8px',
                        }}
                      >
                        {h.action}
                      </span>
                      <strong style={{ color: '#f8fafc' }}>{h.setting_key}</strong>
                      <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '12px' }}>
                        by {h.actor_role} at {new Date(h.created_at).toLocaleString()}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRollback(h)}
                      style={{
                        padding: '4px 10px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        borderRadius: '4px',
                        color: '#fbbf24',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Rollback to this version
                    </button>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '10px' }}>
                    <strong>Reason: </strong> {h.reason}
                  </div>

                  <div
                    style={{
                      background: '#020617',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      fontSize: '0.775rem',
                      color: '#a7f3d0',
                      maxHeight: '120px',
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {JSON.stringify(h.new_value, null, 2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Configuration Modal Drawer */}
      {selectedSetting && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '650px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 4px 0', color: '#f8fafc' }}>
              Edit Platform Policy: {selectedSetting.display_name}
            </h2>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Setting Key: <code>{selectedSetting.setting_key}</code>
            </p>

            {editError && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  borderRadius: '6px',
                  color: '#fca5a5',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                }}
              >
                {editError}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Configuration JSON Payload
              </label>
              <textarea
                value={editJsonString}
                onChange={(e) => setEditJsonString(e.target.value)}
                rows={10}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  padding: '10px',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Audit Change Reason (Mandatory)
              </label>
              <input
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="e.g. Updating platform password floor per Q4 compliance audit"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  padding: '10px',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setSelectedSetting(null)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSetting}
                disabled={editSubmitting}
                style={{
                  padding: '8px 20px',
                  background: '#0284c7',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontWeight: 600,
                  cursor: editSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {editSubmitting ? 'Saving...' : 'Apply Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
