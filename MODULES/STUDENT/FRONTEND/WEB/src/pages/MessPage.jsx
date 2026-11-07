import React, { useState, useEffect } from 'react';
import { studentService } from '../services/studentService';
import {
  PageHeader,
  Card,
  Badge,
  LoadingState,
  ErrorState,
} from '../components';
import {
  Utensils,
  Clock,
  Sparkles,
  Info,
  Calendar,
} from 'lucide-react';

export default function MessPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menu, setMenu] = useState(null);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await studentService.getTodayMessMenu();
      setMenu(data);
    } catch (err) {
      setError(err.message || 'Failed to retrieve daily mess schedule.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  if (loading) {
    return <LoadingState message="Loading today's dining schedule & menu..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchMenu} />;
  }

  return (
    <div>
      <PageHeader
        title={`Mess Dining Schedule • ${menu?.day_of_week || 'Today'}`}
        subtitle={`${menu?.date || 'Today'} • Institutional Dining Hall Timings & Menu`}
        icon={Utensils}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          marginBottom: '24px',
        }}
      >
        {menu?.meals?.map((meal, idx) => (
          <Card
            key={idx}
            title={meal.meal_type}
            subtitle={meal.timings}
            action={
              meal.is_special ? (
                <Badge variant="warning">
                  <Sparkles size={12} /> Special Feast
                </Badge>
              ) : (
                <Badge variant="success">Standard</Badge>
              )
            }
          >
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                Course Items:
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem', color: '#1e293b', lineHeight: 1.7 }}>
                {meal.items?.map((item, itemIdx) => (
                  <li key={itemIdx}>{item}</li>
                ))}
              </ul>
            </div>
          </Card>
        ))}
      </div>

      {/* Mess Guidelines */}
      <Card title="Dining Hall Instructions" subtitle="Student residential dining policies & guidelines">
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', color: '#334155', fontSize: '0.86rem', lineHeight: 1.6 }}>
          <Info size={22} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p style={{ margin: '0 0 8px 0' }}>
              1. <strong>Dining Timings:</strong> Meals are served strictly within the designated slot windows. Entry to the mess hall is closed 15 minutes prior to slot end time.
            </p>
            <p style={{ margin: '0 0 8px 0' }}>
              2. <strong>Student ID Verification:</strong> Please carry your institutional student identity card or present your digital living portal ID at the dining desk when requested.
            </p>
            <p style={{ margin: 0 }}>
              3. <strong>Food Wastage:</strong> Zero food wastage is strictly practiced on campus. Take only as much as you consume.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

