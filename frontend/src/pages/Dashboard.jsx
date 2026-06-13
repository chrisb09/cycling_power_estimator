import React, { useEffect, useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchRides, deleteRide, updateRide } from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { Activity, Zap, Map, Edit2, Trash2, Clock, Navigation, Eye, EyeOff, Link as LinkIcon, Share2 } from 'lucide-react';

export default function Dashboard() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();

  const loadRides = () => {
    fetchRides().then(data => {
      setRides(data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadRides();
  }, [token, navigate]);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this ride?")) return;
    try {
      await deleteRide(id);
      loadRides();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRename = async (id) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await updateRide(id, { name: editName });
      setEditingId(null);
      loadRides();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleVisibility = async (id, currentVis) => {
    const nextVis = currentVis === 'private' ? 'unlisted' : currentVis === 'unlisted' ? 'public' : 'private';
    try {
      await updateRide(id, { visibility: nextVis });
      loadRides();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleGenerateShareToken = async (id) => {
    try {
      await updateRide(id, { generate_token: true });
      loadRides();
    } catch (err) {
      alert(err.message);
    }
  };

  const copyShareLink = (rideId, token) => {
    const url = `${window.location.origin}/analyze?ride_id=${rideId}&token=${token}`;
    navigator.clipboard.writeText(url);
    alert("Share link copied to clipboard!");
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h2 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--primary)' }}>Your Ride History</h2>
        <Link to="/" className="btn-primary" style={{ textDecoration: 'none' }}>+ Upload New Ride</Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" /></div>
      ) : rides.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Activity size={48} color="var(--border-color)" style={{ marginBottom: '16px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>No rides found. Upload your first GPX file to get started!</p>
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
                <div style={{ flex: 1, marginRight: '16px' }}>
                  {editingId === r.id ? (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }} onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="text" 
                        value={editName} 
                        onChange={(e) => setEditName(e.target.value)} 
                        style={{ padding: '4px 8px', fontSize: '1rem', width: '100%' }}
                        autoFocus
                        onKeyDown={(e) => { 
                          if (e.key === 'Enter') handleRename(r.id); 
                          else if (e.key === 'Escape') setEditingId(null); 
                        }}
                      />
                      <button onClick={(e) => { e.stopPropagation(); handleRename(r.id); }} className="button" style={{ padding: '4px 12px' }}>Save</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary)' }}>{r.name}</h3>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingId(r.id); setEditName(r.name); }} 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}
                        title="Rename"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Navigation size={12} /> {r.location || 'Unknown Location'}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{new Date(r.date).toLocaleDateString()}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleToggleVisibility(r.id, r.visibility); }} 
                    style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
                    title={`Visibility: ${r.visibility}`}
                  >
                    {r.visibility === 'public' ? <Eye size={16} color="var(--primary)" /> : r.visibility === 'unlisted' ? <LinkIcon size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} 
                    style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
                    title="Delete Ride"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              {r.visibility === 'private' && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Private Ride</span>
                    {r.share_token ? (
                      <button onClick={() => copyShareLink(r.id, r.share_token)} className="button" style={{ fontSize: '0.75rem', padding: '4px 8px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <Share2 size={12} /> Copy Share Link
                      </button>
                    ) : (
                      <button onClick={() => handleGenerateShareToken(r.id)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>
                        Create secret link
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={18} color="var(--accent)" />
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avg Power</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{Math.round(r.avg_power_watts)}<span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '2px', fontWeight: 'normal' }}>W</span></div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} color="var(--primary)" />
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Norm Power</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{Math.round(r.normalized_power_watts)}<span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '2px', fontWeight: 'normal' }}>W</span></div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Map size={18} color="#10B981" />
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Distance</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{r.distance_km ? r.distance_km.toFixed(1) : '--'}<span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '2px', fontWeight: 'normal' }}>km</span></div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} color="#F59E0B" />
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Moving Time</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{formatDuration(r.moving_time_s)}</div>
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
