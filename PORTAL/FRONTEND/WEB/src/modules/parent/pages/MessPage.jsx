import React, { useEffect, useState } from 'react';
import EmptyState from '../../../shared/components/EmptyState';
import ErrorState from '../../../shared/components/ErrorState';
import LoadingState from '../../../shared/components/LoadingState';
import parentService from '../services/parentService';
import './parent.css';

function isMenuRecord(record) {
  return record &&
    typeof record.meal_menu_id === 'string' &&
    typeof record.meal_type === 'string' &&
    typeof record.items === 'string';
}

export default function ParentMessPage() {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setMenus([]);
    parentService.getTodayMessMenu({ signal: controller.signal })
      .then((items) => {
        if (controller.signal.aborted) return;
        if (!items.every(isMenuRecord)) {
          throw new Error('The mess menu response contained invalid records.');
        }
        setMenus(items);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(requestError?.message || "Unable to load today's mess menu.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refreshKey]);

  return (
    <div className="parent-page">
      <header className="parent-page-header">
        <div>
          <p className="eyebrow">College services</p>
          <h1>Today&apos;s mess menu</h1>
          <p>Today&apos;s published menu for hostels in your college.</p>
        </div>
        <button
          type="button"
          className="parent-button"
          onClick={() => setRefreshKey((key) => key + 1)}
          disabled={loading}
        >
          Refresh
        </button>
      </header>

      {error && <ErrorState title="The mess menu could not be loaded" message={error} />}
      {loading ? (
        <LoadingState message="Loading today's menu..." />
      ) : !error && menus.length === 0 ? (
        <EmptyState title="No menu published" description="No menu records are available for today." />
      ) : (
        <div className="parent-menu-grid">
          {menus.map((menu) => (
            <article className="parent-menu-card" key={menu.meal_menu_id}>
              <div>
                <p className="parent-record-type">{menu.hostel_name || 'College hostel'}</p>
                <h2>{menu.meal_type}</h2>
              </div>
              <span className="parent-menu-status">{menu.status}</span>
              <p>{menu.items}</p>
            </article>
          ))}
        </div>
      )}
      <p className="parent-scope-note">
        Menu records are college-wide and are not linked to an individual student.
      </p>
    </div>
  );
}
