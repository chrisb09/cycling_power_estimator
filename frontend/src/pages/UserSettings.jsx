import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchMe, updateMe, selfPromote } from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { Settings, Save, Shield } from 'lucide-react';

export default function UserSettings() {
  const [user, setUser] = useState(null);
  const [weight, setWeight] = useState(75.0);
  const [height, setHeight] = useState(175.0);
  const [defaultRideVisibility, setDefaultRideVisibility] = useState('private');
  const [profileVisibility, setProfileVisibility] = useState('public');
  const [adminCode, setAdminCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchMe()
      .then(u => {
        setUser(u);
        setWeight(u.weight_kg);
        setHeight(u.height_cm);
        setDefaultRideVisibility(u.default_ride_visibility || 'private');
        setProfileVisibility(u.profile_visibility || 'public');
        setLoading(false);
      })
      .catch(err => {
        alert(err.message);
        setLoading(false);
      });
  }, [token, navigate]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      await updateMe({ 
        weight_kg: parseFloat(weight), 
        height_cm: parseFloat(height),
        default_ride_visibility: defaultRideVisibility,
        profile_visibility: profileVisibility
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSelfPromote = async (e) => {
    e.preventDefault();
    if (!adminCode.trim()) return;
    try {
      const updatedUser = await selfPromote(adminCode.trim());
      setUser(updatedUser);
      setAdminCode('');
      alert("Successfully promoted to Admin!");
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" /></div>;

  return (
    <div style={{ padding: '32px', maxWidth: '600px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <Settings size={32} color="var(--primary)" />
        <h2 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--primary)' }}>Account Settings</h2>
      </div>

      <div className="glass-panel" style={{ padding: '32px' }}>
        <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Profile Details</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Username: <strong>{user.username}</strong></p>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Role: <strong style={{ color: user.role === 'admin' ? 'var(--accent)' : 'inherit' }}>{user.role}</strong></p>
        </div>

        <form onSubmit={handleSave}>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Body Weight (kg)</label>
              <input 
                type="number" 
                step="0.1" 
                value={weight} 
                onChange={e => setWeight(e.target.value)} 
                required 
                style={{ width: '100%', padding: '10px' }}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Height (cm)</label>
              <input 
                type="number" 
                step="0.1" 
                value={height} 
                onChange={e => setHeight(e.target.value)} 
                required 
                style={{ width: '100%', padding: '10px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Profile Visibility</label>
              <select 
                value={profileVisibility} 
                onChange={e => setProfileVisibility(e.target.value)} 
                style={{ width: '100%', padding: '10px', background: 'var(--bg-dark)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
              >
                <option value="public">Public (Anyone)</option>
                <option value="internal">Internal (Logged in users only)</option>
                <option value="private">Private (Only me)</option>
              </select>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Default Ride Visibility</label>
              <select 
                value={defaultRideVisibility} 
                onChange={e => setDefaultRideVisibility(e.target.value)} 
                style={{ width: '100%', padding: '10px', background: 'var(--bg-dark)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
              >
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px', padding: '12px' }}
            disabled={saving}
          >
            {saving ? <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} /> : <><Save size={20} /> Save Changes</>}
          </button>
          
          {success && <div style={{ marginTop: '16px', textAlign: 'center', color: '#10B981', fontSize: '0.9rem' }}>Settings updated successfully!</div>}
        </form>
      </div>

      {user.role !== 'admin' && (
        <div className="glass-panel" style={{ padding: '32px', marginTop: '32px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 8px 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={20} /> Self-Promotion
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Enter the admin code from the server console to grant yourself administrator privileges.</p>
          </div>
          <form onSubmit={handleSelfPromote} style={{ display: 'flex', gap: '16px' }}>
            <input 
              type="text" 
              value={adminCode}
              onChange={e => setAdminCode(e.target.value)}
              placeholder="Enter Admin Code"
              style={{ flex: 1, padding: '10px' }}
            />
            <button type="submit" className="btn-primary" style={{ padding: '0 24px' }}>Promote Me</button>
          </form>
        </div>
      )}
    </div>
  );
}
