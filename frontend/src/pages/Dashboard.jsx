import React, { useEffect, useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchRides } from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { Activity, Zap, Map } from 'lucide-react';

export default function Dashboard() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchRides().then(data => {
      setRides(data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [token, navigate]);

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h2 style={{ margin: 0 }}>Ride History</h2>
        <Link to="/analyze" className="button" style={{ textDecoration: 'none' }}>+ Analyze New GPX</Link>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '10vh auto' }}>
          <div className="spinner" style={{ width: '40px', height: '40px' }} />
        </div>
      ) : rides.length === 0 ? (
        <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
          <Activity size={48} style={{ color: 'var(--text-secondary)', marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px 0' }}>No rides found</h3>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 24px 0' }}>Upload your first GPX file to start tracking your power output over time!</p>
          <Link to="/analyze" className="button" style={{ display: 'inline-block', textDecoration: 'none' }}>Upload GPX</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {rides.map(r => (
            <div key={r.id} className="glass-panel hover-scale" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--primary)' }}>{r.name}</h3>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{new Date(r.date).toLocaleDateString()}</span>
                </div>
                <Link to={`/analyze?ride_id=${r.id}`} className="button" style={{ padding: '6px 12px', fontSize: '0.85rem', textDecoration: 'none' }}>View</Link>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={18} style={{ color: 'var(--accent)' }}/>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Avg Power</div>
                    <div style={{ fontWeight: 'bold' }}>{Math.round(r.avg_power_watts)} W</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} style={{ color: '#4facfe' }}/>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Normalized</div>
                    <div style={{ fontWeight: 'bold' }}>{Math.round(r.normalized_power_watts)} W</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Map size={18} style={{ color: '#00f2fe' }}/>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Work</div>
                    <div style={{ fontWeight: 'bold' }}>{Math.round(r.total_work_kj)} kJ</div>
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
