import React, { useEffect, useState } from 'react';
import parentService from '../services/parentService';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  UnauthorizedState,
} from '../components/PageStates';

function isMenuRecord(record) {
  return record &&
    typeof record.meal_menu_id === 'string' &&
    typeof record.meal_type === 'string' &&
    typeof record.items === 'string';
}

export default function MessPage() {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setUnauthorized(false);

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
          setUnauthorized(requestError?.status === 403);
          setError(requestError?.message || "Unable to load today's mess menu.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [refreshKey]);

  return (
    <div className="page-container">
      <header className="page-heading">
        <div>
          <p className="eyebrow">College services</p>
          <h1>Today&apos;s mess menu</h1>
          <p>Today&apos;s published menu for hostels in your college.</p>
        </div>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => setRefreshKey((key) => key + 1)}
          disabled={loading}
        >
          Refresh
        </button>
      </header>

      {loading ? (
        <LoadingState title="Loading today&apos;s menu..." />
      ) : unauthorized ? (
        <UnauthorizedState
          title="Mess menu unavailable"
          message={error}
        />
      ) : error ? (
        <ErrorState
          title="The mess menu could not be loaded"
          message={error}
          action={
            <button type="button" className="button button-secondary" onClick={() => setRefreshKey((key) => key + 1)}>
              Try again
            </button>
          }
        />
      ) : menus.length === 0 ? (
        <EmptyState title="No menu published" message="No menu records are available for today." />
      ) : (
        <div className="menu-grid">
          {menus.map((menu) => (
            <article className="menu-card" key={menu.meal_menu_id}>
              <div className="menu-card-heading">
                <div>
                  <p className="eyebrow">{menu.hostel_name || 'College hostel'}</p>
                  <h2>{menu.meal_type}</h2>
                </div>
                <span className="menu-status">{menu.status}</span>
              </div>
              <p className="menu-items">{menu.items}</p>
            </article>
          ))}
        </div>
      )}
      <p className="data-scope-note">Menu records are college-wide and are not linked to an individual student.</p>
    </div>
  );
}
