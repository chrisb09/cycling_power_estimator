import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchPublicRides } from '../api/client';
import { Activity, Zap, Map, Clock, User as UserIcon } from 'lucide-react';

export default function Profile() {
  const { username } = useParams();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    fetchPublicRides(username)
      .then(data => {
        setRides(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [username]);

  const formatDuration = (seconds) => {
    if (!seconds) return '--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" /></div>;
  if (error) return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--accent)' }}>{error}</div>;

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--surface-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--border-color)' }}>
          <UserIcon size={32} color="var(--primary)" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '2rem', color: 'var(--text-primary)' }}>{username}</h2>
          <span style={{ color: 'var(--text-secondary)' }}>Public Profile</span>
        </div>
      </div>

      <h3 style={{ marginBottom: '24px', color: 'var(--primary)' }}>Public Rides</h3>

      {rides.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Activity size={48} color="var(--border-color)" style={{ marginBottom: '16px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>No public rides found for this user.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {rides.map(r => (
            <div 
              key={r.id} 
              className="glass-panel hover-scale" 
              onClick={() => navigate(`/analyze?ride_id=${r.id}`)}
              style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--primary)' }}>{r.name}</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{new Date(r.date).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={18} color="var(--accent)" />
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avg Power</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{Math.round(r.avg_power_watts)}<span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '2px', fontWeight: 'normal' }}>W</span></div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Map size={18} color="#10B981" />
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Distance</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{r.distance_km ? r.distance_km.toFixed(1) : '--'}<span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '2px', fontWeight: 'normal' }}>km</span></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
