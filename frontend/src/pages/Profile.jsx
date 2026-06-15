import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchPublicRides, API_BASE } from '../api/client';
import { Activity, Zap, Map, Clock, User as UserIcon, MapPin, BarChart2, Globe, Link as LinkIcon, Lock } from 'lucide-react';

export default function Profile() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    fetchPublicRides(username)
      .then(data => {
        setProfile(data);
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

  const renderRideGrid = (rides) => {
    if (!rides || rides.length === 0) return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px', marginBottom: '32px' }}>
        <Activity size={48} color="var(--border-color)" style={{ marginBottom: '16px' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>No rides found in this category.</p>
      </div>
    );

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        {rides.map(r => (
          <div 
            key={r.id} 
            className="glass-panel hover-scale" 
            onClick={() => navigate(`/analyze?ride_id=${r.id}`)}
            style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{new Date(r.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
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
    );
  };

  const displayName = profile.first_name || profile.last_name ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : profile.username;

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div className="glass-panel" style={{ padding: '40px', marginBottom: '40px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'var(--surface-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid var(--border-color)', overflow: 'hidden', flexShrink: 0 }}>
            {profile.profile_picture ? (
              <img src={API_BASE.replace('/api', '') + profile.profile_picture} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <UserIcon size={48} color="var(--primary)" />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: 'clamp(1.5rem, 6vw, 2.4rem)', color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.2 }}>{displayName}</h2>
            <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', fontSize: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span>@{profile.username}</span>
              {profile.location && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={16} style={{ flexShrink: 0 }} /> {profile.location}</span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Total Rides</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--primary)' }}>{profile.stats.total_rides}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Total Distance</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--primary)' }}>{profile.stats.total_distance_km.toFixed(0)} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>km</span></div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Total Time</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--primary)' }}>{formatDuration(profile.stats.total_time_s)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Total Work</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--primary)' }}>{(profile.stats.total_work_kj / 1000).toFixed(1)} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>MJ</span></div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Avg Speed</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--primary)' }}>{profile.stats.avg_speed_kmh.toFixed(1)} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>km/h</span></div>
          </div>
        </div>
      </div>

      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', color: '#10B981', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <Globe size={20} /> Public Rides
      </h3>
      {renderRideGrid(profile.public_rides)}

      {profile.unlisted_rides.length > 0 && (
        <>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <LinkIcon size={20} /> Unlisted Rides
          </h3>
          {renderRideGrid(profile.unlisted_rides)}
        </>
      )}

      {profile.private_rides.length > 0 && (
        <>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', color: 'var(--accent)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <Lock size={20} /> Private Rides
          </h3>
          {renderRideGrid(profile.private_rides)}
        </>
      )}
    </div>
  );
}
