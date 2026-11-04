import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../../shared/auth/useAuth';
import adminService from '../services/adminService';
import {
  Utensils,
  Clock,
  Calendar,
  Coffee,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Building2,
  Sparkles,
  Star,
  Send,
  MessageSquare,
  ChevronRight,
  Info,
  CalendarDays,
  ShieldCheck,
  LayoutGrid,
  List,
} from 'lucide-react';
import {
  Modal,
  LoadingState,
  EmptyState,
} from '../../../shared/components';

export default function AdminFoodPage() {
  const { user } = useAuth();

  // Permission checks
  const canManageMess = useMemo(() => {
    if (!user) return true;
    if (['COLLEGE_ADMIN', 'ADMIN', 'HOSTEL_ADMIN'].includes(user?.role)) return true;
    if (Array.isArray(user?.permissions)) {
      return (
        user.permissions.includes('hostel.manage') ||
        user.permissions.includes('*')
      );
    }
    return true;
  }, [user]);

  // Master Data State
  const [hostels, setHostels] = useState([]);
  const [selectedHostelId, setSelectedHostelId] = useState('');
  const [todayMenus, setTodayMenus] = useState([]);
  const [hostelMenus, setHostelMenus] = useState([]);
  const [mealTimings, setMealTimings] = useState([]);
  const [students, setStudents] = useState([]);

  // UI Tabs & Loading States
  const [activeTab, setActiveTab] = useState('TODAY'); // 'TODAY' | 'MENUS' | 'TIMINGS' | 'FEEDBACK'
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [mealTypeFilter, setMealTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [displayMode, setDisplayMode] = useState('CARDS'); // 'CARDS' | 'TABLE'

  // Modals Visibility
  const [createMenuModalOpen, setCreateMenuModalOpen] = useState(false);
  const [createTimingModalOpen, setCreateTimingModalOpen] = useState(false);
  const [createFeedbackModalOpen, setCreateFeedbackModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Menu Form State
  const [menuFormData, setMenuFormData] = useState({
    hostel_id: '',
    menu_date: new Date().toISOString().split('T')[0],
    meal_type: 'BREAKFAST',
    items: '',
  });

  // Timing Form State
  const [timingFormData, setTimingFormData] = useState({
    hostel_id: '',
    meal_type: 'BREAKFAST',
    start_time: '07:30',
    end_time: '09:30',
  });

  // Feedback Form State
  const [feedbackFormData, setFeedbackFormData] = useState({
    student_id: '',
    menu_id: '',
    rating: 5,
    comment: '',
  });

  // Initial Fetch: Hostels, Today Menus, Students
  const loadInitialData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setIsRefreshing(true);
      else setLoading(true);
      setErrorMessage(null);

      const [hostelsRes, todayRes, studentsRes] = await Promise.allSettled([
        adminService.getHostels(),
        adminService.getTodayMenus(),
        adminService.getStudents({ limit: 100 }),
      ]);

      const hostelList = hostelsRes.status === 'fulfilled'
        ? (Array.isArray(hostelsRes.value) ? hostelsRes.value : hostelsRes.value?.hostels || hostelsRes.value?.data || [])
        : [];
      setHostels(hostelList);

      if (hostelList.length > 0 && !selectedHostelId) {
        setSelectedHostelId(hostelList[0].id);
      }

      const todayList = todayRes.status === 'fulfilled'
        ? (Array.isArray(todayRes.value) ? todayRes.value : todayRes.value?.data || [])
        : [];
      setTodayMenus(todayList);

      const studentList = studentsRes.status === 'fulfilled'
        ? (Array.isArray(studentsRes.value) ? studentsRes.value : studentsRes.value?.students || studentsRes.value?.data || [])
        : [];
      setStudents(studentList);
    } catch (err) {
      console.error('Failed to load mess data:', err);
      setErrorMessage(err?.response?.data?.error?.message || err.message || 'Unable to load dining information.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedHostelId]);

  // Load Hostel-Specific Menus & Timings when selectedHostelId changes
  const loadHostelDetails = useCallback(async (hId) => {
    if (!hId) return;
    try {
      setIsRefreshing(true);
      const [menusRes, timingsRes] = await Promise.allSettled([
        adminService.getHostelMealMenus(hId),
        adminService.getHostelMealTimings(hId),
      ]);

      const mList = menusRes.status === 'fulfilled'
        ? (Array.isArray(menusRes.value) ? menusRes.value : menusRes.value?.data || [])
        : [];
      setHostelMenus(mList);

      const tList = timingsRes.status === 'fulfilled'
        ? (Array.isArray(timingsRes.value) ? timingsRes.value : timingsRes.value?.data || [])
        : [];
      setMealTimings(tList);
    } catch (err) {
      console.error('Failed to load hostel dining details:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (selectedHostelId) {
      loadHostelDetails(selectedHostelId);
    }
  }, [selectedHostelId, loadHostelDetails]);

  // Sync menuFormData.hostel_id when selectedHostelId updates
  useEffect(() => {
    if (selectedHostelId) {
      setMenuFormData((prev) => ({ ...prev, hostel_id: selectedHostelId }));
      setTimingFormData((prev) => ({ ...prev, hostel_id: selectedHostelId }));
    }
  }, [selectedHostelId]);

  // Handle Create Meal Menu
  const handleCreateMenuSubmit = async (e) => {
    e.preventDefault();
    if (!menuFormData.hostel_id || !menuFormData.menu_date || !menuFormData.meal_type || !menuFormData.items.trim()) {
      setErrorMessage('Please fill in all required menu fields.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      await adminService.createMealMenu(menuFormData.hostel_id, {
        hostel_id: menuFormData.hostel_id,
        menu_date: menuFormData.menu_date,
        meal_type: menuFormData.meal_type,
        items: menuFormData.items.trim(),
      });

      setSuccessBanner(`Meal menu for ${menuFormData.meal_type} successfully published!`);
      setCreateMenuModalOpen(false);
      setMenuFormData({
        hostel_id: selectedHostelId,
        menu_date: new Date().toISOString().split('T')[0],
        meal_type: 'BREAKFAST',
        items: '',
      });

      // Reload
      await Promise.all([
        loadHostelDetails(selectedHostelId),
        adminService.getTodayMenus().then((res) => {
          setTodayMenus(Array.isArray(res) ? res : res?.data || []);
        }),
      ]);
    } catch (err) {
      console.error('Failed to create meal menu:', err);
      setErrorMessage(err?.response?.data?.error?.message || err.message || 'Could not save meal menu.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Create Meal Timing
  const handleCreateTimingSubmit = async (e) => {
    e.preventDefault();
    if (!timingFormData.hostel_id || !timingFormData.meal_type || !timingFormData.start_time || !timingFormData.end_time) {
      setErrorMessage('Please fill in all required timing fields.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      // Backend expects time.Time where start_time < end_time
      const baseDate = '2026-01-01';
      const startISO = new Date(`${baseDate}T${timingFormData.start_time}:00Z`).toISOString();
      const endISO = new Date(`${baseDate}T${timingFormData.end_time}:00Z`).toISOString();

      if (new Date(startISO) >= new Date(endISO)) {
        setErrorMessage('Serving start time must be before end time.');
        setSubmitting(false);
        return;
      }

      await adminService.createMealTiming(timingFormData.hostel_id, {
        hostel_id: timingFormData.hostel_id,
        meal_type: timingFormData.meal_type,
        start_time: startISO,
        end_time: endISO,
      });

      setSuccessBanner(`Schedule timings for ${timingFormData.meal_type} saved successfully!`);
      setCreateTimingModalOpen(false);
      await loadHostelDetails(selectedHostelId);
    } catch (err) {
      console.error('Failed to configure meal timing:', err);
      setErrorMessage(err?.response?.data?.error?.message || err.message || 'Could not save meal schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Submit Food Feedback
  const handleCreateFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackFormData.student_id || !feedbackFormData.menu_id) {
      setErrorMessage('Please select a student and target meal menu.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      await adminService.submitFoodFeedback({
        student_id: feedbackFormData.student_id,
        menu_id: feedbackFormData.menu_id,
        rating: parseInt(feedbackFormData.rating, 10),
        comment: feedbackFormData.comment ? feedbackFormData.comment.trim() : null,
      });

      setSuccessBanner('Food feedback and rating recorded successfully!');
      setCreateFeedbackModalOpen(false);
      setFeedbackFormData({
        student_id: '',
        menu_id: '',
        rating: 5,
        comment: '',
      });
    } catch (err) {
      console.error('Failed to submit food feedback:', err);
      setErrorMessage(err?.response?.data?.error?.message || err.message || 'Could not record food feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper formatting
  const formatMealTime = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    } catch {
      return isoString;
    }
  };

  const formatMenuDate = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const getMealBadgeClass = (type) => {
    switch (type) {
      case 'BREAKFAST':
        return 'badge-enterprise badge-orange';
      case 'LUNCH':
        return 'badge-enterprise badge-green';
      case 'SNACKS':
        return 'badge-enterprise badge-blue';
      case 'DINNER':
        return 'badge-enterprise badge-purple';
      default:
        return 'badge-enterprise';
    }
  };

  // Filtered menus for selected hostel
  const filteredMenus = useMemo(() => {
    return hostelMenus.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        (item.items && item.items.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.meal_type && item.meal_type.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesMeal = mealTypeFilter === 'ALL' || item.meal_type === mealTypeFilter;
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;

      return matchesSearch && matchesMeal && matchesStatus;
    });
  }, [hostelMenus, searchTerm, mealTypeFilter, statusFilter]);

  // Selected hostel name lookup
  const currentHostel = hostels.find((h) => h.id === selectedHostelId);

  if (loading && hostels.length === 0) {
    return (
      <div className="fade-in-up" style={{ padding: '32px' }}>
        <LoadingState message="Connecting to hostel dining services..." />
      </div>
    );
  }

  return (
    <div className="fade-in-up">
      {/* Enterprise Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <Utensils size={13} />
            <span>Campus Living &amp; Welfare</span>
          </div>
          <h1 className="hero-main-title">Hostel Mess &amp; Food Management</h1>
          <p className="hero-subtitle">
            Supervise daily meal rosters, serving hours, live menu broadcasts, and resident dining feedback across facilities.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            onClick={() => {
              loadInitialData(true);
              if (selectedHostelId) loadHostelDetails(selectedHostelId);
            }}
            disabled={isRefreshing}
            className="btn-enterprise-secondary"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
          </button>

          {canManageMess && (
            <>
              <button
                type="button"
                onClick={() => setCreateTimingModalOpen(true)}
                className="btn-enterprise-secondary"
              >
                <Clock size={14} style={{ color: '#6366f1' }} />
                <span>Set Timings</span>
              </button>
              <button
                type="button"
                onClick={() => setCreateMenuModalOpen(true)}
                className="btn-enterprise-primary"
              >
                <Plus size={15} />
                <span>Publish Menu</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '13.5px',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} style={{ color: '#10b981' }} />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            style={{ background: 'none', border: 'none', color: '#047857', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Notification Banner */}
      {errorMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '13.5px',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} style={{ color: '#ef4444' }} />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Level KPI Cards */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Active Hostels with Mess</span>
            <div className="stat-kpi-icon-wrap blue">
              <Building2 size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{hostels.length}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Residential facilities configured</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Today's Live Menus</span>
            <div className="stat-kpi-icon-wrap emerald">
              <CalendarDays size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-emerald-600">{todayMenus.length}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Broadcast meal slots active</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Serving Windows</span>
            <div className="stat-kpi-icon-wrap amber">
              <Clock size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-amber-600">{mealTimings.length}</div>
          <div className="stat-kpi-footnote">
            <span>Configured meal timing slots</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Published Menus</span>
            <div className="stat-kpi-icon-wrap purple">
              <Sparkles size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">{hostelMenus.length}</div>
          <div className="stat-kpi-footnote">
            <span>Catalog items for {currentHostel?.name || 'facility'}</span>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="staff-tabs-container" style={{ marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('TODAY')}
          className={`staff-tab-pill ${activeTab === 'TODAY' ? 'active' : ''}`}
        >
          <Sparkles size={15} />
          <span>Today's Live Broadcast</span>
          {todayMenus.length > 0 && (
            <span className="staff-tab-counter">{todayMenus.length}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('MENUS')}
          className={`staff-tab-pill ${activeTab === 'MENUS' ? 'active' : ''}`}
        >
          <Utensils size={15} />
          <span>Daily Meal Menus</span>
          {hostelMenus.length > 0 && (
            <span className="staff-tab-counter">{hostelMenus.length}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TIMINGS')}
          className={`staff-tab-pill ${activeTab === 'TIMINGS' ? 'active' : ''}`}
        >
          <Clock size={15} />
          <span>Meal Serving Windows</span>
          {mealTimings.length > 0 && (
            <span className="staff-tab-counter">{mealTimings.length}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('FEEDBACK')}
          className={`staff-tab-pill ${activeTab === 'FEEDBACK' ? 'active' : ''}`}
        >
          <Star size={15} />
          <span>Dining Feedback</span>
        </button>
      </div>

      {/* Main Content Area */}
      {activeTab === 'TODAY' && (
        <div className="enterprise-card">
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <Utensils size={16} />
              </div>
              <h2 className="card-title-text">Today's Meal Broadcast Schedules</h2>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className="stats-tally-pill" style={{ color: '#047857', background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                <CheckCircle2 size={12} />
                <span>{todayMenus.length} Active Slots Today</span>
              </span>
            </div>
          </div>

          {/* Today's 4-Meal Slot Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '12px' }}>
            {['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'].map((meal) => {
              const mealsOfType = todayMenus.filter((m) => m.meal_type === meal);

              return (
                <div
                  key={meal}
                  style={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  <div
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: meal === 'BREAKFAST' ? '#fffbeb' : meal === 'LUNCH' ? '#ecfdf5' : meal === 'SNACKS' ? '#eff6ff' : '#faf5ff',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '0.04em', color: meal === 'BREAKFAST' ? '#b45309' : meal === 'LUNCH' ? '#065f46' : meal === 'SNACKS' ? '#1d4ed8' : '#6b21a8' }}>
                      {meal}
                    </span>
                    <Utensils size={15} style={{ opacity: 0.7 }} />
                  </div>

                  <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    {mealsOfType.length === 0 ? (
                      <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: '12.5px', fontStyle: 'italic' }}>
                        No menu posted for this meal slot yet.
                      </div>
                    ) : (
                      mealsOfType.map((item, idx) => (
                        <div key={idx} style={{ paddingBottom: '12px', borderBottom: idx < mealsOfType.length - 1 ? '1px solid #f1f5f9' : 'none', marginBottom: idx < mealsOfType.length - 1 ? '12px' : '0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                            <span>{item.hostel_name || 'All Hostels'}</span>
                            <span className="badge-enterprise badge-green" style={{ fontSize: '10px' }}>
                              {item.status || 'PUBLISHED'}
                            </span>
                          </div>
                          <p style={{ fontSize: '13px', fontWeight: 500, color: '#1e293b', whiteSpace: 'pre-line', lineHeight: '1.5' }}>
                            {item.items}
                          </p>
                          {item.meal_menu_id && (
                            <button
                              type="button"
                              onClick={() => {
                                setFeedbackFormData((prev) => ({
                                  ...prev,
                                  menu_id: item.meal_menu_id,
                                }));
                                setCreateFeedbackModalOpen(true);
                              }}
                              style={{
                                marginTop: '10px',
                                background: 'none',
                                border: 'none',
                                color: '#4f46e5',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: 0,
                              }}
                            >
                              <Star size={13} />
                              <span>Record Feedback</span>
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'MENUS' && (
        <div className="enterprise-card">
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <Utensils size={16} />
              </div>
              <h2 className="card-title-text">Hostel Daily Meal Menus</h2>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
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

          {/* Filter Bar */}
          <div className="enterprise-filter-bar">
            <div className="filter-search-field">
              <Search size={14} className="filter-search-icon" />
              <input
                type="text"
                className="filter-search-input"
                placeholder="Search food items or meal types..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select
                className="filter-select"
                value={selectedHostelId}
                onChange={(e) => setSelectedHostelId(e.target.value)}
              >
                {hostels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.code})
                  </option>
                ))}
              </select>

              <select
                className="filter-select"
                value={mealTypeFilter}
                onChange={(e) => setMealTypeFilter(e.target.value)}
              >
                <option value="ALL">All Meal Types</option>
                <option value="BREAKFAST">BREAKFAST</option>
                <option value="LUNCH">LUNCH</option>
                <option value="SNACKS">SNACKS</option>
                <option value="DINNER">DINNER</option>
              </select>

              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="DRAFT">DRAFT</option>
              </select>
            </div>
          </div>

          {filteredMenus.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center' }}>
              <EmptyState
                title="No menus found"
                message="No meal menus match the selected filter criteria for this hostel."
              />
            </div>
          ) : displayMode === 'CARDS' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {filteredMenus.map((row) => (
                <div
                  key={row.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '16px',
                    background: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span className={getMealBadgeClass(row.meal_type)}>
                        {row.meal_type}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} />
                        <span>{formatMenuDate(row.menu_date)}</span>
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#1e293b', whiteSpace: 'pre-line', lineHeight: '1.5', minHeight: '60px' }}>
                      {row.items}
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="badge-enterprise badge-green" style={{ fontSize: '10px' }}>
                      {row.status || 'PUBLISHED'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setFeedbackFormData((prev) => ({
                          ...prev,
                          menu_id: row.id,
                        }));
                        setCreateFeedbackModalOpen(true);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#4f46e5',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Star size={13} />
                      <span>Feedback</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="enterprise-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>
                    <th style={{ padding: '10px 14px' }}>Menu Date</th>
                    <th style={{ padding: '10px 14px' }}>Meal Type</th>
                    <th style={{ padding: '10px 14px' }}>Food Items &amp; Specialties</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMenus.map((row) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a' }}>
                        {formatMenuDate(row.menu_date)}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span className={getMealBadgeClass(row.meal_type)}>
                          {row.meal_type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', maxWidth: '350px', whiteSpace: 'pre-line', color: '#334155' }}>
                        {row.items}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span className="badge-enterprise badge-green" style={{ fontSize: '10px' }}>
                          {row.status || 'PUBLISHED'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setFeedbackFormData((prev) => ({
                              ...prev,
                              menu_id: row.id,
                            }));
                            setCreateFeedbackModalOpen(true);
                          }}
                          className="btn-enterprise-secondary"
                          style={{ padding: '3px 10px', fontSize: '11px' }}
                        >
                          <Star size={12} />
                          <span>Feedback</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'TIMINGS' && (
        <div className="enterprise-card">
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <Clock size={16} />
              </div>
              <h2 className="card-title-text">Meal Serving Windows &amp; Dining Hours</h2>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className="filter-select"
                value={selectedHostelId}
                onChange={(e) => setSelectedHostelId(e.target.value)}
              >
                {hostels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {mealTimings.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center' }}>
              <EmptyState
                title="No serving windows configured"
                message="No meal hours have been registered yet for this hostel."
              />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '12px' }}>
              {mealTimings.map((row) => (
                <div
                  key={row.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '18px',
                    background: '#ffffff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span className={getMealBadgeClass(row.meal_type)}>
                      {row.meal_type}
                    </span>
                    <span className="badge-enterprise badge-green" style={{ fontSize: '10px' }}>
                      {row.status || 'ACTIVE'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b', fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>
                    <Clock size={16} style={{ color: '#4f46e5' }} />
                    <span>{formatMealTime(row.start_time)} – {formatMealTime(row.end_time)}</span>
                  </div>

                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Service window for {currentHostel?.name || 'facility'} residents
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'FEEDBACK' && (
        <div className="enterprise-card">
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <Star size={16} />
              </div>
              <h2 className="card-title-text">Student Dining Feedback &amp; Meal Quality</h2>
            </div>

            <button
              type="button"
              onClick={() => setCreateFeedbackModalOpen(true)}
              className="btn-enterprise-primary"
            >
              <Plus size={14} />
              <span>Record Feedback</span>
            </button>
          </div>

          <div style={{ padding: '24px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', marginTop: '12px' }}>
            <Star size={32} style={{ color: '#f59e0b', margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
              Student Dining Feedback System
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '480px', margin: '0 auto 16px' }}>
              Collect and monitor real-time resident ratings and culinary suggestions for daily breakfast, lunch, snacks, and dinner servings.
            </p>
            <button
              type="button"
              onClick={() => setCreateFeedbackModalOpen(true)}
              className="btn-enterprise-primary"
              style={{ margin: '0 auto' }}
            >
              <Send size={14} />
              <span>Submit Resident Feedback</span>
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: Publish Meal Menu                                            */}
      {/* =================================================================== */}
      {createMenuModalOpen && (
        <Modal
          isOpen={createMenuModalOpen}
          onClose={() => setCreateMenuModalOpen(false)}
          title="Publish Hostel Meal Menu"
        >
          <form onSubmit={handleCreateMenuSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Select Hostel *
              </label>
              <select
                className="filter-select"
                style={{ width: '100%', fontSize: '13px' }}
                value={menuFormData.hostel_id}
                onChange={(e) => setMenuFormData({ ...menuFormData, hostel_id: e.target.value })}
                required
              >
                {hostels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.code})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Menu Date *
                </label>
                <input
                  type="date"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '13px' }}
                  value={menuFormData.menu_date}
                  onChange={(e) => setMenuFormData({ ...menuFormData, menu_date: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Meal Type *
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%', fontSize: '13px' }}
                  value={menuFormData.meal_type}
                  onChange={(e) => setMenuFormData({ ...menuFormData, meal_type: e.target.value })}
                  required
                >
                  <option value="BREAKFAST">BREAKFAST</option>
                  <option value="LUNCH">LUNCH</option>
                  <option value="SNACKS">SNACKS</option>
                  <option value="DINNER">DINNER</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Food Items &amp; Specialties *
              </label>
              <textarea
                className="filter-search-input"
                style={{ width: '100%', minHeight: '90px', fontSize: '13px', padding: '10px' }}
                placeholder="e.g. Masala Dosa, Sambar, Coconut Chutney, Fresh Cut Fruits, Tea / Coffee"
                value={menuFormData.items}
                onChange={(e) => setMenuFormData({ ...menuFormData, items: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setCreateMenuModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={submitting}
              >
                {submitting ? 'Publishing...' : 'Publish Menu'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: Configure Meal Timing                                        */}
      {/* =================================================================== */}
      {createTimingModalOpen && (
        <Modal
          isOpen={createTimingModalOpen}
          onClose={() => setCreateTimingModalOpen(false)}
          title="Configure Meal Service Hours"
        >
          <form onSubmit={handleCreateTimingSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Target Hostel *
              </label>
              <select
                className="filter-select"
                style={{ width: '100%', fontSize: '13px' }}
                value={timingFormData.hostel_id}
                onChange={(e) => setTimingFormData({ ...timingFormData, hostel_id: e.target.value })}
                required
              >
                {hostels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.code})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Meal Service Slot *
              </label>
              <select
                className="filter-select"
                style={{ width: '100%', fontSize: '13px' }}
                value={timingFormData.meal_type}
                onChange={(e) => setTimingFormData({ ...timingFormData, meal_type: e.target.value })}
                required
              >
                <option value="BREAKFAST">BREAKFAST</option>
                <option value="LUNCH">LUNCH</option>
                <option value="SNACKS">SNACKS</option>
                <option value="DINNER">DINNER</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Serving Starts (HH:MM) *
                </label>
                <input
                  type="time"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '13px' }}
                  value={timingFormData.start_time}
                  onChange={(e) => setTimingFormData({ ...timingFormData, start_time: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Serving Ends (HH:MM) *
                </label>
                <input
                  type="time"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '13px' }}
                  value={timingFormData.end_time}
                  onChange={(e) => setTimingFormData({ ...timingFormData, end_time: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setCreateTimingModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={submitting}
              >
                {submitting ? 'Saving...' : 'Save Serving Hours'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: Record Dining Feedback                                       */}
      {/* =================================================================== */}
      {createFeedbackModalOpen && (
        <Modal
          isOpen={createFeedbackModalOpen}
          onClose={() => setCreateFeedbackModalOpen(false)}
          title="Record Student Dining Feedback"
        >
          <form onSubmit={handleCreateFeedbackSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Resident Student *
              </label>
              <select
                className="filter-select"
                style={{ width: '100%', fontSize: '13px' }}
                value={feedbackFormData.student_id}
                onChange={(e) => setFeedbackFormData({ ...feedbackFormData, student_id: e.target.value })}
                required
              >
                <option value="">Select Enrolled Student...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name} ({s.registration_number || s.enrollment_number || 'Resident'})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Target Meal Menu *
              </label>
              <select
                className="filter-select"
                style={{ width: '100%', fontSize: '13px' }}
                value={feedbackFormData.menu_id}
                onChange={(e) => setFeedbackFormData({ ...feedbackFormData, menu_id: e.target.value })}
                required
              >
                <option value="">Select Meal Menu...</option>
                {todayMenus.map((m) => (
                  <option key={m.meal_menu_id || m.id} value={m.meal_menu_id || m.id}>
                    [Today] {m.meal_type} - {m.items?.slice(0, 30)}...
                  </option>
                ))}
                {hostelMenus.map((m) => (
                  <option key={m.id} value={m.id}>
                    [{formatMenuDate(m.menu_date)}] {m.meal_type} - {m.items?.slice(0, 30)}...
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Culinary Rating (1 - 5 Stars) *
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFeedbackFormData({ ...feedbackFormData, rating: star })}
                    style={{
                      background: feedbackFormData.rating >= star ? '#fef3c7' : '#f8fafc',
                      border: feedbackFormData.rating >= star ? '1px solid #f59e0b' : '1px solid #e2e8f0',
                      color: feedbackFormData.rating >= star ? '#b45309' : '#64748b',
                      borderRadius: '8px',
                      padding: '8px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 600,
                      fontSize: '13px',
                    }}
                  >
                    <Star size={14} style={{ color: feedbackFormData.rating >= star ? '#f59e0b' : '#94a3b8' }} />
                    <span>{star}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Remarks &amp; Food Quality Comments
              </label>
              <textarea
                className="filter-search-input"
                style={{ width: '100%', minHeight: '80px', fontSize: '13px', padding: '10px' }}
                placeholder="e.g. Sambar was delicious, but coffee was a bit cold."
                value={feedbackFormData.comment}
                onChange={(e) => setFeedbackFormData({ ...feedbackFormData, comment: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setCreateFeedbackModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
