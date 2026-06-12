import React from 'react';
import { Map, Calendar, Settings, MapPin, Clock } from 'lucide-react';

export default function RideHeader({ summary, params, onEdit }) {
  if (!summary || !params) return null;

  const formatDate = (isoString) => {
    if (!isoString) return 'Unknown Date';
    const d = new Date(isoString);
    return d.toLocaleString('en-US', { 
      weekday: 'short', month: 'short', day: 'numeric', 
      hour: 'numeric', minute: '2-digit' 
    });
  };

  const startTime = formatDate(summary.start_time);
  const endTime = formatDate(summary.end_time);

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '20px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Map size={24} color="var(--accent)" />
          {summary.distance_km.toFixed(1)} km Ride
          {summary.location && summary.location !== 'Unknown Location' && (
            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '12px', fontWeight: 500 }}>
              <MapPin size={16} /> {summary.location}
            </span>
          )}
          {summary.device && summary.device !== 'Unknown Device' && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px', marginLeft: '8px' }}>
              Recorded on {summary.device}
            </span>
          )}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} />
            <span>{startTime} — {endTime}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={16} />
            <span>{formatDuration(summary.moving_time_s)} Moving / {formatDuration(summary.elapsed_time_s)} Total</span>
          </div>
        </div>
      </div>
      
      <div 
        onClick={onEdit}
        style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(0,0,0,0.02)', padding: '12px 20px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'all 0.2s' }}
        onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
        onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
      >
        <Settings size={18} color="var(--text-secondary)" />
        <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Rider / Bike</span>
            <span>{params.rider_kg} kg / {params.bike_kg} kg</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Tires / Position</span>
            <span style={{ textTransform: 'capitalize' }}>{params.tires} / {params.position}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Drivetrain</span>
            <span style={{ textTransform: 'capitalize' }}>{params.drivetrain}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
