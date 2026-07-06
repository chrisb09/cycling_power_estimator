import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBikes, createBike, updateBike, deleteBike } from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { Bike, Plus, Edit2, Trash2, X, Check, Weight, Settings } from 'lucide-react';

const TIRE_OPTIONS = [
  { value: 'slick', label: 'Slick / Race (Crr: 0.004)' },
  { value: 'commuter', label: 'Commuter / Touring (Crr: 0.006)' },
  { value: 'gravel', label: 'Gravel (Crr: 0.010)' },
  { value: 'mtb', label: 'Mountain Bike (Crr: 0.014)' },
];

const DRIVETRAIN_OPTIONS = [
  { value: 'optimized', label: 'Optimized / Waxed (97%)' },
  { value: 'average', label: 'Average / Lube (95%)' },
  { value: 'dirty', label: 'Dirty / Gritty (92%)' },
];

const POSITION_OPTIONS = [
  { value: '', label: 'None (use manual selection)' },
  { value: 'tops', label: 'Tops / Upright' },
  { value: 'hoods', label: 'Hoods / Standard' },
  { value: 'drops', label: 'Drops / Aggressive' },
  { value: 'aero', label: 'Aero / TT' },
];

function BikeForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '');
  const [weightKg, setWeightKg] = useState(initial?.weight_kg || 10.0);
  const [tireType, setTireType] = useState(initial?.tire_type || 'commuter');
  const [drivetrain, setDrivetrain] = useState(initial?.drivetrain || 'average');
  const [defaultPosition, setDefaultPosition] = useState(initial?.default_riding_position || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      weight_kg: weightKg,
      tire_type: tireType,
      drivetrain,
      default_riding_position: defaultPosition || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '20px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ margin: 0 }}>{initial ? 'Edit Bike' : 'Add New Bike'}</h4>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="submit" className="button" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Check size={14} /> Save
          </button>
          <button type="button" onClick={onCancel} className="button" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <X size={14} /> Cancel
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2" style={{ gap: '12px' }}>
        <div className="form-group">
          <label>Bike Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Canyon Ultimate" required />
        </div>
        <div className="form-group">
          <label><Weight size={14} /> Weight (kg)</label>
          <input type="number" step="0.1" value={weightKg} onChange={e => setWeightKg(parseFloat(e.target.value))} min={0} required />
        </div>
        <div className="form-group">
          <label>Tires</label>
          <select value={tireType} onChange={e => setTireType(e.target.value)}>
            {TIRE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Drivetrain</label>
          <select value={drivetrain} onChange={e => setDrivetrain(e.target.value)}>
            {DRIVETRAIN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label><Settings size={14} /> Default Riding Position</label>
          <select value={defaultPosition} onChange={e => setDefaultPosition(e.target.value)}>
            {POSITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
    </form>
  );
}

export default function BikeManager() {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [bikes, setBikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadBikes();
  }, [token, navigate]);

  const loadBikes = () => {
    setLoading(true);
    fetchBikes().then(data => {
      setBikes(data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  const handleCreate = async (data) => {
    try {
      await createBike(data);
      setShowForm(false);
      loadBikes();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      await updateBike(id, data);
      setEditingId(null);
      loadBikes();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this bike? Rides using it will be unlinked but their snapshot values are preserved.')) return;
    try {
      await deleteBike(id);
      loadBikes();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h2 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bike size={24} /> My Bikes
        </h2>
        <button onClick={() => setShowForm(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
          <Plus size={16} /> Add Bike
        </button>
      </div>

      {showForm && (
        <BikeForm onSave={handleCreate} onCancel={() => setShowForm(false)} />
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" /></div>
      ) : bikes.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Bike size={48} color="var(--border-color)" style={{ marginBottom: '16px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>No bikes saved yet. Add your first bike preset!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {bikes.map(bike => (
            <div key={bike.id} className="glass-panel" style={{ padding: '20px' }}>
              {editingId === bike.id ? (
                <BikeForm
                  initial={bike}
                  onSave={(data) => handleUpdate(bike.id, data)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Bike size={18} color="var(--primary)" /> {bike.name}
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      <span><strong>Weight:</strong> {bike.weight_kg} kg</span>
                      <span><strong>Tires:</strong> {bike.tire_type}</span>
                      <span><strong>Drivetrain:</strong> {bike.drivetrain}</span>
                      <span><strong>Default Position:</strong> {bike.default_riding_position || 'None'}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                    <button onClick={() => setEditingId(bike.id)} className="button" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Edit2 size={14} /> Edit
                    </button>
                    <button onClick={() => handleDelete(bike.id)} className="button" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent)' }}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
