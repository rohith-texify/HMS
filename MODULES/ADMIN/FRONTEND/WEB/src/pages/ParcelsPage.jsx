import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/auth/useAuth';
import adminService from '../services/adminService';
import {
  Package,
  Mail,
  ShieldCheck,
  Clock,
  DoorClosed,
  Info,
  Search,
  RefreshCw,
  Building2,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Calendar,
} from 'lucide-react';
import {
  PageHeader,
  DataTable,
  SearchInput,
  FilterControls,
  Modal,
  FormField,
  LoadingState,
  EmptyState,
  ErrorState,
} from '../../../shared/components';

export default function AdminParcelsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Master Data State
  const [gates, setGates] = useState([]);
  const [securityAssignments, setSecurityAssignments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [hostels, setHostels] = useState([]);

  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Quick lookup dictionary for hostels
  const hostelMap = useMemo(() => {
    const map = new Map();
    hostels.forEach((h) => map.set(h.id, h));
    return map;
  }, [hostels]);

  // =========================================================================
  // Master Data Fetching
  // =========================================================================
  const loadParcelContext = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const [gatesRes, secRes, staffRes, hostelsRes] = await Promise.allSettled([
        adminService.getGates(),
        adminService.getSecurityAssignments(),
        adminService.getStaff(),
        adminService.getHostels(),
      ]);

      if (gatesRes.status === 'fulfilled') {
        const raw = gatesRes.value;
        setGates(Array.isArray(raw) ? raw : raw?.gates || []);
      }

      if (secRes.status === 'fulfilled') {
        const rawSec = secRes.value;
        setSecurityAssignments(Array.isArray(rawSec) ? rawSec : rawSec?.assignments || []);
      }

      if (staffRes.status === 'fulfilled') {
        const rawStaff = staffRes.value;
        setStaffList(Array.isArray(rawStaff) ? rawStaff : rawStaff?.staff || []);
      }

      if (hostelsRes.status === 'fulfilled') {
        const rawH = hostelsRes.value;
        setHostels(Array.isArray(rawH) ? rawH : rawH?.hostels || []);
      }
    } catch (err) {
      console.error('Failed to load parcel checkpoint context:', err);
      setErrorMessage('Failed to load intake gate checkpoints.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadParcelContext();
  }, [loadParcelContext]);

  return (
    <div className="enterprise-module-page">
      {/* Header Bar */}
      <div className="enterprise-page-header">
        <div className="header-text-group">
          <div className="header-title-row">
            <div className="header-icon-badge">
              <Package size={22} />
            </div>
            <div>
              <h1 className="header-title">Student Parcels & Mailroom</h1>
              <p className="header-subtitle">
                Courier parcel reception, delivery checkpoints, and resident package intake security.
              </p>
            </div>
          </div>
        </div>

        <div className="header-actions-group">
          <button
            type="button"
            className="action-btn-secondary"
            onClick={() => loadParcelContext(true)}
            disabled={isRefreshing || loading}
            title="Refresh Checkpoint Data"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Architecture Honesty Banner */}
      <div
        style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '24px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
        }}
      >
        <Info size={18} style={{ color: '#2563eb', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '13px', color: '#1e40af', lineHeight: 1.5 }}>
          <strong>Backend Service Notice:</strong> While the PostgreSQL parcel schema (<code>app.parcels</code>)
          is provisioned in migration <code>006_requests.sql</code>, the corresponding Go backend HTTP handlers (
          <code>/college/parcels</code>) are scheduled for subsequent release. In accordance with HMS data
          integrity rules, no synthetic deliveries or simulated package statuses are displayed. Live delivery
          intake checkpoints and parcel management procedures are shown below.
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Delivery Checkpoints</span>
            <div className="stat-kpi-icon-wrap blue">
              <DoorClosed size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{gates.length}</div>
          <div className="stat-kpi-footnote">
            <span>Designated courier drop gates</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Intake Staff On Duty</span>
            <div className="stat-kpi-icon-wrap purple">
              <ShieldCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">
            {securityAssignments.filter((s) => s.status === 'ACTIVE').length}
          </div>
          <div className="stat-kpi-footnote">
            <span>Security officers logging intake</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Courier Hours</span>
            <div className="stat-kpi-icon-wrap emerald">
              <Clock size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-emerald-600">09:00 - 17:00</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Campus intake window</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Retention Period</span>
            <div className="stat-kpi-icon-wrap orange">
              <Package size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-orange-600">7 DAYS</div>
          <div className="stat-kpi-footnote">
            <span>Unclaimed parcel policy</span>
          </div>
        </div>
      </div>

      {/* Designated Parcel Intake Points */}
      <div className="enterprise-card" style={{ marginBottom: '24px' }}>
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <Package size={16} />
            </div>
            <h2 className="card-title-text">Authorized Courier Intake Gates</h2>
          </div>
          <span className="badge-enterprise badge-emerald">
            {gates.length} Checkpoints Configured
          </span>
        </div>

        <div className="enterprise-table-container">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Intake Point</th>
                <th>Gate Identifier</th>
                <th>Intake Type</th>
                <th>Hostel Association</th>
                <th>Physical Location</th>
                <th>Intake Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px 0' }}>
                    <LoadingState message="Loading parcel intake points..." />
                  </td>
                </tr>
              ) : gates.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px 0' }}>
                    <EmptyState
                      icon={Package}
                      title="No intake checkpoints registered"
                      description="Perimeter gates have not been configured yet."
                    />
                  </td>
                </tr>
              ) : (
                gates.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{g.name}</div>
                    </td>
                    <td>
                      <code>{g.code}</code>
                    </td>
                    <td>
                      <span className="badge-enterprise badge-blue">{g.gate_type}</span>
                    </td>
                    <td>
                      {g.hostel_id ? hostelMap.get(g.hostel_id)?.name || 'Hostel Boundary' : 'Central Mailroom Point'}
                    </td>
                    <td>{g.location_description || 'Main security intake station'}</td>
                    <td>
                      {g.status === 'ACTIVE' ? (
                        <span className="badge-enterprise badge-emerald">ACCEPTING PACKAGES</span>
                      ) : (
                        <span className="badge-enterprise badge-slate">SUSPENDED</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Package Intake Protocol */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <Mail size={16} />
            </div>
            <h2 className="card-title-text">Mailroom & Courier Handling Rules</h2>
          </div>
        </div>

        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
              1. Central Gate Reception
            </div>
            <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
              All external courier delivery agents (Amazon, Flipkart, India Post, DHL) must deliver packages to designated
              perimeter security checkpoints. Delivery personnel are not authorized inside residential blocks.
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
              2. Student ID Verification Upon Claim
            </div>
            <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
              Residents must present their student RFID ID card or show their institutional portal profile matching the recipient
              name prior to parcel handover.
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
              3. Unclaimed Parcel Disposition
            </div>
            <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
              Packages uncollected after 7 business days will receive an institutional notification reminder before being returned
              to sender or moved to central storage.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

