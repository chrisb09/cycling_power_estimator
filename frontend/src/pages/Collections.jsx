import React, { useEffect, useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchCollections, createCollection, deleteCollection, fetchRides } from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { Folder, Plus, Trash2, ChevronRight, Eye, Map, Zap, Activity, Clock } from 'lucide-react';

export default function Collections() {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('private');

  const loadCollections = () => {
    setLoading(true);
    fetchCollections().then(data => {
      setCollections(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    loadCollections();
  }, [token, navigate]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createCollection({ name: name.trim(), description: description.trim() || null, visibility });
      setName('');
      setDescription('');
      setShowCreate(false);
      loadCollections();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this collection? Rides inside it will not be affected.')) return;
    try {
      await deleteCollection(id);
      loadCollections();
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

  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h2 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Folder size={24} /> Collections
        </h2>
        <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> New Collection
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 16px 0' }}>Create Collection</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Alps Tour 2026" required />
            </div>
            <div className="form-group">
              <label>Description (optional)</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="A memorable trip..." rows={2} />
            </div>
            <div className="form-group">
              <label><Eye size={14} /> Visibility</label>
              <select value={visibility} onChange={e => setVisibility(e.target.value)}>
                <option value="private">Private</option>
                <option value="unlisted">Unlisted (Anyone with link)</option>
                <option value="public">Public (Visible on profile)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="button">Create</button>
              <button type="button" onClick={() => setShowCreate(false)} className="button">Cancel</button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" /></div>
      ) : collections.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Folder size={48} color="var(--border-color)" style={{ marginBottom: '16px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>No collections yet. Group your rides into collections!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {collections.map(c => (
            <div
              key={c.id}
              className="glass-panel hover-scale"
              onClick={() => navigate(`/collections/${c.id}`)}
              style={{ padding: '20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div>
                <h3 style={{ margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Folder size={18} color="var(--primary)" /> {c.name}
                </h3>
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span>{c.stats?.ride_count || 0} rides</span>
                  {c.stats?.total_distance_km > 0 && <span>{c.stats.total_distance_km.toFixed(1)} km</span>}
                  {c.stats?.total_work_kj > 0 && <span>{c.stats.total_work_kj.toFixed(0)} kJ</span>}
                  {c.stats?.total_time_s > 0 && <span>{formatDuration(c.stats.total_time_s)}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {c.visibility === 'public' ? <Eye size={16} color="#10B981" /> : c.visibility === 'unlisted' ? <Eye size={16} /> : null}
                <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} className="button" style={{ color: 'var(--accent)', padding: '4px 8px' }}>
                  <Trash2 size={14} />
                </button>
                <ChevronRight size={18} color="var(--text-secondary)" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
