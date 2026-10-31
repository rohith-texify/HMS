import React, { useState, useEffect } from 'react';
import api from '../../../shared/api/api';

export default function SecurityGatesPage() {
  const [gates, setGates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/college/gates');
        const d = res.data || res;
        setGates(Array.isArray(d) ? d : d?.gates || []);
      } catch (err) {
        console.error('Failed to load gates:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <div className="header-container">
        <div>
          <h1 className="page-title">Campus Gate Checkpoints</h1>
          <p className="page-subtitle">Configured campus gates, biometric terminals, and entry/exit status.</p>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Gate Name</th>
                <th>Gate Code</th>
                <th>Type</th>
                <th>Operational Status</th>
              </tr>
            </thead>
            <tbody>
              {gates.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
                    {loading ? 'Loading checkpoint records...' : 'No gate checkpoints configured.'}
                  </td>
                </tr>
              ) : (
                gates.map((g, i) => (
                  <tr key={g.id || i}>
                    <td><strong>{g.name || 'Main Campus Gate ' + (i + 1)}</strong></td>
                    <td><code>{g.code || 'GATE-0' + (i + 1)}</code></td>
                    <td>{g.type || 'BIOMETRIC & MANUAL'}</td>
                    <td><span className="badge badge-success">{g.status || 'OPERATIONAL'}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

