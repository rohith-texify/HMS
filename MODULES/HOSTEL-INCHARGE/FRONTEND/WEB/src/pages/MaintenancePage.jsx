import React, { useState, useEffect } from 'react';
import inchargeService from '../services/inchargeService';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { Hammer } from 'lucide-react';

export default function MaintenancePage() {
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await inchargeService.getMaintenance();
        setMaintenance(data);
      } catch (err) {
        setError(err.message || 'Failed to load maintenance records.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <PageHeader
        title="Facility Maintenance"
        description="Premises repair requests, plumbing, electrical, and room carpentry work orders."
        icon={Hammer}
      />

      {loading && <LoadingState title="Loading maintenance orders..." rows={4} />}
      {error && <ErrorState title="Error Loading Maintenance" message={error} onRetry={() => window.location.reload()} />}

      {!loading && !error && (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Work Order ID</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {maintenance.length === 0 ? (
                  <tr>
                    <td colSpan="5">
                      <EmptyState
                        icon={Hammer}
                        title="No Maintenance Orders"
                        description="There are currently no active maintenance or repair requests logged."
                      />
                    </td>
                  </tr>
                ) : (
                  maintenance.map((m, i) => (
                    <tr key={m.id || i}>
                      <td><strong>{m.id ? m.id.substring(0, 8) + '...' : '—'}</strong></td>
                      <td>{m.category || 'General Repair'}</td>
                      <td>{m.description || m.title || '—'}</td>
                      <td>{m.priority || 'Normal'}</td>
                      <td><span className="badge badge-pending">{m.status || 'PENDING'}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

