import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { fetchCollection, removeRideFromCollection, generateCollectionShareToken, addRideToCollection, fetchRides } from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { Folder, Map, Zap, Activity, Clock, Trash2, Share2, ArrowLeft, Plus, X, Navigation } from 'lucide-react';

export default function Collection() {
  const { id } = useParams();
  const { token, username } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shareToken = searchParams.get('token') || null;
  const isLoggedInOwner = !!token;

  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddRide, setShowAddRide] = useState(false);
  const [userRides, setUserRides] = useState([]);
  const [selectedRideIds, setSelectedRideIds] = useState([]);

  useEffect(() => {
    if (id) {
      setLoading(true);
      setError(null);
      fetchCollection(parseInt(id), shareToken)
        .then(setCollection)
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [id, shareToken]);

  const loadRidesForAdd = async () => {
    try {
      const rides = await fetchRides();
      const existingIds = new Set((collection?.rides || []).map(r => r.id));
      setUserRides(rides.filter(r => !existingIds.has(r.id)));
    } catch (e) { setUserRides([]); }
  };

  const handleAddRides = async () => {
    for (const rideId of selectedRideIds) {
      try {
        await addRideToCollection(parseInt(id), rideId);
      } catch (e) { /* skip errors */ }
    }
    setSelectedRideIds([]);
    setShowAddRide(false);
    const c = await fetchCollection(parseInt(id), shareToken);
    setCollection(c);
  };

  const handleRemoveRide = async (rideId) => {
    try {
      await removeRideFromCollection(parseInt(id), rideId);
      const c = await fetchCollection(parseInt(id), shareToken);
      setCollection(c);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleGenerateShare = async () => {
    try {
      const result = await generateCollectionShareToken(parseInt(id));
      navigator.clipboard.writeText(`${window.location.origin}/collections/${id}?token=${result.share_token}`);
      alert('Share link copied to clipboard!');
    } catch (err) {
      alert(err.message);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" /></div>;
  if (error) return (
    <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <div className="glass-panel" style={{ textAlign: 'center', padding: '48px', borderColor: 'var(--accent)' }}>
        <p style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>{error}</p>
        <Link to="/" className="button" style={{ marginTop: '16px', display: 'inline-block' }}>Go Home</Link>
      </div>
    </div>
  );
  if (!collection) return null;

  const s = collection.stats || {};
  const isOwner = collection.user_id && localStorage.getItem('token');

  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <button onClick={() => navigate(-1)} className="button" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Folder size={24} color="var(--primary)" /> {collection.name}
          </h2>
          {collection.description && (
            <p style={{ margin: '0 0 8px 0', color: 'var(--text-secondary)' }}>{collection.description}</p>
          )}
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {collection.visibility} · {collection.rides?.length || 0} rides
          </span>
        </div>
        {isOwner && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleGenerateShare} className="button" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Share2 size={14} /> Share
            </button>
          </div>
        )}
      </div>

      {s.ride_count > 0 && (
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>Combined Stats</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}><Map size={14} style={{ display: 'inline', marginRight: 4 }} /> Distance</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{s.total_distance_km?.toFixed(1)} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>km</span></div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}><Clock size={14} style={{ display: 'inline', marginRight: 4 }} /> Moving Time</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{formatDuration(s.total_time_s)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}><Zap size={14} style={{ display: 'inline', marginRight: 4 }} /> Total Work</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{s.total_work_kj?.toFixed(0)} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>kJ</span></div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}><Activity size={14} style={{ display: 'inline', marginRight: 4 }} /> Avg Power</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{s.avg_power_watts?.toFixed(0) || '--'} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>W</span></div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}><Activity size={14} style={{ display: 'inline', marginRight: 4 }} /> Avg Norm Power</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{s.normalized_power_watts?.toFixed(0) || '--'} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>W</span></div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}><Map size={14} style={{ display: 'inline', marginRight: 4 }} /> Rides</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{s.ride_count}</div>
            </div>
          </div>
        </div>
      )}

      {isOwner && (
        <div style={{ marginBottom: '16px' }}>
          <button onClick={() => { setShowAddRide(!showAddRide); if (!showAddRide) loadRidesForAdd(); }} className="button" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {showAddRide ? <X size={14} /> : <Plus size={14} />} {showAddRide ? 'Cancel' : 'Add Rides'}
          </button>
        </div>
      )}

      {showAddRide && (
        <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 12px 0' }}>Add Rides</h4>
          {userRides.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>All your rides are already in this collection.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {userRides.map(r => (
                <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={selectedRideIds.includes(r.id)} onChange={(e) => {
                    if (e.target.checked) setSelectedRideIds(p => [...p, r.id]);
                    else setSelectedRideIds(p => p.filter(x => x !== r.id));
                  }} />
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{r.distance_km?.toFixed(1)} km</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{new Date(r.date).toLocaleDateString()}</span>
                </label>
              ))}
              <button onClick={handleAddRides} className="button" disabled={selectedRideIds.length === 0} style={{ alignSelf: 'flex-start', marginTop: '8px' }}>
                Add Selected ({selectedRideIds.length})
              </button>
            </div>
          )}
        </div>
      )}

      {collection.days?.length > 0 ? (
        collection.days.map(day => (
          <div key={day.date} className="glass-panel" style={{ padding: '20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{day.date}</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {day.ride_count} ride{day.ride_count !== 1 ? 's' : ''} · {day.total_distance_km.toFixed(1)} km · {formatDuration(day.total_time_s)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {day.rides.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '6px' }}>
                  <Link to={`/analyze?ride_id=${r.id}`} style={{ fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Navigation size={14} /> {r.name}
                  </Link>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <span>{r.distance_km?.toFixed(1)} km</span>
                    <span>{formatDuration(r.moving_time_s)}</span>
                    {r.avg_power_watts > 0 && <span>{Math.round(r.avg_power_watts)}W avg</span>}
                    {isOwner && (
                      <button onClick={() => handleRemoveRide(r.id)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '2px' }} title="Remove from collection">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No rides in this collection yet.</p>
        </div>
      )}
    </div>
  );
}
