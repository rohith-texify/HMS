import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import inchargeService from '../services/inchargeService';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { UtensilsCrossed, Clock, Calendar } from 'lucide-react';

export default function MessPage() {
  const { assignedHostel } = useAuth();
  const [timings, setTimings] = useState([]);
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadMessData() {
      const hostelId = assignedHostel?.id || assignedHostel?.hostel_id;
      if (!hostelId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const [timeData, menuData] = await Promise.allSettled([
          inchargeService.getMessTimings(hostelId),
          inchargeService.getMessMenus(hostelId),
        ]);

        if (timeData.status === 'fulfilled') {
          setTimings(timeData.value);
        }
        if (menuData.status === 'fulfilled') {
          setMenus(menuData.value);
        }
      } catch (err) {
        setError(err.message || 'Failed to load mess schedule.');
      } finally {
        setLoading(false);
      }
    }
    loadMessData();
  }, [assignedHostel]);

  return (
    <div>
      <PageHeader
        title="Mess & Dining Operations"
        description="Daily meal serving schedules and weekly student dining menus."
        icon={UtensilsCrossed}
      />

      {loading && <LoadingState title="Loading mess schedules..." rows={3} />}
      {error && <ErrorState title="Error Loading Mess Information" message={error} onRetry={() => window.location.reload()} />}

      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Meal Timings Card */}
          <div className="card">
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="var(--primary-color)" />
              <span>Standard Meal Timings</span>
            </h2>
            <div className="grid-4">
              {['Breakfast (07:30 - 09:30)', 'Lunch (12:30 - 14:30)', 'Snacks (17:00 - 18:30)', 'Dinner (19:30 - 21:30)'].map(
                (m, i) => (
                  <div key={i} className="stat-card">
                    <div className="stat-icon">🍲</div>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {m.split(' ')[0]}
                      </div>
                      <div className="stat-label">{m.substring(m.indexOf('(') + 1, m.indexOf(')'))}</div>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Weekly Menu Table */}
          <div className="card">
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} color="var(--primary-color)" />
              <span>Hostel Mess Weekly Dietary Menu</span>
            </h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Breakfast</th>
                    <th>Lunch</th>
                    <th>Evening Snacks</th>
                    <th>Dinner</th>
                  </tr>
                </thead>
                <tbody>
                  {menus.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                        Weekly meal menu roster has not been published yet for this hostel.
                      </td>
                    </tr>
                  ) : (
                    menus.map((m, i) => (
                      <tr key={m.id || i}>
                        <td><strong>{m.day_of_week || 'Day ' + (i + 1)}</strong></td>
                        <td>{m.breakfast || 'Standard Breakfast'}</td>
                        <td>{m.lunch || 'Standard Lunch'}</td>
                        <td>{m.snacks || 'Tea & Snacks'}</td>
                        <td>{m.dinner || 'Standard Dinner'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

