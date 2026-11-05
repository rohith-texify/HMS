import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check } from 'lucide-react';
import api from '../api/api';

/**
 * Enterprise Notification Center Popover.
 * Polls unread notifications, displays alerts, and marks as read.
 */
export default function NotificationDisplay({ className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

    const fetchUnread = async () => {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('hms_college_token') ||
      localStorage.getItem('hms_student_token') ||
      localStorage.getItem('hms_parent_token') ||
      localStorage.getItem('hms_incharge_token') ||
      localStorage.getItem('hms_security_token') ||
      sessionStorage.getItem('token');
    if (!token) return;

    try {
      const res = await api.get('/college/notifications/unread-count');
      const d = res.data || res;
      setUnreadCount(typeof d === 'number' ? d : d?.count || 0);
    } catch {
      // Graceful silence on optional telemetry
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/college/notifications');
      const d = res.data || res;
      const list = Array.isArray(d) ? d : d?.notifications || [];
      setNotifications(list.slice(0, 10));
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000); // 1 minute poll
    return () => clearInterval(interval);
  }, []);

  const toggleOpen = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  const markAllRead = async () => {
    try {
      await api.patch('/college/notifications/read-all');
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // Ignore
    }
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className={`notification-display-wrapper ${className}`} ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="header-icon-action-btn"
        onClick={toggleOpen}
        aria-label="View notifications"
        title="Institutional Notifications"
        style={{ position: 'relative' }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span
            className="notification-ping-dot"
            style={{
              position: 'absolute',
              top: '5px',
              right: '5px',
              width: '8px',
              height: '8px',
              backgroundColor: '#ef4444',
              borderRadius: '50%',
              border: '2px solid #ffffff',
            }}
          />
        )}
      </button>

      {isOpen && (
        <div
          className="notifications-dropdown-menu fade-in-up"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '320px',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid var(--border-color, #e2e8f0)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
            zIndex: 80,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8fafc',
            }}
          >
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
              Notifications {unreadCount > 0 && `(${unreadCount})`}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary-color, #2563eb)',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <Check size={12} />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted, #94a3b8)', fontSize: '0.8rem' }}>
                Checking notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted, #94a3b8)', fontSize: '0.8rem' }}>
                No active notifications
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id || n.notification_id}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                    backgroundColor: n.is_read ? '#ffffff' : '#f0f9ff',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)', marginBottom: '2px' }}>
                    {n.title || 'System Notice'}
                  </div>
                  <div style={{ color: 'var(--text-secondary, #475569)', fontSize: '0.76rem', lineHeight: 1.3 }}>
                    {n.message || n.content}
                  </div>
                  {n.created_at && (
                    <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.68rem', marginTop: '4px' }}>
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

